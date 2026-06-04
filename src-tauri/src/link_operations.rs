// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::utils::normalize_path;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LinkCreationKind {
    Symlink,
    Shortcut,
    Hardlink,
    Junction,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinkFailure {
    source_path: String,
    error: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateLinksResult {
    success: bool,
    created_paths: Vec<String>,
    failed_items: Vec<CreateLinkFailure>,
}

fn source_file_name(source_path: &Path) -> String {
    source_path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.trim().is_empty())
        .map(|name| name.to_string())
        .unwrap_or_else(|| "link".to_string())
}

fn base_destination_name(source_path: &Path, link_kind: LinkCreationKind) -> String {
    let file_name = source_file_name(source_path);

    match link_kind {
        LinkCreationKind::Shortcut => shortcut_destination_name(&file_name),
        LinkCreationKind::Symlink | LinkCreationKind::Hardlink | LinkCreationKind::Junction => {
            file_name
        }
    }
}

fn shortcut_destination_name(file_name: &str) -> String {
    #[cfg(windows)]
    {
        format!("{file_name} - Shortcut.lnk")
    }

    #[cfg(target_os = "macos")]
    {
        format!("{file_name} alias")
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        format!("{file_name}.desktop")
    }

    #[cfg(not(any(windows, unix)))]
    {
        format!("{file_name}.shortcut")
    }
}

fn split_name_for_index(file_name: &str) -> (&str, &str) {
    match file_name.rfind('.') {
        Some(dot_index) if dot_index > 0 => (&file_name[..dot_index], &file_name[dot_index..]),
        _ => (file_name, ""),
    }
}

fn indexed_file_name(file_name: &str, index: usize) -> String {
    if index == 0 {
        return file_name.to_string();
    }

    let (stem, extension) = split_name_for_index(file_name);
    format!("{stem} {}{extension}", index + 1)
}

fn destination_path_exists(path: &Path) -> bool {
    match fs::symlink_metadata(path) {
        Ok(_) => true,
        Err(io_error) => io_error.kind() != std::io::ErrorKind::NotFound,
    }
}

#[cfg(windows)]
fn is_symlink_permission_error(error: &std::io::Error) -> bool {
    matches!(error.raw_os_error(), Some(1314) | Some(5))
}

fn resolve_available_destination(
    destination_directory: &Path,
    base_name: &str,
    reserved_paths: &mut HashSet<String>,
) -> PathBuf {
    let mut index = 0;

    loop {
        let candidate = destination_directory.join(indexed_file_name(base_name, index));
        let normalized_candidate = normalize_path(&candidate.to_string_lossy());

        if !destination_path_exists(&candidate) && !reserved_paths.contains(&normalized_candidate) {
            reserved_paths.insert(normalized_candidate);
            return candidate;
        }

        index += 1;
    }
}

fn create_symlink(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows::core::PCWSTR;
        use windows::Win32::Storage::FileSystem::{
            CreateSymbolicLinkW, SYMBOLIC_LINK_FLAGS, SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE,
            SYMBOLIC_LINK_FLAG_DIRECTORY,
        };

        fn create_windows_symlink(
            source_path: &Path,
            link_path: &Path,
            flags: SYMBOLIC_LINK_FLAGS,
        ) -> std::io::Result<()> {
            let source_path_wide: Vec<u16> = source_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let link_path_wide: Vec<u16> = link_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            unsafe {
                if CreateSymbolicLinkW(
                    PCWSTR(link_path_wide.as_ptr()),
                    PCWSTR(source_path_wide.as_ptr()),
                    flags,
                )
                .as_bool()
                {
                    Ok(())
                } else {
                    Err(std::io::Error::last_os_error())
                }
            }
        }

        let base_flags = if source_is_directory {
            SYMBOLIC_LINK_FLAGS(
                SYMBOLIC_LINK_FLAG_DIRECTORY.0 | SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE.0,
            )
        } else {
            SYMBOLIC_LINK_FLAG_ALLOW_UNPRIVILEGED_CREATE
        };

        match create_windows_symlink(source_path, link_path, base_flags) {
            Ok(()) => Ok(()),
            Err(error) if error.raw_os_error() == Some(87) => {
                let fallback_flags = if source_is_directory {
                    SYMBOLIC_LINK_FLAG_DIRECTORY
                } else {
                    SYMBOLIC_LINK_FLAGS(0)
                };
                match create_windows_symlink(source_path, link_path, fallback_flags) {
                    Ok(()) => Ok(()),
                    Err(error) if is_symlink_permission_error(&error) => {
                        create_elevated_symlink(source_path, link_path, source_is_directory)
                    }
                    Err(error) => Err(error),
                }
            }
            Err(error) if is_symlink_permission_error(&error) => {
                create_elevated_symlink(source_path, link_path, source_is_directory)
            }
            Err(error) => Err(error),
        }
    }

    #[cfg(unix)]
    {
        let _ = source_is_directory;
        std::os::unix::fs::symlink(source_path, link_path)
    }

    #[cfg(not(any(windows, unix)))]
    {
        let _ = source_path;
        let _ = link_path;
        let _ = source_is_directory;
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Symbolic links are not supported on this platform",
        ))
    }
}

