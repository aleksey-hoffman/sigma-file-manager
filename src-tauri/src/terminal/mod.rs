// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod types;

pub use types::{GetAvailableTerminalsResult, OpenTerminalResult, TerminalInfo};

use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[tauri::command]
pub fn get_available_terminals() -> GetAvailableTerminalsResult {
    #[cfg(target_os = "windows")]
    {
        get_available_terminals_windows()
    }
    #[cfg(target_os = "macos")]
    {
        get_available_terminals_macos()
    }
    #[cfg(target_os = "linux")]
    {
        get_available_terminals_linux()
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        GetAvailableTerminalsResult {
            success: false,
            terminals: vec![],
            error: Some("Terminal detection is not supported on this platform".to_string()),
        }
    }
}

#[tauri::command]
pub fn open_terminal(
    directory_path: String,
    terminal_id: String,
    as_admin: bool,
) -> OpenTerminalResult {
    let path = Path::new(&directory_path);
    if !path.exists() || !path.is_dir() {
        return OpenTerminalResult {
            success: false,
            error: Some(format!("Directory not found: {}", directory_path)),
        };
    }

    #[cfg(target_os = "windows")]
    {
        open_terminal_windows(&directory_path, &terminal_id, as_admin)
    }
    #[cfg(target_os = "macos")]
    {
        open_terminal_macos(&directory_path, &terminal_id, as_admin)
    }
    #[cfg(target_os = "linux")]
    {
        open_terminal_linux(&directory_path, &terminal_id, as_admin)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = (directory_path, terminal_id, as_admin);
        OpenTerminalResult {
            success: false,
            error: Some("Opening terminal is not supported on this platform".to_string()),
        }
    }
}

#[tauri::command]
pub fn get_terminal_icons() -> HashMap<String, String> {
    #[cfg(target_os = "windows")]
    {
        get_terminal_icons_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        HashMap::new()
    }
}

