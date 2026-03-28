// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use tauri::Emitter;

use super::binaries::get_shared_binaries_dir;
use super::paths::{canonicalize_path, ensure_path_within_roots, get_extension_dir};
use super::security::authorize_extension_caller;
use super::state::{next_task_id, COMMAND_EXTENSION_MAP, COMMAND_PIDS, COMMAND_TASKS};
use super::types::{ExtensionCommandComplete, ExtensionCommandProgress, ExtensionCommandResult};

#[cfg(unix)]
fn terminate_process_tree(pid: u32) -> bool {
    let neg_result = unsafe { libc::kill(-(pid as i32), libc::SIGINT) };
    if neg_result == 0 {
        log::info!("Sent SIGINT to process group -{}", pid);
        return true;
    }

    let pos_result = unsafe { libc::kill(pid as i32, libc::SIGINT) };
    if pos_result == 0 {
        log::info!("Sent SIGINT to process {}", pid);
        return true;
    }

    log::warn!("Failed to send SIGINT to process {}", pid);
    false
}

#[cfg(windows)]
fn terminate_process_tree(pid: u32) -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    log::info!("Force terminating process tree for PID {}", pid);

    let result = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    match result {
        Ok(output) => {
            log::info!(
                "taskkill for PID {}: exit={}, stdout={}, stderr={}",
                pid,
                output.status.success(),
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            output.status.success()
        }
        Err(error) => {
            log::error!("Failed to run taskkill for PID {}: {}", pid, error);
            false
        }
    }
}

pub fn terminate_all_extension_processes(extension_id: &str) {
    let task_ids: Vec<String> = COMMAND_EXTENSION_MAP
        .lock()
        .map(|map| {
            map.iter()
                .filter(|(_, ext_id)| ext_id.as_str() == extension_id)
                .map(|(task_id, _)| task_id.clone())
                .collect()
        })
        .unwrap_or_default();

    for task_id in &task_ids {
        let pid = COMMAND_PIDS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));

        if let Some(pid) = pid {
            log::info!(
                "Terminating process PID {} (task {}) for extension {}",
                pid,
                task_id,
                extension_id
            );
            terminate_process_tree(pid);
        }

        let _ = COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));

        let _ = COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(task_id));
    }

    if !task_ids.is_empty() {
        log::info!(
            "Terminated {} processes for extension {}",
            task_ids.len(),
            extension_id
        );
    }
}

fn is_bare_command_name(command_path: &str) -> bool {
    !command_path.contains('/') && !command_path.contains('\\') && !command_path.is_empty()
}

fn resolve_from_system_path(command_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var("PATH").unwrap_or_default();
    let separator = if cfg!(windows) { ';' } else { ':' };

    let extensions: Vec<&str> = if cfg!(windows) {
        vec!["", ".exe", ".cmd", ".bat", ".com"]
    } else {
        vec![""]
    };

    for dir in path_var.split(separator) {
        let dir_path = PathBuf::from(dir);
        for ext in &extensions {
            let full_path = dir_path.join(format!("{}{}", command_name, ext));
            if full_path.exists() && full_path.is_file() {
                return Some(full_path);
            }
        }
    }

    None
}

fn build_path_with_extension_binaries(
    extension_dir: &std::path::Path,
    command_path: &std::path::Path,
) -> String {
    let separator = if cfg!(windows) { ";" } else { ":" };
    let current_path = std::env::var("PATH").unwrap_or_default();
    let mut path_parts: Vec<String> = Vec::new();

    if let Some(command_parent) = command_path.parent() {
        path_parts.push(command_parent.to_string_lossy().to_string());
    }

    let bin_dir = extension_dir.join("bin");
    if bin_dir.exists() && bin_dir.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&bin_dir) {
            for entry in entries.filter_map(|entry| entry.ok()) {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    path_parts.push(entry_path.to_string_lossy().to_string());
                }
            }
        }
    }

    if !current_path.is_empty() {
        path_parts.push(current_path);
    }

    path_parts.join(separator)
}

struct ResolvedExtensionCommand {
    extension_dir: PathBuf,
    command_path: PathBuf,
    is_system_command: bool,
}

