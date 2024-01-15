// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::app_state::AppState;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;
use std::process::Command;
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct PreviewResult {
    output_image_path: String,
}

pub struct MediaProcessor {
    ffmpeg_path: String,
}

impl MediaProcessor {
    pub fn new(ffmpeg_path: &str) -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            ffmpeg_path: ffmpeg_path.to_string(),
        })
    }

    pub fn generate_image_preview(
        &self,
        image_path: &str,
        output_image_path: &str,
        output_image_width: u32,
    ) -> Result<PreviewResult, Box<dyn Error>> {
        let output_image_path = Path::new(output_image_path);
        let output_dir = output_image_path.parent().unwrap();

        if output_image_path.exists() {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::AlreadyExists,
                format!("AlreadyExists: {}", output_image_path.display()),
            )));
        }

        if !output_dir.exists() {
            std::fs::create_dir_all(output_dir).map_err(|e| format!("Error creating output directory: {}", e))?;
        }

        let ffmpeg_command = Command::new(&self.ffmpeg_path)
            .args(&[
                "-i",
                image_path,
                "-vf",
                &format!("scale={}:-1", output_image_width),
                "-vframes",
                "1",
                "-y",
                output_image_path.to_str().unwrap(),
            ])
            .output()?;

        if !ffmpeg_command.status.success() {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("FFMPEG Error: {}", String::from_utf8_lossy(&ffmpeg_command.stderr)),
            )));
        }

        Ok(PreviewResult {
            output_image_path: output_image_path.to_string_lossy().into_owned(),
        })
    }
}

#[tauri::command]
pub fn generate_image_preview_command(
    app_state: State<AppState>,
    image_path: String,
    output_image_path: String,
    output_image_width: u32,
) -> Result<PreviewResult, String> {
    app_state
        .media_processor
        .generate_image_preview(&image_path, &output_image_path, output_image_width)
        .map_err(|error| error.to_string())
}