fn command_exists(cmd: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        Command::new("where")
            .arg(cmd)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(cmd)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

// =============================================================================
// Windows
// =============================================================================

#[cfg(target_os = "windows")]
fn get_available_terminals_windows() -> GetAvailableTerminalsResult {
    if command_exists("wt") {
        if let Some(profiles) = read_wt_profiles() {
            if !profiles.is_empty() {
                return GetAvailableTerminalsResult {
                    success: true,
                    terminals: profiles,
                    error: None,
                };
            }
        }
    }

    let mut terminals = vec![
        TerminalInfo {
            id: "powershell".to_string(),
            name: "Windows PowerShell".to_string(),
            icon: None,
        },
        TerminalInfo {
            id: "cmd".to_string(),
            name: "Command Prompt".to_string(),
            icon: None,
        },
    ];

    if command_exists("pwsh") {
        terminals.push(TerminalInfo {
            id: "pwsh".to_string(),
            name: "PowerShell 7".to_string(),
            icon: None,
        });
    }

    GetAvailableTerminalsResult {
        success: true,
        terminals,
        error: None,
    }
}

#[cfg(target_os = "windows")]
fn read_wt_settings() -> Option<serde_json::Value> {
    let local_app_data = std::env::var("LOCALAPPDATA").ok()?;

    let settings_paths = [
        format!(
            "{}/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json",
            local_app_data
        ),
        format!(
            "{}/Packages/Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe/LocalState/settings.json",
            local_app_data
        ),
        format!(
            "{}/Packages/Microsoft.WindowsTerminalCanary_8wekyb3d8bbwe/LocalState/settings.json",
            local_app_data
        ),
        format!(
            "{}/Microsoft/Windows Terminal/settings.json",
            local_app_data
        ),
    ];

    let content = settings_paths
        .iter()
        .find_map(|settings_path| std::fs::read_to_string(settings_path).ok())?;

    parse_jsonc(&content)
}

#[cfg(target_os = "windows")]
fn get_visible_wt_profiles(settings: &serde_json::Value) -> Vec<(&serde_json::Value, String)> {
    let mut profiles = Vec::new();

    let profiles_list = match settings.get("profiles").and_then(|p| p.get("list")).and_then(|l| l.as_array()) {
        Some(list) => list,
        None => return profiles,
    };

    for profile in profiles_list {
        let profile_name = match profile.get("name").and_then(|v| v.as_str()) {
            Some(value) => value.to_string(),
            None => continue,
        };

        let is_hidden = profile
            .get("hidden")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        if is_hidden {
            continue;
        }

        profiles.push((profile, profile_name));
    }

    profiles
}

#[cfg(target_os = "windows")]
fn read_wt_profiles() -> Option<Vec<TerminalInfo>> {
    let settings = read_wt_settings()?;
    let visible_profiles = get_visible_wt_profiles(&settings);

    if visible_profiles.is_empty() {
        return None;
    }

    let terminals = visible_profiles
        .into_iter()
        .map(|(_profile, profile_name)| TerminalInfo {
            id: format!("wt-profile:{}", profile_name),
            name: profile_name,
            icon: None,
        })
        .collect();

    Some(terminals)
}

#[cfg(target_os = "windows")]
fn get_terminal_icons_windows() -> HashMap<String, String> {
    let mut icons = HashMap::new();

    if command_exists("wt") {
        if let Some(wt_icons) = resolve_all_wt_profile_icons() {
            return wt_icons;
        }
    }

    if let Some(icon) = resolve_executable_icon("powershell.exe") {
        icons.insert("powershell".to_string(), icon);
    }
    if let Some(icon) = resolve_executable_icon("cmd.exe") {
        icons.insert("cmd".to_string(), icon);
    }
    if let Some(icon) = resolve_executable_icon("pwsh.exe") {
        icons.insert("pwsh".to_string(), icon);
    }

    icons
}

#[cfg(target_os = "windows")]
fn resolve_all_wt_profile_icons() -> Option<HashMap<String, String>> {
    let settings = read_wt_settings()?;
    let visible_profiles = get_visible_wt_profiles(&settings);

    if visible_profiles.is_empty() {
        return None;
    }

    let mut icons = HashMap::new();

    for (profile, profile_name) in visible_profiles {
        let terminal_id = format!("wt-profile:{}", profile_name);
        if let Some(icon) = resolve_wt_profile_icon(profile) {
            icons.insert(terminal_id, icon);
        }
    }

    Some(icons)
}

#[cfg(target_os = "windows")]
fn resolve_wt_profile_icon(profile: &serde_json::Value) -> Option<String> {
    if let Some(icon_value) = profile.get("icon").and_then(|v| v.as_str()) {
        if !icon_value.starts_with("ms-appx") && !icon_value.starts_with("ms-appdata") {
            let expanded_icon_path = expand_env_vars(icon_value);
            if Path::new(&expanded_icon_path).exists() {
                if let Some(base64_icon) = load_image_as_base64(&expanded_icon_path) {
                    return Some(base64_icon);
                }
                if let Some(base64_icon) = get_executable_icon_base64(&expanded_icon_path) {
                    return Some(base64_icon);
                }
            }
        }
    }

    if let Some(commandline) = profile.get("commandline").and_then(|v| v.as_str()) {
        if let Some(exe_path) = find_executable_path(commandline) {
            if let Some(base64_icon) = get_executable_icon_base64(&exe_path) {
                return Some(base64_icon);
            }
        }
    }

    if let Some(source) = profile.get("source").and_then(|v| v.as_str()) {
        let source_exe = match source {
            "Windows.Terminal.PowershellCore" => Some("pwsh.exe"),
            "Windows.Terminal.Wsl" => Some("wsl.exe"),
            _ => None,
        };
        if let Some(exe_name) = source_exe {
            if let Some(base64_icon) = resolve_executable_icon(exe_name) {
                return Some(base64_icon);
            }
        }
    }

    if let Some(guid) = profile.get("guid").and_then(|v| v.as_str()) {
        let guid_exe = match guid {
            "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}" => Some("powershell.exe"),
            "{0caa0dad-35be-5f56-a8ff-afceeeaa6101}" => Some("cmd.exe"),
            _ => None,
        };
        if let Some(exe_name) = guid_exe {
            if let Some(base64_icon) = resolve_executable_icon(exe_name) {
                return Some(base64_icon);
            }
        }
    }

    let profile_name = profile
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let name_lower = profile_name.to_lowercase();

    if name_lower.contains("git bash") || name_lower.contains("git-bash") {
        let git_exe_paths = [
            "C:\\Program Files\\Git\\git-bash.exe",
            "C:\\Program Files (x86)\\Git\\git-bash.exe",
        ];
        for path in &git_exe_paths {
            if let Some(base64_icon) = get_executable_icon_base64(path) {
                return Some(base64_icon);
            }
        }
        if let Some(base64_icon) = resolve_executable_icon("git.exe") {
            return Some(base64_icon);
        }
    }

    let name_exe = if name_lower.contains("powershell") {
        if name_lower.contains("7")
            || name_lower.contains("core")
            || name_lower.contains("preview")
        {
            Some("pwsh.exe")
        } else {
            Some("powershell.exe")
        }
    } else if name_lower.contains("command prompt") || name_lower == "cmd" {
        Some("cmd.exe")
    } else if name_lower.contains("ubuntu")
        || name_lower.contains("debian")
        || name_lower.contains("kali")
        || name_lower.contains("suse")
        || name_lower.contains("fedora")
        || name_lower.contains("arch")
        || name_lower.contains("alpine")
        || name_lower.contains("linux")
        || name_lower.contains("wsl")
    {
        Some("wsl.exe")
    } else if name_lower.contains("developer") {
        Some("devenv.exe")
    } else {
        None
    };

    if let Some(exe_name) = name_exe {
        if let Some(base64_icon) = resolve_executable_icon(exe_name) {
            return Some(base64_icon);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn find_executable_path(commandline: &str) -> Option<String> {
    let trimmed = commandline.trim();

    if trimmed.starts_with('"') {
        let end_quote = trimmed[1..].find('"')?;
        let exe_token = &trimmed[1..1 + end_quote];
        let expanded = expand_env_vars(exe_token);

        let expanded_path = Path::new(&expanded);
        if expanded_path.is_absolute() && expanded_path.exists() {
            return Some(expanded);
        }

        return resolve_via_where(&expanded);
    }

    let parts: Vec<&str> = trimmed.split_whitespace().collect();
    for end_idx in 1..=parts.len() {
        let candidate = parts[..end_idx].join(" ");
        let expanded = expand_env_vars(&candidate);

        let expanded_path = Path::new(&expanded);
        if expanded_path.is_absolute() && expanded_path.exists() {
            return Some(expanded);
        }

        if expanded.ends_with(".exe")
            || expanded.ends_with(".cmd")
            || expanded.ends_with(".com")
        {
            if let Some(found) = resolve_via_where(&expanded) {
                return Some(found);
            }
        }
    }

    if let Some(first_token) = parts.first() {
        let expanded = expand_env_vars(first_token);
        return resolve_via_where(&expanded);
    }

    None
}

#[cfg(target_os = "windows")]
fn resolve_via_where(exe_name: &str) -> Option<String> {
    let output = Command::new("where").arg(exe_name).output().ok()?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        return stdout.lines().next().map(|line| line.trim().to_string());
    }
    None
}

#[cfg(target_os = "windows")]
fn resolve_executable_icon(exe_name: &str) -> Option<String> {
    let exe_path = find_executable_path(exe_name)?;
    get_executable_icon_base64(&exe_path)
}

#[cfg(target_os = "windows")]
fn get_executable_icon_base64(exe_path: &str) -> Option<String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    use file_icon_provider::get_file_icon;
    use image::codecs::png::PngEncoder;
    use image::ImageEncoder;

    let path = Path::new(exe_path);
    if !path.exists() {
        return None;
    }

    let icon = get_file_icon(path, 32).ok()?;
    if icon.width == 0 || icon.height == 0 {
        return None;
    }

    let expected_len = (icon.width * icon.height * 4) as usize;
    if icon.pixels.len() != expected_len {
        return None;
    }

    let mut png_bytes: Vec<u8> = Vec::new();
    let encoder = PngEncoder::new(&mut png_bytes);
    encoder
        .write_image(
            &icon.pixels,
            icon.width,
            icon.height,
            image::ExtendedColorType::Rgba8,
        )
        .ok()?;

    let base64_png = STANDARD.encode(&png_bytes);
    Some(format!("data:image/png;base64,{}", base64_png))
}

#[cfg(target_os = "windows")]
fn load_image_as_base64(file_path: &str) -> Option<String> {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;

    let data = std::fs::read(file_path).ok()?;

    if data.starts_with(&[0x89, 0x50, 0x4E, 0x47]) {
        Some(format!(
            "data:image/png;base64,{}",
            STANDARD.encode(&data)
        ))
    } else if data.starts_with(&[0xFF, 0xD8]) {
        Some(format!(
            "data:image/jpeg;base64,{}",
            STANDARD.encode(&data)
        ))
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
fn expand_env_vars(input: &str) -> String {
    let mut result = input.to_string();
    loop {
        let start = match result.find('%') {
            Some(pos) => pos,
            None => break,
        };
        let rest = &result[start + 1..];
        let end_offset = match rest.find('%') {
            Some(pos) => pos,
            None => break,
        };
        let var_name = &result[start + 1..start + 1 + end_offset];
        match std::env::var(var_name) {
            Ok(value) => {
                result = format!(
                    "{}{}{}",
                    &result[..start],
                    value,
                    &result[start + 2 + end_offset..]
                );
            }
            Err(_) => break,
        }
    }
    result
}

fn parse_jsonc(input: &str) -> Option<serde_json::Value> {
    if let Ok(value) = serde_json::from_str(input) {
        return Some(value);
    }

    let cleaned = strip_jsonc(input);
    serde_json::from_str(&cleaned).ok()
}

fn strip_jsonc(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut result = String::with_capacity(len);
    let mut idx = 0;
    let mut in_string = false;

    while idx < len {
        if in_string {
            result.push(chars[idx]);
            if chars[idx] == '\\' && idx + 1 < len {
                result.push(chars[idx + 1]);
                idx += 2;
                continue;
            }
            if chars[idx] == '"' {
                in_string = false;
            }
            idx += 1;
        } else if chars[idx] == '"' {
            in_string = true;
            result.push(chars[idx]);
            idx += 1;
        } else if chars[idx] == '/' && idx + 1 < len && chars[idx + 1] == '/' {
            idx += 2;
            while idx < len && chars[idx] != '\n' {
                idx += 1;
            }
        } else if chars[idx] == '/' && idx + 1 < len && chars[idx + 1] == '*' {
            idx += 2;
            while idx + 1 < len && !(chars[idx] == '*' && chars[idx + 1] == '/') {
                idx += 1;
            }
            if idx + 1 < len {
                idx += 2;
            }
        } else if chars[idx] == ',' {
            let mut lookahead = idx + 1;
            while lookahead < len && chars[lookahead].is_whitespace() {
                lookahead += 1;
            }
            if lookahead < len && (chars[lookahead] == ']' || chars[lookahead] == '}') {
                idx += 1;
            } else {
                result.push(chars[idx]);
                idx += 1;
            }
        } else {
            result.push(chars[idx]);
            idx += 1;
        }
    }

    result
}

#[cfg(target_os = "windows")]
fn open_terminal_windows(
    directory_path: &str,
    terminal_id: &str,
    as_admin: bool,
) -> OpenTerminalResult {
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let spawn_result = if terminal_id.starts_with("wt-profile:") {
        let profile_name = &terminal_id["wt-profile:".len()..];
        open_wt_profile(directory_path, profile_name, as_admin, CREATE_NO_WINDOW)
    } else if as_admin {
        open_standalone_admin(directory_path, terminal_id, CREATE_NO_WINDOW)
    } else {
        open_standalone_normal(directory_path, terminal_id, CREATE_NO_WINDOW)
    };

    match spawn_result {
        Ok(_) => OpenTerminalResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenTerminalResult {
            success: false,
            error: Some(format!("Failed to open terminal: {}", spawn_error)),
        },
    }
}

#[cfg(target_os = "windows")]
fn open_wt_profile(
    directory_path: &str,
    profile_name: &str,
    as_admin: bool,
    create_no_window: u32,
) -> std::io::Result<std::process::Child> {
    use std::os::windows::process::CommandExt;

    if as_admin {
        let escaped_path = directory_path.replace('\'', "''");
        let escaped_profile = profile_name.replace('\'', "''");
        let ps_script = format!(
            "Start-Process wt -ArgumentList 'new-tab -p \"{}\" -d \"{}\"' -Verb RunAs",
            escaped_profile, escaped_path
        );
        let encoded = encode_utf16_base64(&ps_script);
        Command::new("powershell")
            .args(["-EncodedCommand", &encoded])
            .creation_flags(create_no_window)
            .spawn()
    } else {
        Command::new("cmd")
            .args([
                "/C",
                "start",
                "",
                "wt",
                "new-tab",
                "-p",
                profile_name,
                "-d",
                directory_path,
            ])
            .creation_flags(create_no_window)
            .spawn()
    }
}

#[cfg(target_os = "windows")]
fn open_standalone_admin(
    directory_path: &str,
    terminal_id: &str,
    create_no_window: u32,
) -> std::io::Result<std::process::Child> {
    use std::os::windows::process::CommandExt;

    let escaped_path = directory_path.replace('\'', "''");

    let ps_script = match terminal_id {
        "cmd" => format!(
            "Start-Process cmd -ArgumentList '/k cd /d \"{}\"' -Verb RunAs",
            escaped_path
        ),
        "powershell" => {
            let inner_cmd = format!("Set-Location -LiteralPath '{}'", escaped_path);
            let inner_encoded = encode_utf16_base64(&inner_cmd);
            format!(
                "Start-Process powershell -ArgumentList '-NoExit -NoLogo -EncodedCommand {}' -Verb RunAs",
                inner_encoded
            )
        }
        "pwsh" => {
            let inner_cmd = format!("Set-Location -LiteralPath '{}'", escaped_path);
            let inner_encoded = encode_utf16_base64(&inner_cmd);
            format!(
                "Start-Process pwsh -ArgumentList '-NoExit -NoLogo -EncodedCommand {}' -Verb RunAs",
                inner_encoded
            )
        }
        "wt" => format!(
            "Start-Process wt -ArgumentList 'new-tab -d \"{}\"' -Verb RunAs",
            escaped_path
        ),
        _ => {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!("Unknown terminal: {}", terminal_id),
            ));
        }
    };

    let outer_encoded = encode_utf16_base64(&ps_script);
    Command::new("powershell")
        .args(["-EncodedCommand", &outer_encoded])
        .creation_flags(create_no_window)
        .spawn()
}

#[cfg(target_os = "windows")]
fn open_standalone_normal(
    directory_path: &str,
    terminal_id: &str,
    create_no_window: u32,
) -> std::io::Result<std::process::Child> {
    use std::os::windows::process::CommandExt;

    match terminal_id {
        "cmd" => Command::new("cmd")
            .args(["/C", "start", "cmd", "/k", "cd", "/d", directory_path])
            .creation_flags(create_no_window)
            .spawn(),
        "powershell" => Command::new("cmd")
            .args([
                "/C",
                "start",
                "powershell",
                "-NoExit",
                "-Command",
                &format!("Set-Location -LiteralPath '{}'", directory_path),
            ])
            .creation_flags(create_no_window)
            .spawn(),
        "pwsh" => Command::new("cmd")
            .args([
                "/C",
                "start",
                "pwsh",
                "-NoExit",
                "-Command",
                &format!("Set-Location -LiteralPath '{}'", directory_path),
            ])
            .creation_flags(create_no_window)
            .spawn(),
        "wt" => Command::new("cmd")
            .args(["/C", "start", "wt", "new-tab", "-d", directory_path])
            .creation_flags(create_no_window)
            .spawn(),
        _ => Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("Unknown terminal: {}", terminal_id),
        )),
    }
}