#[cfg(unix)]
fn ensure_command_is_executable(command_path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut permissions = std::fs::metadata(command_path)
        .map_err(|error| format!("Failed to read command metadata: {}", error))?
        .permissions();
    if permissions.mode() & 0o111 == 0 {
        permissions.set_mode(0o755);
        std::fs::set_permissions(command_path, permissions)
            .map_err(|error| format!("Failed to set command permissions: {}", error))?;
    }

    Ok(())
}

#[cfg(not(unix))]
fn ensure_command_is_executable(_command_path: &Path) -> Result<(), String> {
    Ok(())
}

fn resolve_extension_command(
    app_handle: &tauri::AppHandle,
    extension_id: &str,
    command_path: &str,
) -> Result<ResolvedExtensionCommand, String> {
    let extension_dir = get_extension_dir(app_handle, extension_id)?;
    let normalized_extension_dir = canonicalize_path(&extension_dir, "extension dir")?;

    let shared_binaries_dir = get_shared_binaries_dir(app_handle)?;
    let normalized_shared_dir = canonicalize_path(&shared_binaries_dir, "shared binaries dir")?;

    let resolved_path = {
        let candidate = PathBuf::from(command_path);
        if candidate.is_absolute() {
            Some(candidate)
        } else {
            let local = extension_dir.join(command_path);
            if local.exists() {
                Some(local)
            } else {
                None
            }
        }
    };

    let (resolved_command_path, is_system_command) = if let Some(local_path) = resolved_path {
        let normalized = canonicalize_path(&local_path, "command path")?;
        ensure_path_within_roots(
            &normalized,
            &[&normalized_extension_dir, &normalized_shared_dir],
            "Access denied: command is outside allowed directories",
        )?;

        ensure_command_is_executable(&normalized)?;
        (normalized, false)
    } else if is_bare_command_name(command_path) {
        if let Some(system_path) = resolve_from_system_path(command_path) {
            (system_path, true)
        } else {
            return Err(format!(
                "Command '{}' not found in extension directory or system PATH",
                command_path
            ));
        }
    } else {
        return Err(format!("Command path does not exist: {}", command_path));
    };

    Ok(ResolvedExtensionCommand {
        extension_dir,
        command_path: resolved_command_path,
        is_system_command,
    })
}

pub async fn run_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
    caller_extension_id: Option<String>,
) -> Result<ExtensionCommandResult, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let resolved_command = resolve_extension_command(&app_handle, &extension_id, &command_path)?;

    let command_path_clone = resolved_command.command_path.clone();
    let args_clone = args.clone();
    let enhanced_path = if resolved_command.is_system_command {
        std::env::var("PATH").unwrap_or_default()
    } else {
        build_path_with_extension_binaries(
            &resolved_command.extension_dir,
            &resolved_command.command_path,
        )
    };

    let output = tauri::async_runtime::spawn_blocking(move || {
        let mut command = Command::new(command_path_clone);
        command.args(args_clone).env("PATH", enhanced_path);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        command.output()
    })
    .await
    .map_err(|error| format!("Failed to run command: {}", error))?
    .map_err(|error| format!("Command execution failed: {}", error))?;

    Ok(ExtensionCommandResult {
        code: output.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    })
}