fn create_hardlink(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> std::io::Result<()> {
    if source_is_directory {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Hard links can only be created for files",
        ));
    }

    fs::hard_link(source_path, link_path)
}

#[cfg(windows)]
fn command_prompt_path(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\")
}

#[cfg(windows)]
fn command_prompt_quoted_path(path: &Path) -> String {
    let escaped_path = command_prompt_path(path)
        .replace('^', "^^")
        .replace('%', "^%");
    format!("\"{}\"", escaped_path)
}

#[cfg(windows)]
fn elevated_symlink_command(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> String {
    let mut parts = vec!["/C".to_string(), "mklink".to_string()];

    if source_is_directory {
        parts.push("/D".to_string());
    }

    parts.push(command_prompt_quoted_path(link_path));
    parts.push(command_prompt_quoted_path(source_path));
    parts.join(" ")
}

#[cfg(windows)]
fn create_elevated_symlink(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> std::io::Result<()> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, WAIT_OBJECT_0};
    use windows::Win32::System::Threading::{GetExitCodeProcess, WaitForSingleObject, INFINITE};
    use windows::Win32::UI::Shell::{
        ShellExecuteExW, SEE_MASK_NOASYNC, SEE_MASK_NOCLOSEPROCESS, SHELLEXECUTEINFOW,
    };
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let verb_wide: Vec<u16> = OsStr::new("runas")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let file_wide: Vec<u16> = OsStr::new("cmd.exe")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let parameters = elevated_symlink_command(source_path, link_path, source_is_directory);
    let parameters_wide: Vec<u16> = OsStr::new(&parameters)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
        shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        shell_execute_info.fMask = SEE_MASK_NOCLOSEPROCESS | SEE_MASK_NOASYNC;
        shell_execute_info.lpVerb = PCWSTR(verb_wide.as_ptr());
        shell_execute_info.lpFile = PCWSTR(file_wide.as_ptr());
        shell_execute_info.lpParameters = PCWSTR(parameters_wide.as_ptr());
        shell_execute_info.nShow = SW_SHOWNORMAL.0;

        if let Err(error) = ShellExecuteExW(&mut shell_execute_info) {
            return Err(std::io::Error::other(format!(
                "Administrator approval was cancelled or failed: {error}"
            )));
        }

        let wait_result = WaitForSingleObject(shell_execute_info.hProcess, INFINITE);
        if wait_result != WAIT_OBJECT_0 {
            _ = CloseHandle(shell_execute_info.hProcess);
            return Err(std::io::Error::other(
                "Failed waiting for elevated symbolic link creation",
            ));
        }

        let mut exit_code = 1u32;
        GetExitCodeProcess(shell_execute_info.hProcess, &mut exit_code)
            .map_err(|error| std::io::Error::other(error.to_string()))?;
        _ = CloseHandle(shell_execute_info.hProcess);

        if exit_code == 0 && link_path.exists() {
            Ok(())
        } else if exit_code == 0 {
            Err(std::io::Error::other(
                "Elevated symbolic link command finished but the link was not created",
            ))
        } else {
            Err(std::io::Error::other(format!(
                "Elevated symbolic link command failed with exit code {exit_code}"
            )))
        }
    }
}

