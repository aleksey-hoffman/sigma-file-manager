// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::command_exists;
use super::types::{OpenTerminalResult, TerminalErrorCode};
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, PartialEq, Eq)]
pub(super) struct CustomTerminalLaunch {
    pub program: String,
    pub args: Vec<String>,
    pub directory: String,
}

#[derive(Debug)]
enum PrepareError {
    CommandInvalid,
    ArgumentsInvalid,
    DirectoryNotFound(String),
    CommandNotFound,
}

impl PrepareError {
    fn into_result(self) -> OpenTerminalResult {
        match self {
            Self::CommandInvalid => OpenTerminalResult::failed_coded(
                TerminalErrorCode::CommandInvalid,
                "The custom terminal command is not valid.",
                true,
            ),
            Self::ArgumentsInvalid => OpenTerminalResult::failed_coded(
                TerminalErrorCode::ArgumentsInvalid,
                "The custom terminal arguments are not valid.",
                true,
            ),
            Self::DirectoryNotFound(path) => {
                OpenTerminalResult::failed_coded(TerminalErrorCode::DirectoryNotFound, path, false)
            }
            Self::CommandNotFound => OpenTerminalResult::failed_coded(
                TerminalErrorCode::CommandNotFound,
                "The custom terminal command was not found.",
                true,
            ),
        }
    }
}

#[derive(Debug)]
struct StartError {
    code: TerminalErrorCode,
    message: String,
    allow_fallback: bool,
}

