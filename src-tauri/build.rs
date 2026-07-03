// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    #[cfg(target_os = "windows")]
    build_default_file_manager_launcher();

    tauri_build::build();
}

#[cfg(target_os = "windows")]
fn build_default_file_manager_launcher() {
    let manifest_dir =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let target = std::env::var("TARGET").expect("TARGET");
    let profile = std::env::var("PROFILE").expect("PROFILE");
    let out_dir = PathBuf::from(std::env::var("OUT_DIR").expect("OUT_DIR"));
    let launcher_target_dir = launcher_target_directory(&manifest_dir);
    let launcher_source = launcher_source_path(&launcher_target_dir, &target, &profile);
    let launcher_destination = out_dir.join("sigma-file-manager-launcher.exe");

    println!("cargo:rerun-if-changed=default-file-manager-launcher/src/main.rs");
    println!("cargo:rerun-if-changed=default-file-manager-launcher/Cargo.toml");
    println!("cargo:rerun-if-changed=default-file-manager-launcher/Cargo.lock");

    if should_build_launcher(&launcher_source) {
        let cargo = std::env::var("CARGO").unwrap_or_else(|_| "cargo".to_string());
        let mut command = Command::new(cargo);
        command
            .current_dir(&manifest_dir)
            .env("CARGO_TARGET_DIR", &launcher_target_dir)
            .args([
                "build",
                "-p",
                "sigma-file-manager-launcher",
                "--target",
                target.as_str(),
            ]);

        match profile.as_str() {
            "debug" => {}
            "release" => {
                command.arg("--release");
            }
            _ => {
                command.args(["--profile", profile.as_str()]);
            }
        }

        let status = command
            .status()
            .expect("failed to build sigma-file-manager-launcher");

        if !status.success() {
            panic!("sigma-file-manager-launcher build failed");
        }
    }

    if !launcher_source.is_file() {
        panic!(
            "Expected launcher binary at {} after build",
            launcher_source.display()
        );
    }

    std::fs::copy(&launcher_source, &launcher_destination).unwrap_or_else(|error| {
        panic!(
            "Failed to copy launcher from {} to {}: {error}",
            launcher_source.display(),
            launcher_destination.display()
        );
    });
}

#[cfg(target_os = "windows")]
fn launcher_target_directory(manifest_dir: &Path) -> PathBuf {
    manifest_dir
        .join("target")
        .join("default-file-manager-launcher")
}

#[cfg(target_os = "windows")]
fn launcher_source_path(launcher_target_dir: &Path, target: &str, profile: &str) -> PathBuf {
    launcher_target_dir
        .join(target)
        .join(profile)
        .join("sigma-file-manager-launcher.exe")
}

#[cfg(target_os = "windows")]
fn should_build_launcher(launcher_source: &Path) -> bool {
    let manifest_dir =
        PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let launcher_inputs = [
        manifest_dir.join("default-file-manager-launcher/src/main.rs"),
        manifest_dir.join("default-file-manager-launcher/Cargo.toml"),
    ];

    if !launcher_source.is_file() {
        return true;
    }

    let Some(launcher_modified) = std::fs::metadata(launcher_source)
        .and_then(|metadata| metadata.modified())
        .ok()
    else {
        return true;
    };

    for input in launcher_inputs {
        let Some(input_modified) = std::fs::metadata(input)
            .and_then(|metadata| metadata.modified())
            .ok()
        else {
            return true;
        };

        if input_modified > launcher_modified {
            return true;
        }
    }

    false
}