#[cfg(target_os = "windows")]
fn encode_utf16_base64(text: &str) -> String {
    use base64::engine::general_purpose::STANDARD;
    use base64::Engine;
    let utf16_bytes: Vec<u8> = text.encode_utf16().flat_map(|c| c.to_le_bytes()).collect();
    STANDARD.encode(&utf16_bytes)
}

// =============================================================================
// macOS
// =============================================================================

#[cfg(target_os = "macos")]
fn get_available_terminals_macos() -> GetAvailableTerminalsResult {
    let mut terminals = vec![TerminalInfo {
        id: "terminal".to_string(),
        name: "Terminal".to_string(),
        icon: None,
    }];

    let app_terminals = vec![
        ("iterm2", "iTerm2", "/Applications/iTerm.app"),
        ("warp", "Warp", "/Applications/Warp.app"),
    ];

    for (terminal_id, terminal_name, app_path) in app_terminals {
        if Path::new(app_path).exists() {
            terminals.push(TerminalInfo {
                id: terminal_id.to_string(),
                name: terminal_name.to_string(),
                icon: None,
            });
        }
    }

    let path_terminals = vec![("alacritty", "Alacritty"), ("kitty", "Kitty")];

    for (cmd, terminal_name) in path_terminals {
        if command_exists(cmd) {
            terminals.push(TerminalInfo {
                id: cmd.to_string(),
                name: terminal_name.to_string(),
                icon: None,
            });
        }
    }

    GetAvailableTerminalsResult {
        success: true,
        terminals,
        error: None,
    }
}