impl StartError {
    #[cfg(any(target_os = "windows", target_os = "macos"))]
    fn cancelled() -> Self {
        Self {
            code: TerminalErrorCode::AdminCancelled,
            message: "Administrator approval was cancelled.".to_string(),
            allow_fallback: false,
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    fn unavailable() -> Self {
        Self {
            code: TerminalErrorCode::AdminUnavailable,
            message: "Opening this terminal as administrator is not available.".to_string(),
            allow_fallback: false,
        }
    }

    #[cfg(target_os = "macos")]
    fn not_found() -> Self {
        Self {
            code: TerminalErrorCode::CommandNotFound,
            message: "The custom terminal command was not found.".to_string(),
            allow_fallback: true,
        }
    }

    fn failed(message: impl Into<String>) -> Self {
        Self {
            code: TerminalErrorCode::OpenFailed,
            message: message.into(),
            allow_fallback: true,
        }
    }

    #[cfg(target_os = "macos")]
    fn failed_without_fallback(message: impl Into<String>) -> Self {
        Self {
            code: TerminalErrorCode::OpenFailed,
            message: message.into(),
            allow_fallback: false,
        }
    }

    fn into_result(self) -> OpenTerminalResult {
        OpenTerminalResult::failed_coded(self.code, self.message, self.allow_fallback)
    }
}

pub(super) fn custom_terminal_program_is_available(program: &str) -> bool {
    if program.is_empty() || contains_control_character(program) {
        return false;
    }

    let path = Path::new(program);
    if path.is_absolute() || program.contains('/') || program.contains('\\') {
        return path.is_file();
    }

    command_exists(program)
}

fn prepare_custom_terminal_launch(
    program: &str,
    args: &[String],
    directory_path: &str,
) -> Result<CustomTerminalLaunch, PrepareError> {
    if program.is_empty() || contains_control_character(program) {
        return Err(PrepareError::CommandInvalid);
    }

    if args
        .iter()
        .any(|argument| contains_control_character(argument))
    {
        return Err(PrepareError::ArgumentsInvalid);
    }

    if !Path::new(directory_path).is_dir() {
        return Err(PrepareError::DirectoryNotFound(directory_path.to_string()));
    }

    if !custom_terminal_program_is_available(program) {
        return Err(PrepareError::CommandNotFound);
    }

    Ok(CustomTerminalLaunch {
        program: program.to_string(),
        args: args.to_vec(),
        directory: directory_path.to_string(),
    })
}

pub(super) fn open_custom_terminal(
    directory_path: &str,
    program: &str,
    args: &[String],
    as_admin: bool,
) -> OpenTerminalResult {
    match prepare_custom_terminal_launch(program, args, directory_path) {
        Ok(launch) => start_custom_terminal(&launch, as_admin),
        Err(error) => error.into_result(),
    }
}

fn start_custom_terminal(launch: &CustomTerminalLaunch, as_admin: bool) -> OpenTerminalResult {
    let started = if as_admin {
        start_elevated(launch)
    } else {
        start_in_user_session(launch)
    };

    match started {
        Ok(()) => OpenTerminalResult::opened(),
        Err(error) => error.into_result(),
    }
}

fn start_in_user_session(launch: &CustomTerminalLaunch) -> Result<(), StartError> {
    spawn_user_session(launch)
        .map_err(|error| StartError::failed(format!("Failed to open terminal: {error}")))
}

#[cfg(target_os = "windows")]
fn spawn_user_session(launch: &CustomTerminalLaunch) -> std::io::Result<()> {
    let command_line = windows_custom_command_line(&launch.program, &launch.args);
    let mut command = Command::new(&command_line.program);

    if !command_line.parameters.is_empty() {
        command.raw_arg(&command_line.parameters);
    }

    command.current_dir(&launch.directory).spawn().map(|_| ())
}

#[cfg(not(target_os = "windows"))]
fn spawn_user_session(launch: &CustomTerminalLaunch) -> std::io::Result<()> {
    Command::new(&launch.program)
        .args(&launch.args)
        .current_dir(&launch.directory)
        .spawn()
        .map(|_| ())
}

fn contains_control_character(value: &str) -> bool {
    value
        .chars()
        .any(|character| character == '\0' || character == '\n' || character == '\r')
}

#[derive(Debug, PartialEq, Eq)]
#[cfg(any(test, target_os = "windows"))]
pub(super) struct WindowsCustomCommandLine {
    pub program: String,
    pub parameters: String,
}

#[derive(Clone, Copy)]
#[cfg(any(test, target_os = "windows"))]
enum WindowsShellKind {
    Cmd,
    Batch,
    Other,
}

#[cfg(any(test, target_os = "windows"))]
fn windows_shell_kind(program: &str) -> WindowsShellKind {
    let file_name = Path::new(program)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(program);
    let normalized = file_name.to_ascii_lowercase();

    if normalized == "cmd" || normalized == "cmd.exe" {
        WindowsShellKind::Cmd
    } else if normalized.ends_with(".bat") || normalized.ends_with(".cmd") {
        WindowsShellKind::Batch
    } else {
        WindowsShellKind::Other
    }
}

#[cfg(any(test, target_os = "windows"))]
fn escape_cmd_percent(value: &str) -> String {
    value.replace('%', "%%cd:~,%")
}

#[cfg(any(test, target_os = "windows"))]
fn join_cmd_arguments(args: &[String]) -> String {
    args.iter()
        .map(|argument| quote_windows_command_arg(&escape_cmd_percent(argument)))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(any(test, target_os = "windows"))]
fn cmd_switches(arguments: &str) -> String {
    if arguments.is_empty() {
        "/e:ON /v:OFF /d".to_string()
    } else {
        format!("/e:ON /v:OFF /d {arguments}")
    }
}

#[cfg(any(test, target_os = "windows"))]
fn batch_parameters(script: &str, args: &[String]) -> String {
    let mut payload = quote_windows_command_argument(&escape_cmd_percent(script), true);

    for argument in args {
        payload.push(' ');
        payload.push_str(&quote_windows_command_arg(&escape_cmd_percent(argument)));
    }

    format!("/e:ON /v:OFF /d /c \"{payload}\"")
}

#[cfg(any(test, target_os = "windows"))]
pub(super) fn windows_custom_command_line(
    program: &str,
    args: &[String],
) -> WindowsCustomCommandLine {
    match windows_shell_kind(program) {
        WindowsShellKind::Other => WindowsCustomCommandLine {
            program: program.to_string(),
            parameters: join_windows_command_args(args),
        },
        WindowsShellKind::Cmd => WindowsCustomCommandLine {
            program: program.to_string(),
            parameters: cmd_switches(&join_cmd_arguments(args)),
        },
        WindowsShellKind::Batch => WindowsCustomCommandLine {
            program: "cmd.exe".to_string(),
            parameters: batch_parameters(program, args),
        },
    }
}

#[cfg(any(test, target_os = "windows"))]
pub(super) fn quote_windows_command_arg(argument: &str) -> String {
    quote_windows_command_argument(argument, false)
}

#[cfg(any(test, target_os = "windows"))]
fn quote_windows_command_argument(argument: &str, force: bool) -> String {
    let needs_quotes = force
        || argument.is_empty()
        || argument.chars().any(|character| {
            matches!(
                character,
                ' ' | '\t'
                    | '\n'
                    | '\r'
                    | '"'
                    | '&'
                    | '|'
                    | '<'
                    | '>'
                    | '^'
                    | '%'
                    | '!'
                    | '('
                    | ')'
                    | ';'
            )
        });

    if !needs_quotes {
        return argument.to_string();
    }

    let mut quoted = String::from('"');
    let mut backslash_count = 0usize;

    for character in argument.chars() {
        match character {
            '\\' => {
                backslash_count += 1;
            }
            '"' => {
                quoted.push_str(&"\\".repeat(backslash_count * 2 + 1));
                quoted.push('"');
                backslash_count = 0;
            }
            _ => {
                if backslash_count > 0 {
                    quoted.push_str(&"\\".repeat(backslash_count));
                    backslash_count = 0;
                }
                quoted.push(character);
            }
        }
    }

    if backslash_count > 0 {
        quoted.push_str(&"\\".repeat(backslash_count * 2));
    }

    quoted.push('"');
    quoted
}

#[cfg(any(test, target_os = "windows"))]
pub(super) fn join_windows_command_args(args: &[String]) -> String {
    args.iter()
        .map(|argument| quote_windows_command_arg(argument))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(any(test, target_os = "macos"))]
const CUSTOM_TERMINAL_ADMIN_APPLESCRIPT: &str = r#"on run argv
  if (count of argv) < 2 then error "Missing program"
  set directoryPath to item 1 of argv
  set programPath to item 2 of argv
  set shellCommand to "cd " & quoted form of directoryPath & " && " & quoted form of programPath
  if (count of argv) > 2 then
    repeat with argIndex from 3 to (count of argv)
      set shellCommand to shellCommand & " " & quoted form of (item argIndex of argv)
    end repeat
  end if
  do shell script shellCommand with administrator privileges
end run"#;

#[cfg(target_os = "windows")]
fn start_elevated(launch: &CustomTerminalLaunch) -> Result<(), StartError> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{ShellExecuteExW, SEE_MASK_NOASYNC, SHELLEXECUTEINFOW};
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let command_line = windows_custom_command_line(&launch.program, &launch.args);
    let file_wide = wide_string(&command_line.program);
    let directory_wide = wide_string(&launch.directory);
    let parameters_wide = wide_string(&command_line.parameters);
    let verb_wide = wide_string("runas");

    unsafe {
        let mut shell_execute_info: SHELLEXECUTEINFOW = std::mem::zeroed();
        shell_execute_info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
        shell_execute_info.fMask = SEE_MASK_NOASYNC;
        shell_execute_info.lpVerb = PCWSTR(verb_wide.as_ptr());
        shell_execute_info.lpFile = PCWSTR(file_wide.as_ptr());
        shell_execute_info.lpDirectory = PCWSTR(directory_wide.as_ptr());
        shell_execute_info.nShow = SW_SHOWNORMAL.0;

        if !command_line.parameters.is_empty() {
            shell_execute_info.lpParameters = PCWSTR(parameters_wide.as_ptr());
        }

        match ShellExecuteExW(&mut shell_execute_info) {
            Ok(()) => Ok(()),
            Err(error) if is_elevation_cancelled(&error) => Err(StartError::cancelled()),
            Err(error) => Err(StartError::failed(format!(
                "Failed to open terminal: {error}"
            ))),
        }
    }
}

#[cfg(target_os = "windows")]
fn wide_string(value: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    OsStr::new(value)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}

#[cfg(target_os = "windows")]
fn is_elevation_cancelled(error: &windows::core::Error) -> bool {
    let code = error.code().0;
    code == 1223 || code == 0x8007_04C7u32 as i32
}

#[cfg(target_os = "macos")]
fn resolve_executable(program: &str) -> Result<String, StartError> {
    let path = Path::new(program);

    if path.is_absolute() || program.contains('/') {
        let canonical = std::fs::canonicalize(path).map_err(|_| StartError::not_found())?;

        if canonical.is_file() {
            return Ok(canonical.to_string_lossy().into_owned());
        }

        return Err(StartError::not_found());
    }

    let Some(path_var) = std::env::var_os("PATH") else {
        return Err(StartError::not_found());
    };

    for directory in std::env::split_paths(&path_var) {
        let candidate = directory.join(program);

        if !candidate.is_file() {
            continue;
        }

        let canonical = std::fs::canonicalize(&candidate).unwrap_or(candidate);
        return Ok(canonical.to_string_lossy().into_owned());
    }

    Err(StartError::not_found())
}

#[cfg(any(test, target_os = "macos"))]
fn osascript_was_cancelled(stderr: &[u8], stdout: &[u8]) -> bool {
    let details = format!(
        "{}{}",
        String::from_utf8_lossy(stderr),
        String::from_utf8_lossy(stdout)
    );
    details.contains("(-128)")
}

#[cfg(target_os = "macos")]
fn start_elevated(launch: &CustomTerminalLaunch) -> Result<(), StartError> {
    let program = resolve_executable(&launch.program)?;
    let output = Command::new("osascript")
        .arg("-e")
        .arg(CUSTOM_TERMINAL_ADMIN_APPLESCRIPT)
        .arg(&launch.directory)
        .arg(&program)
        .args(&launch.args)
        .output()
        .map_err(|error| {
            StartError::failed_without_fallback(format!("Failed to open terminal: {error}"))
        })?;

    if output.status.success() {
        return Ok(());
    }

    if osascript_was_cancelled(&output.stderr, &output.stdout) {
        return Err(StartError::cancelled());
    }

    let message = String::from_utf8_lossy(&output.stderr);
    let trimmed = message.trim();
    Err(StartError::failed_without_fallback(if trimmed.is_empty() {
        "Failed to open terminal.".to_string()
    } else {
        format!("Failed to open terminal: {trimmed}")
    }))
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn start_elevated(_launch: &CustomTerminalLaunch) -> Result<(), StartError> {
    Err(StartError::unavailable())
}

#[cfg(test)]
mod tests {
    use super::{
        custom_terminal_program_is_available, join_windows_command_args, osascript_was_cancelled,
        prepare_custom_terminal_launch, quote_windows_command_arg, windows_custom_command_line,
        PrepareError, TerminalErrorCode, CUSTOM_TERMINAL_ADMIN_APPLESCRIPT,
    };
    use std::fs;

    #[test]
    fn keeps_a_path_with_shell_metacharacters_as_one_argument() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let program_path = temp_dir.path().join("terminal-bin");
        fs::write(&program_path, b"").expect("write program");
        let directory = temp_dir.path().join("My Files; $(rm)");
        fs::create_dir(&directory).expect("create directory");
        let directory_path = directory.to_str().expect("utf8 directory");
        let args = vec![
            "--working-directory".to_string(),
            directory_path.to_string(),
        ];

        let launch = prepare_custom_terminal_launch(
            program_path.to_str().expect("utf8 program"),
            &args,
            directory_path,
        )
        .expect("prepare launch");

        assert_eq!(launch.args, args);
        assert_eq!(launch.directory, directory_path);
        assert_eq!(launch.args.len(), 2);
    }

    #[test]
    fn rejects_a_missing_program_and_a_missing_directory() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let directory_path = temp_dir.path().to_str().expect("utf8 directory");
        let missing_program =
            prepare_custom_terminal_launch("/tmp/sigma-missing-terminal-bin", &[], directory_path)
                .expect_err("missing program");
        let missing_program = missing_program.into_result();
        assert_eq!(
            missing_program.error_code,
            Some(TerminalErrorCode::CommandNotFound)
        );
        assert!(missing_program.allow_fallback);

        let program_path = temp_dir.path().join("terminal-bin");
        fs::write(&program_path, b"").expect("write program");
        let missing_directory = prepare_custom_terminal_launch(
            program_path.to_str().expect("utf8 program"),
            &[],
            "/tmp/sigma-missing-terminal-dir",
        )
        .expect_err("missing directory");
        let missing_directory = missing_directory.into_result();
        assert_eq!(
            missing_directory.error_code,
            Some(TerminalErrorCode::DirectoryNotFound)
        );
        assert!(!missing_directory.allow_fallback);
        assert_eq!(
            missing_directory.error.as_deref(),
            Some("/tmp/sigma-missing-terminal-dir")
        );
    }

