// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

pub const DEFAULT_FILE_MANAGER_DATA_DIR_NAME: &str = "com.sigma-file-manager.default-file-manager";
pub const DEFAULT_FILE_MANAGER_LAUNCH_TARGET_FILE_NAME: &str = "launch-target.txt";
pub const DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME: &str = "registry-snapshot.json";

pub const FOLDER_OPEN_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\open\command";
pub const FOLDER_EXPLORE_COMMAND_KEY: &str = r"SOFTWARE\Classes\Folder\shell\explore\command";
pub const OPEN_NEW_WINDOW_COMMAND_KEY: &str =
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command";

pub const ROOT_REGISTRY_KEYS: [&str; 3] = [
    r"SOFTWARE\Classes\Folder\shell\open",
    r"SOFTWARE\Classes\Folder\shell\explore",
    r"SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}",
];

pub const SNAPSHOT_VERSION: u32 = 1;

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct RegistryValueSnapshot {
    pub name: String,
    pub value_type: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct RegistryKeySnapshot {
    pub path: String,
    pub existed: bool,
    pub values: Vec<RegistryValueSnapshot>,
    pub subkeys: Vec<RegistryKeySnapshot>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct DefaultFileManagerRegistrySnapshot {
    pub version: u32,
    pub created_at_unix_seconds: u64,
    pub executable_path: String,
    pub original_keys: Vec<RegistryKeySnapshot>,
    pub owned_keys: Vec<RegistryKeySnapshot>,
}

fn registry_key_is_within_root(key: &RegistryKeySnapshot, root_path: &str) -> bool {
    let path_is_valid = key.path == root_path
        || key
            .path
            .strip_prefix(root_path)
            .is_some_and(|suffix| suffix.starts_with('\\'));
    path_is_valid
        && (key.existed || (key.values.is_empty() && key.subkeys.is_empty()))
        && key
            .subkeys
            .iter()
            .all(|subkey| registry_key_is_within_root(subkey, root_path))
}

pub fn registry_roots_are_valid(
    roots: &[RegistryKeySnapshot],
    expected_root_paths: &[&str],
) -> bool {
    roots.len() == expected_root_paths.len()
        && roots
            .iter()
            .zip(expected_root_paths)
            .all(|(root, expected_path)| {
                root.path == *expected_path && registry_key_is_within_root(root, expected_path)
            })
}

pub fn snapshot_is_valid(
    snapshot: &DefaultFileManagerRegistrySnapshot,
    expected_root_paths: &[&str],
) -> bool {
    snapshot.version == SNAPSHOT_VERSION
        && registry_roots_are_valid(&snapshot.original_keys, expected_root_paths)
        && registry_roots_are_valid(&snapshot.owned_keys, expected_root_paths)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_validation_rejects_paths_outside_owned_roots() {
        let expected_roots = [r"SOFTWARE\Classes\Folder\shell\open"];
        let invalid_root = RegistryKeySnapshot {
            path: expected_roots[0].to_string(),
            existed: true,
            values: Vec::new(),
            subkeys: vec![RegistryKeySnapshot {
                path: r"SOFTWARE\Microsoft\Windows\CurrentVersion\Run".to_string(),
                existed: true,
                values: Vec::new(),
                subkeys: Vec::new(),
            }],
        };
        let snapshot = DefaultFileManagerRegistrySnapshot {
            version: SNAPSHOT_VERSION,
            created_at_unix_seconds: 1,
            executable_path: "application.exe".to_string(),
            original_keys: vec![invalid_root.clone()],
            owned_keys: vec![invalid_root],
        };

        assert!(!snapshot_is_valid(&snapshot, &expected_roots));
    }
}
