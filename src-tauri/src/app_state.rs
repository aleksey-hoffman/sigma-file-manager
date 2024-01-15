// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::media_processor::MediaProcessor;
use std::error::Error;

pub struct AppPaths {
    pub ffmpeg: String,
}

pub struct AppState {
    pub app_paths: AppPaths,
    pub media_processor: MediaProcessor,
}

pub fn create_app_state(_app: &mut tauri::App) -> Result<AppState, Box<dyn Error>> {
    let app_paths = get_app_paths();
    let media_processor = MediaProcessor::new(&app_paths.ffmpeg)?;

    let app_state = AppState {
        app_paths,
        media_processor,
    };

    Ok(app_state)
}

pub fn init(app: &mut tauri::App) -> Result<AppState, Box<dyn Error>> {
    let app_state = match create_app_state(app) {
        Ok(state) => state,
        Err(error) => {
            eprintln!("Error initializing AppState: {}", error);
            return Err(error.into());
        }
    };

    Ok(app_state)
}

fn get_app_paths() -> AppPaths {
    AppPaths { ffmpeg: "".to_string() }
}