    #[test]
    fn rejects_a_directory_and_a_command_with_a_newline() {
        let temp_dir = tempfile::tempdir().expect("create temp dir");
        let directory_path = temp_dir.path().to_str().expect("utf8 directory");
        let directory_program = prepare_custom_terminal_launch(directory_path, &[], directory_path)
            .expect_err("directory program");
        assert!(matches!(directory_program, PrepareError::CommandNotFound));

        let newline_program = prepare_custom_terminal_launch("kitty\nrm", &[], directory_path)
            .expect_err("newline program");
        assert!(matches!(newline_program, PrepareError::CommandInvalid));
    }

    #[test]
    fn finds_a_program_on_path_and_rejects_an_unknown_name() {
        #[cfg(windows)]
        assert!(custom_terminal_program_is_available("cmd"));
        #[cfg(not(windows))]
        assert!(custom_terminal_program_is_available("sh"));
        assert!(!custom_terminal_program_is_available(
            "sigma-file-manager-missing-terminal"
        ));
    }

    #[test]
    fn windows_command_line_keeps_cmd_directories_intact() {
        let ampersand = windows_custom_command_line(
            "cmd.exe",
            &[
                "/k".to_string(),
                "cd".to_string(),
                "/d".to_string(),
                "notes&calc.exe".to_string(),
            ],
        );
        assert_eq!(ampersand.program, "cmd.exe");
        assert_eq!(
            ampersand.parameters,
            "/e:ON /v:OFF /d /k cd /d \"notes&calc.exe\""
        );

        let percent = windows_custom_command_line(
            "cmd.exe",
            &[
                "/k".to_string(),
                "cd".to_string(),
                "/d".to_string(),
                "100%done".to_string(),
            ],
        );
        assert_eq!(percent.program, "cmd.exe");
        assert_eq!(
            percent.parameters,
            "/e:ON /v:OFF /d /k cd /d \"100%%cd:~,%done\""
        );

        let batch = windows_custom_command_line("open.bat", &["100%done".to_string()]);
        assert_eq!(batch.program, "cmd.exe");
        assert_eq!(
            batch.parameters,
            "/e:ON /v:OFF /d /c \"\"open.bat\" \"100%%cd:~,%done\"\""
        );

        let other = windows_custom_command_line(
            "alacritty",
            &[
                "--working-directory".to_string(),
                "notes&calc.exe".to_string(),
                "100%done".to_string(),
            ],
        );
        assert_eq!(other.program, "alacritty");
        assert_eq!(
            other.parameters,
            "--working-directory \"notes&calc.exe\" \"100%done\""
        );
    }

