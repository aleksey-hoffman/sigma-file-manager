// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! Startup choices for the Linux Chromium build.
//!
//! The release runtime asks the system keyring unless this module selects the
//! basic password store. Extra Chromium switches come from environment
//! variables, because a release build ignores switches typed on the AppImage
//! command line.

#[cfg(all(feature = "cef", target_os = "linux"))]
use std::env;
#[cfg(all(feature = "cef", target_os = "linux"))]
use std::fs;
use std::mem;

/// Chromium re-executes this binary for its zygote, GPU, and renderer processes.
/// Those copies carry `--type=` and should not repeat the startup line.
#[cfg(any(test, all(feature = "cef", target_os = "linux")))]
pub fn is_chromium_subprocess(args: &[String]) -> bool {
    args.iter().any(|arg| arg.starts_with("--type="))
}

/// One Chromium switch, without the leading dashes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChromiumSwitch {
    pub name: String,
    pub value: Option<String>,
}

/// How much CEF should write to `cef.log`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CefLogLevel {
    Verbose,
    Info,
    Warning,
    Error,
    Disable,
}

impl CefLogLevel {
    fn name(self) -> &'static str {
        match self {
            Self::Verbose => "verbose",
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
            Self::Disable => "disable",
        }
    }

    #[cfg(all(feature = "cef", target_os = "linux"))]
    fn to_cef(self) -> tauri_runtime_cef::cef::LogSeverity {
        match self {
            Self::Verbose => tauri_runtime_cef::cef::LogSeverity::VERBOSE,
            Self::Info => tauri_runtime_cef::cef::LogSeverity::INFO,
            Self::Warning => tauri_runtime_cef::cef::LogSeverity::WARNING,
            Self::Error => tauri_runtime_cef::cef::LogSeverity::ERROR,
            Self::Disable => tauri_runtime_cef::cef::LogSeverity::DISABLE,
        }
    }
}

/// What this launch will tell Chromium, before the runtime is built.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChromiumLaunchPlan {
    pub wsl: bool,
    pub disable_gpu: bool,
    pub switches: Vec<ChromiumSwitch>,
    pub log_level: Option<CefLogLevel>,
    pub ignored_log_level: Option<String>,
}

impl ChromiumLaunchPlan {
    #[cfg(all(feature = "cef", target_os = "linux"))]
    pub fn from_environment() -> Self {
        Self::from_parts(
            env::var("WSL_DISTRO_NAME").ok(),
            fs::read_to_string("/proc/version").ok(),
            env::var("SFM_CEF_DISABLE_GPU").ok(),
            env::var("SFM_CEF_ARGS").ok(),
            env::var("SFM_CEF_LOG").ok(),
        )
    }

    pub fn from_parts(
        wsl_distro_name: Option<String>,
        proc_version: Option<String>,
        disable_gpu: Option<String>,
        extra_args: Option<String>,
        log_level: Option<String>,
    ) -> Self {
        let (log_level, ignored_log_level) = parse_log_level(log_level.as_deref());
        Self {
            wsl: is_wsl(wsl_distro_name.as_deref(), proc_version.as_deref()),
            disable_gpu: env_flag_is_set(disable_gpu.as_deref()),
            switches: extra_args
                .as_deref()
                .map(parse_chromium_switches)
                .unwrap_or_default(),
            log_level,
            ignored_log_level,
        }
    }

    /// One line for stderr. `sandbox_dropped` is the same answer `Auto` gives
    /// for an AppImage on this machine.
    pub fn startup_report(&self, sandbox_dropped: bool) -> String {
        let sandbox = if sandbox_dropped {
            "auto, off on this machine"
        } else {
            "auto, kept on this machine"
        };
        let gpu = if self.disable_gpu {
            "disabled (--disable-gpu --disable-gpu-compositing)"
        } else {
            "default"
        };
        let extra = if self.switches.is_empty() {
            "none".to_string()
        } else {
            self.switches
                .iter()
                .map(ChromiumSwitch::display)
                .collect::<Vec<_>>()
                .join(" ")
        };
        let log = self.log_level.map(CefLogLevel::name).unwrap_or("default");
        let mut report = format!(
            "Chromium startup: password-store=basic, sandbox={sandbox}, wsl={}, gpu={gpu}, log={log}, extra={extra}",
            if self.wsl { "yes" } else { "no" },
        );
        if let Some(ignored) = &self.ignored_log_level {
            report.push_str(&format!(" (ignored SFM_CEF_LOG={ignored})"));
        }
        report
    }
}