pub async fn start_extension_command(
    app_handle: tauri::AppHandle,
    extension_id: String,
    command_path: String,
    args: Vec<String>,
    caller_extension_id: Option<String>,
) -> Result<String, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;
    let resolved_command = resolve_extension_command(&app_handle, &extension_id, &command_path)?;

    let enhanced_path = if resolved_command.is_system_command {
        std::env::var("PATH").unwrap_or_default()
    } else {
        build_path_with_extension_binaries(
            &resolved_command.extension_dir,
            &resolved_command.command_path,
        )
    };

    let mut command = Command::new(&resolved_command.command_path);
    command.args(args);
    command.env("PATH", enhanced_path);
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("Command execution failed: {}", error))?;

    let pid = child.id();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let task_id = next_task_id();
    log::info!("Started command with task_id: {}, PID: {}", task_id, pid);

    let child_handle = Arc::new(Mutex::new(child));

    COMMAND_TASKS
        .lock()
        .map_err(|_| "Failed to lock command tasks".to_string())?
        .insert(task_id.clone(), child_handle.clone());

    COMMAND_PIDS
        .lock()
        .map_err(|_| "Failed to lock command pids".to_string())?
        .insert(task_id.clone(), pid);

    COMMAND_EXTENSION_MAP
        .lock()
        .map_err(|_| "Failed to lock extension map".to_string())?
        .insert(task_id.clone(), extension_id.clone());

    let app_handle_clone = app_handle.clone();
    let task_id_stdout = task_id.clone();
    let stdout_buffer = Arc::new(Mutex::new(String::new()));
    let stderr_buffer = Arc::new(Mutex::new(String::new()));

    if let Some(stdout_reader) = stdout {
        let app_handle_clone = app_handle_clone.clone();
        let stdout_buffer_clone = stdout_buffer.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout_reader);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) => value,
                    Err(_) => break,
                };
                let _ = app_handle_clone.emit(
                    "extension-command-progress",
                    ExtensionCommandProgress {
                        task_id: task_id_stdout.clone(),
                        line: line.clone(),
                        is_stderr: false,
                    },
                );
                if let Ok(mut buffer) = stdout_buffer_clone.lock() {
                    buffer.push_str(&line);
                    buffer.push('\n');
                }
            }
        });
    }

    if let Some(stderr_reader) = stderr {
        let app_handle_clone = app_handle_clone.clone();
        let task_id_stderr = task_id.clone();
        let stderr_buffer_clone = stderr_buffer.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr_reader);
            for line in reader.lines() {
                let line = match line {
                    Ok(value) => value,
                    Err(_) => break,
                };
                let _ = app_handle_clone.emit(
                    "extension-command-progress",
                    ExtensionCommandProgress {
                        task_id: task_id_stderr.clone(),
                        line: line.clone(),
                        is_stderr: true,
                    },
                );
                if let Ok(mut buffer) = stderr_buffer_clone.lock() {
                    buffer.push_str(&line);
                    buffer.push('\n');
                }
            }
        });
    }

    let app_handle_complete = app_handle.clone();
    let task_id_complete = task_id.clone();
    std::thread::spawn(move || {
        let exit_code = match child_handle.lock() {
            Ok(mut child) => match child.wait() {
                Ok(status) => status.code().unwrap_or(-1),
                Err(_) => -1,
            },
            Err(_) => -1,
        };

        COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id_complete));

        COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id_complete));

        COMMAND_PIDS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id_complete));

        let stdout_output = stdout_buffer
            .lock()
            .map(|buffer| buffer.clone())
            .unwrap_or_default();
        let stderr_output = stderr_buffer
            .lock()
            .map(|buffer| buffer.clone())
            .unwrap_or_default();

        let _ = app_handle_complete.emit(
            "extension-command-complete",
            ExtensionCommandComplete {
                task_id: task_id_complete,
                code: exit_code,
                stdout: stdout_output,
                stderr: stderr_output,
            },
        );
    });

    Ok(task_id)
}

pub async fn cancel_extension_command(
    task_id: String,
    caller_extension_id: Option<String>,
) -> Result<(), String> {
    log::info!("cancel_extension_command called for task_id: {}", task_id);

    if let Some(caller_id) = caller_extension_id.as_deref() {
        let command_owner = COMMAND_EXTENSION_MAP
            .lock()
            .map_err(|_| "Failed to lock command ownership map".to_string())?
            .get(&task_id)
            .cloned();

        match command_owner {
            Some(owner_extension_id) => {
                authorize_extension_caller(Some(caller_id), &owner_extension_id)?
            }
            None => return Err("Access denied: command task not found".to_string()),
        }
    }

    let pid = COMMAND_PIDS
        .lock()
        .map_err(|_| "Failed to lock command pids".to_string())?
        .remove(&task_id);

    if let Some(pid) = pid {
        log::info!("Found PID: {}, force terminating...", pid);

        let kill_result = terminate_process_tree(pid);
        log::info!("terminate_process_tree returned: {}", kill_result);

        let _ = COMMAND_TASKS
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id));

        let _ = COMMAND_EXTENSION_MAP
            .lock()
            .ok()
            .and_then(|mut map| map.remove(&task_id));
    } else {
        log::warn!("No PID found for task_id: {}", task_id);
    }

    log::info!(
        "cancel_extension_command completed for task_id: {}",
        task_id
    );
    Ok(())
}
