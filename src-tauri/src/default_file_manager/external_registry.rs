// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

use super::{RegistryKeyExportSnapshot, RegistryKeySnapshot, RegistryKeyTreeSnapshot};

pub fn read_string_value(key_path: &str, value_name: &str) -> Result<Option<String>, String> {
    let registry_path = registry_key_to_cli_path(key_path);
    let output = if value_name.is_empty() {
        run_reg_command(&["query", &registry_path, "/ve"])?
    } else {
        run_reg_command(&["query", &registry_path, "/v", value_name])?
    };

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("ERROR: The system was unable to find the specified registry key")
            || stderr.contains("ERROR: The system was unable to find the specified registry value")
        {
            return Ok(None);
        }

        return Err(format!(
            "Failed to query registry key \"{key_path}\" value \"{value_name}\": {stderr}"
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_reg_query_string_value(&stdout, value_name))
}

pub fn write_string_value(key_path: &str, value_name: &str, value: &str) -> Result<(), String> {
    let registry_path = registry_key_to_cli_path(key_path);
    let mut args = vec!["add", registry_path.as_str(), "/f"];

    if value_name.is_empty() {
        args.push("/ve");
    } else {
        args.push("/v");
        args.push(value_name);
    }

    args.push("/t");
    args.push("REG_SZ");
    args.push("/d");
    args.push(value);

    let output = run_reg_command(&args)?;
    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "Failed to write registry key \"{key_path}\" value \"{value_name}\": {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

pub fn delete_key_tree(key_path: &str) -> Result<(), String> {
    let registry_path = registry_key_to_cli_path(key_path);
    let output = run_reg_command(&["delete", &registry_path, "/f"])?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    if stderr.contains("ERROR: The system was unable to find the specified registry key") {
        return Ok(());
    }

    Err(format!(
        "Failed to delete registry key \"{key_path}\": {stderr}"
    ))
}

pub fn import_snapshot(export_content: &str) -> Result<(), String> {
    let import_path = std::env::temp_dir().join(format!(
        "sfm-default-file-manager-restore-{}.reg",
        current_unix_time_seconds()
    ));
    fs::write(&import_path, export_content)
        .map_err(|error| format!("Failed to write temporary registry restore file: {error}"))?;

    let import_path_string = import_path.to_string_lossy().into_owned();
    let output = run_reg_command(&["import", &import_path_string])?;
    let _ = fs::remove_file(&import_path);

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "Failed to import registry backup: {}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

pub fn snapshot_key(path: &str) -> Result<RegistryKeySnapshot, String> {
    match export_registry_key(path)? {
        Some(reg_export) => Ok(RegistryKeySnapshot::RegExport(RegistryKeyExportSnapshot {
            path: path.to_string(),
            existed: true,
            reg_export,
        })),
        None => Ok(RegistryKeySnapshot::Native(RegistryKeyTreeSnapshot {
            path: path.to_string(),
            existed: false,
            values: Vec::new(),
            subkeys: Vec::new(),
        })),
    }
}

pub fn parse_reg_query_string_value(output: &str, value_name: &str) -> Option<String> {
    let target_name = if value_name.is_empty() {
        "(Default)"
    } else {
        value_name
    };

    for line in output.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with(target_name) {
            continue;
        }

        let mut parts = trimmed.split_whitespace();
        let _ = parts.next();
        let value_type = parts.next().unwrap_or_default();
        if value_type != "REG_SZ" && value_type != "REG_EXPAND_SZ" {
            return None;
        }

        return Some(parts.collect::<Vec<_>>().join(" "));
    }

    None
}

fn export_registry_key(key_path: &str) -> Result<Option<String>, String> {
    let registry_path = registry_key_to_cli_path(key_path);
    let export_path = std::env::temp_dir().join(format!(
        "sfm-default-file-manager-{}-{}.reg",
        key_path.replace('\\', "-"),
        current_unix_time_seconds()
    ));
    let export_path_string = export_path.to_string_lossy().into_owned();

    let output = run_reg_command(&["export", &registry_path, &export_path_string, "/y"])?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("ERROR: The system was unable to find the specified registry key") {
            return Ok(None);
        }

        return Err(format!(
            "Failed to export registry key \"{key_path}\": {stderr}"
        ));
    }

    let export_content = fs::read_to_string(&export_path)
        .map_err(|error| format!("Failed to read exported registry key \"{key_path}\": {error}"))?;
    let _ = fs::remove_file(&export_path);

    Ok(Some(export_content))
}

fn registry_key_to_cli_path(registry_key: &str) -> String {
    format!(r"HKCU\{registry_key}")
}

fn run_reg_command(args: &[&str]) -> Result<Output, String> {
    Command::new("reg.exe")
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run reg.exe: {error}"))
}

fn current_unix_time_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}