#[cfg(target_os = "macos")]
fn open_terminal_macos(
    directory_path: &str,
    terminal_id: &str,
    as_admin: bool,
) -> OpenTerminalResult {
    let escaped_path = directory_path.replace('\'', "'\\''");

    let spawn_result = if as_admin {
        let cd_and_sudo = format!("cd '{}' && sudo -s", escaped_path);

        match terminal_id {
            "terminal" => {
                let script = format!(
                    "tell application \"Terminal\"\n  activate\n  do script \"{}\"\nend tell",
                    cd_and_sudo.replace('"', "\\\"")
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            "iterm2" => {
                let script = format!(
                    "tell application \"iTerm2\"\n  activate\n  tell current window\n    create tab with default profile\n    tell current session\n      write text \"{}\"\n    end tell\n  end tell\nend tell",
                    cd_and_sudo.replace('"', "\\\"")
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .spawn(),
        }
    } else {
        match terminal_id {
            "terminal" => Command::new("open")
                .args(["-a", "Terminal", directory_path])
                .spawn(),
            "iterm2" => {
                let script = format!(
                    "tell application \"iTerm2\"\n  activate\n  tell current window\n    create tab with default profile\n    tell current session\n      write text \"cd '{}'\"\n    end tell\n  end tell\nend tell",
                    escaped_path
                );
                Command::new("osascript").arg("-e").arg(&script).spawn()
            }
            "warp" => Command::new("open")
                .args(["-a", "Warp", directory_path])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path])
                .spawn(),
            _ => {
                return OpenTerminalResult {
                    success: false,
                    error: Some(format!("Unknown terminal: {}", terminal_id)),
                };
            }
        }
    };

    match spawn_result {
        Ok(_) => OpenTerminalResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenTerminalResult {
            success: false,
            error: Some(format!("Failed to open terminal: {}", spawn_error)),
        },
    }
}

// =============================================================================
// Linux
// =============================================================================

#[cfg(target_os = "linux")]
fn get_available_terminals_linux() -> GetAvailableTerminalsResult {
    let known_terminals = vec![
        ("gnome-terminal", "GNOME Terminal"),
        ("konsole", "Konsole"),
        ("xfce4-terminal", "Xfce Terminal"),
        ("mate-terminal", "MATE Terminal"),
        ("lxterminal", "LXTerminal"),
        ("tilix", "Tilix"),
        ("terminator", "Terminator"),
        ("alacritty", "Alacritty"),
        ("kitty", "Kitty"),
        ("wezterm", "WezTerm"),
        ("foot", "Foot"),
        ("sakura", "Sakura"),
        ("xterm", "XTerm"),
    ];

    let mut terminals = Vec::new();

    for (cmd, terminal_name) in known_terminals {
        if command_exists(cmd) {
            terminals.push(TerminalInfo {
                id: cmd.to_string(),
                name: terminal_name.to_string(),
                icon: None,
            });
        }
    }

    GetAvailableTerminalsResult {
        success: true,
        terminals,
        error: None,
    }
}

#[cfg(target_os = "linux")]
fn open_terminal_linux(
    directory_path: &str,
    terminal_id: &str,
    as_admin: bool,
) -> OpenTerminalResult {
    let spawn_result = if as_admin {
        match terminal_id {
            "gnome-terminal" => Command::new("gnome-terminal")
                .args(["--working-directory", directory_path, "--", "sudo", "-s"])
                .spawn(),
            "konsole" => Command::new("konsole")
                .args(["--workdir", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            "xfce4-terminal" => Command::new("xfce4-terminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "mate-terminal" => Command::new("mate-terminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "lxterminal" => Command::new("lxterminal")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "tilix" => Command::new("tilix")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "terminator" => Command::new("terminator")
                .args(["--working-directory", directory_path, "-e", "sudo -s"])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path, "-e", "sudo", "-s"])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path, "sudo", "-s"])
                .spawn(),
            "wezterm" => Command::new("wezterm")
                .args(["start", "--cwd", directory_path, "--", "sudo", "-s"])
                .spawn(),
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .arg("-e")
                .arg("sudo -s")
                .spawn(),
        }
    } else {
        match terminal_id {
            "gnome-terminal" => Command::new("gnome-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "konsole" => Command::new("konsole")
                .args(["--workdir", directory_path])
                .spawn(),
            "xfce4-terminal" => Command::new("xfce4-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "mate-terminal" => Command::new("mate-terminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "lxterminal" => Command::new("lxterminal")
                .args(["--working-directory", directory_path])
                .spawn(),
            "tilix" => Command::new("tilix")
                .args(["--working-directory", directory_path])
                .spawn(),
            "terminator" => Command::new("terminator")
                .args(["--working-directory", directory_path])
                .spawn(),
            "alacritty" => Command::new("alacritty")
                .args(["--working-directory", directory_path])
                .spawn(),
            "kitty" => Command::new("kitty")
                .args(["--directory", directory_path])
                .spawn(),
            "wezterm" => Command::new("wezterm")
                .args(["start", "--cwd", directory_path])
                .spawn(),
            "foot" => Command::new("foot")
                .args(["--working-directory", directory_path])
                .spawn(),
            "xterm" => {
                let escaped_path = directory_path.replace('\'', "'\\''");
                Command::new("xterm")
                    .args([
                        "-e",
                        &format!("cd '{}' && exec $SHELL", escaped_path),
                    ])
                    .spawn()
            }
            _ => Command::new(terminal_id)
                .current_dir(directory_path)
                .spawn(),
        }
    };

    match spawn_result {
        Ok(_) => OpenTerminalResult {
            success: true,
            error: None,
        },
        Err(spawn_error) => OpenTerminalResult {
            success: false,
            error: Some(format!("Failed to open terminal: {}", spawn_error)),
        },
    }
}
