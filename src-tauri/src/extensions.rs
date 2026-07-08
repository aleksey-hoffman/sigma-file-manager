// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod archives;
mod binaries;
mod commands;
mod extension_http;
mod filesystem;
mod fs_ops;
mod github;
mod http;
mod install;
mod manifest_permissions;
mod misc;
mod paths;
mod processes;
mod registry_storage;
mod security;
mod state;
mod types;

#[allow(unused_imports)]
pub use types::{
    ExtensionCommandComplete, ExtensionCommandProgress, ExtensionCommandResult,
    ExtensionOperationResult, FetchUrlResult, InstalledExtensionInfo, LocalExtensionInstallResult,
    LocalExtensionManifestPreview, PlatformInfo, ReadTextPreviewResult,
};

pub use commands::*;

#[cfg(test)]
mod tests {
    use super::security::{
        url_matches_host_allowlist, validate_binary_path_component, validate_binary_relative_path,
        validate_extension_http_url, validate_remote_url,
    };

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

    #[test]
    fn blocks_localhost_without_allowlist() {
        assert!(validate_remote_url("http://localhost:8080/search").is_err());
    }

    #[test]
    fn allows_localhost_with_host_allowlist() {
        let allowed_hosts = vec!["http://localhost:*".to_string()];
        let validated_url =
            validate_extension_http_url("http://localhost:8080/search", Some(&allowed_hosts))
                .expect("localhost should be allowed with host allowlist");
        assert!(url_matches_host_allowlist(&validated_url, &allowed_hosts));
    }

    #[test]
    fn rejects_host_outside_allowlist() {
        let allowed_hosts = vec!["http://127.0.0.1:8080".to_string()];
        assert!(
            validate_extension_http_url("http://127.0.0.1:9090/search", Some(&allowed_hosts))
                .is_err()
        );
    }

    #[test]
    fn rejects_urls_that_do_not_match_manifest_hosts() {
        let manifest_hosts = vec!["https://httpbin.org".to_string()];
        assert!(
            validate_extension_http_url("https://example.com/get", Some(&manifest_hosts)).is_err()
        );
    }

    #[test]
    fn requires_host_allowlist() {
        assert!(validate_extension_http_url("https://example.com", None).is_err());
    }
}
