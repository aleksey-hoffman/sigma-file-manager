// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    #[serde(rename = "isDefault")]
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetAvailableTerminalsResult {
    pub success: bool,
    pub terminals: Vec<TerminalInfo>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TerminalErrorCode {
    DirectoryNotFound,
    CommandInvalid,
    ArgumentsInvalid,
    CommandNotFound,
    AdminCancelled,
    AdminUnavailable,
    OpenFailed,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenTerminalResult {
    pub success: bool,
    pub error: Option<String>,
    #[serde(default, rename = "allowFallback")]
    pub allow_fallback: bool,
    #[serde(default, rename = "errorCode", skip_serializing_if = "Option::is_none")]
    pub error_code: Option<TerminalErrorCode>,
}

impl OpenTerminalResult {
    pub(crate) fn opened() -> Self {
        Self {
            success: true,
            error: None,
            allow_fallback: false,
            error_code: None,
        }
    }

    pub(crate) fn failed(error: impl Into<String>) -> Self {
        Self::failed_coded(None, error, false)
    }

    pub(crate) fn failed_coded(
        code: impl Into<Option<TerminalErrorCode>>,
        error: impl Into<String>,
        allow_fallback: bool,
    ) -> Self {
        Self {
            success: false,
            error: Some(error.into()),
            allow_fallback,
            error_code: code.into(),
        }
    }
}