impl ChromiumSwitch {
    fn display(&self) -> String {
        match &self.value {
            Some(value) => format!("--{}={value}", self.name),
            None => format!("--{}", self.name),
        }
    }
}

/// `WSL_DISTRO_NAME` is set inside a distro. `/proc/version` contains
/// `microsoft` on WSL1 and WSL2 even when that variable was cleared.
fn is_wsl(distro_name: Option<&str>, proc_version: Option<&str>) -> bool {
    if distro_name.is_some_and(|name| !name.trim().is_empty()) {
        return true;
    }
    proc_version
        .unwrap_or("")
        .to_ascii_lowercase()
        .contains("microsoft")
}

fn env_flag_is_set(value: Option<&str>) -> bool {
    matches!(
        value
            .map(str::trim)
            .map(|text| text.to_ascii_lowercase())
            .as_deref(),
        Some("1") | Some("true") | Some("yes") | Some("on")
    )
}

fn parse_chromium_switches(raw: &str) -> Vec<ChromiumSwitch> {
    split_switch_tokens(raw)
        .into_iter()
        .filter_map(|token| parse_switch_token(&token))
        .collect()
}

fn parse_log_level(value: Option<&str>) -> (Option<CefLogLevel>, Option<String>) {
    let Some(raw) = value.map(str::trim).filter(|text| !text.is_empty()) else {
        return (None, None);
    };
    let level = match raw.to_ascii_lowercase().as_str() {
        "verbose" => CefLogLevel::Verbose,
        "info" => CefLogLevel::Info,
        "warning" => CefLogLevel::Warning,
        "error" => CefLogLevel::Error,
        "disable" => CefLogLevel::Disable,
        _ => return (None, Some(raw.to_string())),
    };
    (Some(level), None)
}

