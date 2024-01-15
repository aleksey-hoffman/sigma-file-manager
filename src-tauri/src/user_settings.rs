// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub theme: String,
}

#[tauri::command]
pub fn create_user_settings(_app: AppHandle) -> Result<(), String> {
    Ok(())
}
