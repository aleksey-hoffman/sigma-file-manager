// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod archives;
mod binaries;
mod commands;
mod filesystem;
mod fs_ops;
mod github;
mod http;
mod install;
mod misc;
mod paths;
mod processes;
mod security;
mod state;
mod types;

#[allow(unused_imports)]
pub use types::{
    ExtensionCommandComplete, ExtensionCommandProgress, ExtensionCommandResult,
    ExtensionOperationResult, FetchUrlResult, InstalledExtensionInfo, LocalExtensionInstallResult,
    PlatformInfo, ReadTextPreviewResult,
};

pub use commands::*;

#[cfg(test)]
mod tests {
    use super::security::{validate_binary_path_component, validate_binary_relative_path};

    #[test]
    fn validates_single_binary_path_component() {
        assert!(validate_binary_path_component("ffmpeg", "binary id").is_ok());
        assert!(validate_binary_path_component("1.2.3", "binary version").is_ok());
        assert!(validate_binary_path_component("../ffmpeg", "binary id").is_err());
        assert!(validate_binary_path_component("bin/ffmpeg", "binary id").is_err());
    }

    #[test]
    fn validates_binary_relative_path() {
        assert!(validate_binary_relative_path("bin/ffmpeg", "binary executable path").is_ok());
        assert!(validate_binary_relative_path("ffmpeg.exe", "binary executable path").is_ok());
        assert!(validate_binary_relative_path("../ffmpeg", "binary executable path").is_err());
        assert!(validate_binary_relative_path("/tmp/ffmpeg", "binary executable path").is_err());
    }
}