fn split_switch_tokens(raw: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    for character in raw.chars() {
        match character {
            '"' => in_quotes = !in_quotes,
            whitespace if whitespace.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    tokens.push(mem::take(&mut current));
                }
            }
            other => current.push(other),
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn parse_switch_token(token: &str) -> Option<ChromiumSwitch> {
    let token = token.trim();
    if token.is_empty() {
        return None;
    }
    let body = token.trim_start_matches('-');
    if body.is_empty() {
        return None;
    }
    let (name, value) = match body.split_once('=') {
        Some((name, value)) => (name.trim(), Some(value.to_string())),
        None => (body, None),
    };
    if name.is_empty() {
        return None;
    }
    Some(ChromiumSwitch {
        name: name.to_string(),
        value,
    })
}

/// Where a parsed switch has to go. `disable-features` and `enable-features`
/// replace Chromium's whole list when passed as raw switches, so they are
/// merged through the runtime instead.
#[derive(Debug, Clone, PartialEq, Eq)]
enum RoutedSwitch {
    Command { key: String, value: Option<String> },
    DisableFeature(String),
    EnableFeature(String),
    JsFlags(String),
}

fn route_switches(switches: &[ChromiumSwitch]) -> Vec<RoutedSwitch> {
    let mut routed = Vec::new();
    for switch in switches {
        match switch.name.as_str() {
            "disable-features" => {
                push_feature_routes(&mut routed, switch.value.as_deref(), true);
            }
            "enable-features" => {
                push_feature_routes(&mut routed, switch.value.as_deref(), false);
            }
            "js-flags" => {
                if let Some(value) = switch.value.as_ref().filter(|value| !value.is_empty()) {
                    routed.push(RoutedSwitch::JsFlags(value.clone()));
                }
            }
            _ => routed.push(RoutedSwitch::Command {
                key: format!("--{}", switch.name),
                value: switch.value.clone(),
            }),
        }
    }
    routed
}

fn push_feature_routes(routed: &mut Vec<RoutedSwitch>, value: Option<&str>, disable: bool) {
    let Some(value) = value else {
        return;
    };
    for name in value.split(',') {
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        if disable {
            routed.push(RoutedSwitch::DisableFeature(name.to_string()));
        } else {
            routed.push(RoutedSwitch::EnableFeature(name.to_string()));
        }
    }
}

#[cfg(all(feature = "cef", target_os = "linux"))]
pub fn apply(plan: &ChromiumLaunchPlan, mut cef: tauri_runtime_cef::Cef) -> tauri_runtime_cef::Cef {
    cef = cef.secret_storage(tauri_runtime_cef::SecretStorage::Mock);
    if plan.disable_gpu {
        cef = cef
            .command_line_arg("--disable-gpu", None::<String>)
            .command_line_arg("--disable-gpu-compositing", None::<String>);
    }
    if let Some(level) = plan.log_level {
        cef = cef.log_severity(level.to_cef());
    }

    for switch in route_switches(&plan.switches) {
        cef = match switch {
            RoutedSwitch::Command { key, value } => cef.command_line_arg(key, value),
            RoutedSwitch::DisableFeature(name) => cef.disable_features([name]),
            RoutedSwitch::EnableFeature(name) => cef.enable_features([name]),
            RoutedSwitch::JsFlags(flags) => cef.javascript_flags(flags),
        };
    }
    cef
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_subprocess_is_recognized_from_its_type_switch() {
        assert!(!is_chromium_subprocess(&[]));
        assert!(is_chromium_subprocess(&["--type=renderer".to_string()]));
        assert!(!is_chromium_subprocess(&["--disable-gpu".to_string()]));
    }

    #[test]
    fn wsl_is_detected_from_the_distro_name_or_the_kernel_banner() {
        assert!(is_wsl(Some("Ubuntu"), None));
        assert!(is_wsl(
            None,
            Some("Linux version 6.6.87.2-microsoft-standard-WSL2"),
        ));
        assert!(!is_wsl(None, Some("Linux version 6.12.113+")));
        assert!(!is_wsl(Some("  "), Some("Linux")));
    }

    #[test]
    fn wsl_does_not_disable_the_gpu_on_its_own() {
        let plan =
            ChromiumLaunchPlan::from_parts(Some("Ubuntu".to_string()), None, None, None, None);
        assert!(plan.wsl);
        assert!(!plan.disable_gpu);
    }

    #[test]
    fn disable_gpu_accepts_the_documented_values() {
        assert!(env_flag_is_set(Some("1")));
        assert!(env_flag_is_set(Some(" YES ")));
        assert!(!env_flag_is_set(Some("0")));
        assert!(!env_flag_is_set(None));
    }

    #[test]
    fn extra_switches_keep_values_and_quotes() {
        let switches = parse_chromium_switches(
            r#"--disable-gpu --use-gl=swiftshader --js-flags="--expose-gc --max-old-space-size=512""#,
        );
        assert_eq!(
            switches,
            vec![
                ChromiumSwitch {
                    name: "disable-gpu".to_string(),
                    value: None,
                },
                ChromiumSwitch {
                    name: "use-gl".to_string(),
                    value: Some("swiftshader".to_string()),
                },
                ChromiumSwitch {
                    name: "js-flags".to_string(),
                    value: Some("--expose-gc --max-old-space-size=512".to_string()),
                },
            ]
        );
    }

    #[test]
    fn feature_lists_are_routed_away_from_the_raw_switch() {
        let switches = parse_chromium_switches("--disable-features=A,B --enable-features=C");
        assert_eq!(
            route_switches(&switches),
            vec![
                RoutedSwitch::DisableFeature("A".to_string()),
                RoutedSwitch::DisableFeature("B".to_string()),
                RoutedSwitch::EnableFeature("C".to_string()),
            ]
        );
    }

    #[test]
    fn the_startup_line_names_the_basic_password_store() {
        let plan = ChromiumLaunchPlan::from_parts(None, None, Some("1".to_string()), None, None);
        let report = plan.startup_report(true);
        assert!(report.contains("password-store=basic"));
        assert!(report.contains("sandbox=auto, off on this machine"));
        assert!(report.contains("wsl=no"));
        assert!(report.contains("--disable-gpu"));
        assert!(report.contains("extra=none"));
    }

    #[test]
    fn an_unknown_log_level_is_named_in_the_startup_line() {
        let plan = ChromiumLaunchPlan::from_parts(None, None, None, None, Some("loud".to_string()));
        assert!(plan.log_level.is_none());
        assert!(plan
            .startup_report(false)
            .contains("ignored SFM_CEF_LOG=loud"));
    }
}