#[cfg(windows)]
fn create_junction(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;

    if !source_is_directory {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "Junctions can only be created for folders",
        ));
    }

    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let command = format!(
        "mklink /J {} {}",
        command_prompt_quoted_path(link_path),
        command_prompt_quoted_path(source_path)
    );

    let output = std::process::Command::new("cmd")
        .args(["/D", "/V:OFF", "/C"])
        .arg(command)
        .creation_flags(CREATE_NO_WINDOW)
        .output()?;

    if output.status.success() {
        return Ok(());
    }

    let stderr_text = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout_text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let message = if stderr_text.is_empty() {
        stdout_text
    } else {
        stderr_text
    };

    Err(std::io::Error::other(if message.is_empty() {
        "Failed to create junction".to_string()
    } else {
        message
    }))
}

#[cfg(not(windows))]
fn create_junction(
    source_path: &Path,
    link_path: &Path,
    source_is_directory: bool,
) -> std::io::Result<()> {
    let _ = source_path;
    let _ = link_path;
    let _ = source_is_directory;
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Junctions are only supported on Windows",
    ))
}

#[cfg(windows)]
fn create_shortcut(source_path: &Path, shortcut_path: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink};

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninitialize = coinit_result.is_ok();

        let result = (|| -> windows::core::Result<()> {
            let shell_link: IShellLinkW = CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)?;
            let source_path_wide: Vec<u16> = source_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            shell_link.SetPath(PCWSTR(source_path_wide.as_ptr()))?;

            if let Some(parent_path) = source_path.parent() {
                let parent_path_wide: Vec<u16> = parent_path
                    .as_os_str()
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                shell_link.SetWorkingDirectory(PCWSTR(parent_path_wide.as_ptr()))?;
            }

            let persist_file: IPersistFile = shell_link.cast()?;
            let shortcut_path_wide: Vec<u16> = shortcut_path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            persist_file.Save(PCWSTR(shortcut_path_wide.as_ptr()), true)?;
            Ok(())
        })();

        if needs_uninitialize {
            CoUninitialize();
        }

        result.map_err(|error| std::io::Error::other(error.to_string()))
    }
}

#[cfg(target_os = "macos")]
fn applescript_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n");
    format!("\"{escaped}\"")
}

#[cfg(target_os = "macos")]
fn create_shortcut(source_path: &Path, shortcut_path: &Path) -> std::io::Result<()> {
    let destination_directory = shortcut_path.parent().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid shortcut path")
    })?;
    let shortcut_name = shortcut_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid shortcut name")
        })?;
    let script = format!(
        "tell application \"Finder\" to make alias file to POSIX file {} at POSIX file {} with properties {{name:{}}}",
        applescript_string(&source_path.to_string_lossy()),
        applescript_string(&destination_directory.to_string_lossy()),
        applescript_string(shortcut_name),
    );
    let output = std::process::Command::new("osascript")
        .args(["-e", &script])
        .output()?;

    if output.status.success() {
        return Ok(());
    }

    let stderr_text = String::from_utf8_lossy(&output.stderr).trim().to_string();
    Err(std::io::Error::new(
        std::io::ErrorKind::Other,
        if stderr_text.is_empty() {
            "Failed to create alias".to_string()
        } else {
            stderr_text
        },
    ))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn percent_encode_file_url_path(path: &str) -> String {
    let mut encoded = String::new();

    for byte in path.as_bytes() {
        match *byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'/' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(*byte as char);
            }
            _ => {
                encoded.push_str(&format!("%{byte:02X}"));
            }
        }
    }

    encoded
}

