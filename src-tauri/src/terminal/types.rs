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

#[derive(Debug, Serialize, Deserialize)]
pub struct OpenTerminalResult {
    pub success: bool,
    pub error: Option<String>,
}