    #[test]
    fn quotes_windows_arguments_without_splitting_on_shell_metacharacters() {
        assert_eq!(
            quote_windows_command_arg("--working-directory"),
            "--working-directory"
        );
        assert_eq!(quote_windows_command_arg("a b"), "\"a b\"");
        assert_eq!(
            quote_windows_command_arg("say \"hi\""),
            "\"say \\\"hi\\\"\""
        );
        assert_eq!(quote_windows_command_arg("a b\\"), "\"a b\\\\\"");
        assert_eq!(
            quote_windows_command_arg("C:\\temp&calc.exe"),
            "\"C:\\temp&calc.exe\""
        );
        assert_eq!(
            join_windows_command_args(&[
                "--working-directory".to_string(),
                "C:\\My Files; calc.exe".to_string(),
            ]),
            "--working-directory \"C:\\My Files; calc.exe\""
        );
    }

    #[test]
    fn admin_applescript_quotes_paths_instead_of_interpolating_them() {
        assert!(CUSTOM_TERMINAL_ADMIN_APPLESCRIPT.contains("quoted form of"));
        assert!(!CUSTOM_TERMINAL_ADMIN_APPLESCRIPT.contains("{directory}"));
        assert!(!CUSTOM_TERMINAL_ADMIN_APPLESCRIPT.contains("format!"));
        assert!(osascript_was_cancelled(
            b"0:128: execution error: User canceled. (-128)",
            b""
        ));
        assert!(!osascript_was_cancelled(
            b"Failed to open terminal: notes-128",
            b""
        ));
    }
}