#[cfg(all(unix, not(target_os = "macos")))]
fn desktop_entry_value(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace('\r', "")
}

#[cfg(all(unix, not(target_os = "macos")))]
fn create_shortcut(source_path: &Path, shortcut_path: &Path) -> std::io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    let source_name = source_file_name(source_path);
    let source_url = format!(
        "file://{}",
        percent_encode_file_url_path(&source_path.to_string_lossy())
    );
    let icon_name = if source_path.is_dir() {
        "folder"
    } else {
        "text-x-generic"
    };
    let desktop_entry = format!(
        "[Desktop Entry]\nType=Link\nName={}\nURL={}\nIcon={}\n",
        desktop_entry_value(&source_name),
        source_url,
        icon_name,
    );

    fs::write(shortcut_path, desktop_entry)?;
    fs::set_permissions(shortcut_path, fs::Permissions::from_mode(0o755))?;
    Ok(())
}

#[cfg(not(any(windows, unix)))]
fn create_shortcut(source_path: &Path, shortcut_path: &Path) -> std::io::Result<()> {
    let _ = source_path;
    let _ = shortcut_path;
    Err(std::io::Error::new(
        std::io::ErrorKind::Unsupported,
        "Shortcuts are not supported on this platform",
    ))
}

fn create_single_link(
    source_path: &Path,
    link_path: &Path,
    link_kind: LinkCreationKind,
    source_is_directory: bool,
) -> std::io::Result<()> {
    match link_kind {
        LinkCreationKind::Symlink => create_symlink(source_path, link_path, source_is_directory),
        LinkCreationKind::Shortcut => create_shortcut(source_path, link_path),
        LinkCreationKind::Hardlink => create_hardlink(source_path, link_path, source_is_directory),
        LinkCreationKind::Junction => create_junction(source_path, link_path, source_is_directory),
    }
}

fn create_links_impl(
    source_paths: Vec<String>,
    destination_path: String,
    link_kind: LinkCreationKind,
) -> Result<CreateLinksResult, String> {
    let destination_directory = Path::new(&destination_path);

    if !destination_directory.is_dir() {
        return Err("Destination is not a directory".to_string());
    }

    let mut reserved_paths = HashSet::new();
    let mut created_paths = Vec::new();
    let mut failed_items = Vec::new();

    for source_path_string in source_paths {
        let source_path = Path::new(&source_path_string);
        let source_metadata = match fs::metadata(source_path) {
            Ok(metadata) => metadata,
            Err(error) => {
                failed_items.push(CreateLinkFailure {
                    source_path: source_path_string,
                    error: error.to_string(),
                });
                continue;
            }
        };
        let base_name = base_destination_name(source_path, link_kind);
        let link_path =
            resolve_available_destination(destination_directory, &base_name, &mut reserved_paths);

        match create_single_link(source_path, &link_path, link_kind, source_metadata.is_dir()) {
            Ok(()) => created_paths.push(normalize_path(&link_path.to_string_lossy())),
            Err(error) => failed_items.push(CreateLinkFailure {
                source_path: source_path_string,
                error: error.to_string(),
            }),
        }
    }

    Ok(CreateLinksResult {
        success: !created_paths.is_empty() && failed_items.is_empty(),
        created_paths,
        failed_items,
    })
}

