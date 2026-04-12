// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(not(windows))]
use std::fs;

use super::types::NetworkShareParams;

pub fn mount_network_share(params: NetworkShareParams) -> Result<String, String> {
    #[cfg(windows)]
    {
        mount_network_share_windows(&params)
    }

    #[cfg(not(windows))]
    {
        let mount_base = {
            #[cfg(target_os = "macos")]
            {
                "/Volumes"
            }
            #[cfg(target_os = "linux")]
            {
                "/tmp"
            }
        };

        let mount_point = format!("{}/{}", mount_base, params.mount_name);

        fs::create_dir_all(&mount_point)
            .map_err(|dir_error| format!("Failed to create mount point: {}", dir_error))?;

        let result = match params.protocol.as_str() {
            "sshfs" => mount_sshfs(&params, &mount_point),
            "nfs" => mount_nfs(&params, &mount_point),
            "smb" => mount_smb(&params, &mount_point),
            unknown => Err(format!("Unknown protocol: {}", unknown)),
        };

        if result.is_err() {
            let _ = fs::remove_dir(&mount_point);
        }

        result.map(|_| mount_point)
    }
}

#[cfg(windows)]
fn mount_network_share_windows(params: &NetworkShareParams) -> Result<String, String> {
    match params.protocol.as_str() {
        "smb" => {
            let unc_path = format!("\\\\{}\\{}", params.host, params.remote_path);

            let mut args = vec!["use", "*", &unc_path];

            let password_arg;
            if let Some(ref password) = params.password {
                password_arg = format!("/user:{}", params.username.as_deref().unwrap_or(""));
                args.push(&password_arg);
                args.push(password);
            }

            let output = std::process::Command::new("net")
                .args(&args)
                .output()
                .map_err(|run_error| format!("Failed to run 'net use': {}", run_error))?;

            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let drive_letter = stdout
                    .lines()
                    .find(|line| line.contains("assigned"))
                    .and_then(|line| line.split_whitespace().last())
                    .unwrap_or("")
                    .to_string();
                Ok(drive_letter)
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                Err(format!("net use failed: {}", stderr.trim()))
            }
        }
        "sshfs" => {
            Err("SSHFS on Windows requires WinFSP and sshfs-win. Install from https://github.com/winfsp/sshfs-win".to_string())
        }
        "nfs" => {
            Err("NFS on Windows requires 'Services for NFS' Windows feature to be enabled".to_string())
        }
        unknown => Err(format!("Unknown protocol: {}", unknown)),
    }
}

#[cfg(not(windows))]
fn mount_sshfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let username = params.username.as_deref().unwrap_or("root");
    let port = params.port.unwrap_or(22);
    let source = format!("{}@{}:{}", username, params.host, params.remote_path);

    let mut command = std::process::Command::new("sshfs");
    command.args([
        &source,
        mount_point,
        "-p",
        &port.to_string(),
        "-o",
        "StrictHostKeyChecking=no",
        "-o",
        "ServerAliveInterval=15",
    ]);

    if params.password.is_some() {
        command.args(["-o", "password_stdin"]);
    }

    let output = if let Some(ref password) = params.password {
        use std::io::Write;
        let mut child = command
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|spawn_error| {
                format!("Failed to run sshfs: {}. Is sshfs installed?", spawn_error)
            })?;

        if let Some(ref mut stdin) = child.stdin {
            let _ = stdin.write_all(password.as_bytes());
        }

        child
            .wait_with_output()
            .map_err(|wait_error| format!("sshfs process error: {}", wait_error))?
    } else {
        command.output().map_err(|run_error| {
            format!("Failed to run sshfs: {}. Is sshfs installed?", run_error)
        })?
    };

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("sshfs failed: {}", stderr.trim()))
    }
}

#[cfg(not(windows))]
fn mount_nfs(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("{}:{}", params.host, params.remote_path);

    let output = std::process::Command::new("mount")
        .args(["-t", "nfs4", &source, mount_point])
        .output()
        .or_else(|_| {
            std::process::Command::new("mount")
                .args(["-t", "nfs", &source, mount_point])
                .output()
        })
        .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("NFS mount failed: {}", stderr.trim()))
    }
}

#[cfg(not(windows))]
fn mount_smb(params: &NetworkShareParams, mount_point: &str) -> Result<(), String> {
    let source = format!("//{}/{}", params.host, params.remote_path);

    #[cfg(target_os = "macos")]
    {
        let mount_source = if let Some(ref username) = params.username {
            format!("//{}@{}/{}", username, params.host, params.remote_path)
        } else {
            source.clone()
        };

        let output = std::process::Command::new("mount")
            .args(["-t", "smbfs", &mount_source, mount_point])
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            return Ok(());
        }

        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("SMB mount failed: {}", stderr.trim()));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let gio_uri = if let Some(ref username) = params.username {
            format!("smb://{}@{}/{}", username, params.host, params.remote_path)
        } else {
            format!("smb://{}/{}", params.host, params.remote_path)
        };

        if let Ok(output) = std::process::Command::new("gio")
            .args(["mount", &gio_uri])
            .output()
        {
            if output.status.success() {
                return Ok(());
            }
        }

        let mut mount_args = vec!["-t", "cifs", &source, mount_point];
        let options = if let Some(ref username) = params.username {
            if let Some(ref password) = params.password {
                format!("username={},password={}", username, password)
            } else {
                format!("username={}", username)
            }
        } else {
            "guest".to_string()
        };
        mount_args.extend(["-o", &options]);

        let output = std::process::Command::new("mount")
            .args(&mount_args)
            .output()
            .map_err(|run_error| format!("Failed to run mount: {}", run_error))?;

        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            Err(format!("SMB mount failed: {}", stderr.trim()))
        }
    }
}