#[tauri::command]
pub async fn create_links(
    source_paths: Vec<String>,
    destination_path: String,
    link_kind: LinkCreationKind,
) -> Result<CreateLinksResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        create_links_impl(source_paths, destination_path, link_kind)
    })
    .await
    .map_err(|join_error| format!("Failed to create links: {join_error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::tempdir;

    #[test]
    fn indexes_file_names_before_extension() {
        assert_eq!(indexed_file_name("photo.jpg", 0), "photo.jpg");
        assert_eq!(indexed_file_name("photo.jpg", 1), "photo 2.jpg");
        assert_eq!(indexed_file_name(".env", 1), ".env 2");
    }

    #[test]
    fn reserves_duplicate_destination_names_in_same_batch() {
        let temp = tempdir().unwrap();
        let first = resolve_available_destination(temp.path(), "file.txt", &mut HashSet::new());
        let mut reserved = HashSet::new();
        reserved.insert(normalize_path(&first.to_string_lossy()));

        let second = resolve_available_destination(temp.path(), "file.txt", &mut reserved);

        assert_eq!(first.file_name().unwrap(), "file.txt");
        assert_eq!(second.file_name().unwrap(), "file 2.txt");
    }

    #[cfg(unix)]
    #[test]
    fn skips_broken_symlink_destination_names() {
        let temp = tempdir().unwrap();
        let occupied_path = temp.path().join("file.txt");
        let missing_target_path = temp.path().join("missing-target.txt");
        std::os::unix::fs::symlink(&missing_target_path, &occupied_path).unwrap();

        let next_path =
            resolve_available_destination(temp.path(), "file.txt", &mut HashSet::new());

        assert_eq!(next_path.file_name().unwrap(), "file 2.txt");
    }

    #[test]
    fn hardlink_creation_rejects_directories() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("source");
        let link = temp.path().join("link");
        fs::create_dir(&source).unwrap();

        let error = create_hardlink(&source, &link, true).unwrap_err();

        assert_eq!(error.kind(), std::io::ErrorKind::Unsupported);
    }

    #[test]
    fn creates_file_hardlink() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("source.txt");
        let link = temp.path().join("link.txt");
        fs::File::create(&source)
            .unwrap()
            .write_all(b"hello")
            .unwrap();

        create_hardlink(&source, &link, false).unwrap();

        assert_eq!(fs::read_to_string(link).unwrap(), "hello");
    }

    #[cfg(windows)]
    #[test]
    fn command_prompt_paths_use_backslashes() {
        assert_eq!(
            command_prompt_path(Path::new("C:/Users/aleks/Downloads/source")),
            "C:\\Users\\aleks\\Downloads\\source"
        );
    }

    #[cfg(windows)]
    #[test]
    fn command_prompt_quoted_paths_escape_percent_and_caret() {
        assert_eq!(
            command_prompt_quoted_path(Path::new("C:/Users/aleks/100% ^ source")),
            "\"C:\\Users\\aleks\\100^% ^^ source\""
        );
    }

    #[cfg(windows)]
    #[test]
    fn elevated_file_symlink_command_uses_mklink() {
        assert_eq!(
            elevated_symlink_command(
                Path::new("C:/Users/aleks/Downloads/source.txt"),
                Path::new("C:/Users/aleks/Desktop/source.txt"),
                false
            ),
            "/C mklink \"C:\\Users\\aleks\\Desktop\\source.txt\" \"C:\\Users\\aleks\\Downloads\\source.txt\""
        );
    }

    #[cfg(windows)]
    #[test]
    fn elevated_directory_symlink_command_uses_mklink_directory_flag() {
        assert_eq!(
            elevated_symlink_command(
                Path::new("C:/Users/aleks/Downloads/source"),
                Path::new("C:/Users/aleks/Desktop/source"),
                true
            ),
            "/C mklink /D \"C:\\Users\\aleks\\Desktop\\source\" \"C:\\Users\\aleks\\Downloads\\source\""
        );
    }

    #[test]
    fn create_links_reports_partial_success() {
        let temp = tempdir().unwrap();
        let source = temp.path().join("source.txt");
        let missing = temp.path().join("missing.txt");
        fs::File::create(&source)
            .unwrap()
            .write_all(b"hello")
            .unwrap();

        let result = create_links_impl(
            vec![
                source.to_string_lossy().to_string(),
                missing.to_string_lossy().to_string(),
            ],
            temp.path().to_string_lossy().to_string(),
            LinkCreationKind::Hardlink,
        )
        .unwrap();

        assert!(!result.success);
        assert_eq!(result.created_paths.len(), 1);
        assert_eq!(result.failed_items.len(), 1);
        assert_eq!(
            normalize_path(&result.failed_items[0].source_path),
            normalize_path(&missing.to_string_lossy())
        );
    }
}
