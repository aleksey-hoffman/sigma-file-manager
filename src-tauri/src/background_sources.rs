// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::fs;
use std::io::{Read, Write};
use std::path::Path;

fn verify_file_readable(path: &Path) -> bool {
  fs::File::open(path)
    .and_then(|mut file| {
      let mut buf = [0u8; 1];
      file.read_exact(&mut buf)
    })
    .is_ok()
}

async fn wait_until_file_readable(path: &Path) -> Result<(), String> {
  for _ in 0..50 {
    if verify_file_readable(path) {
      return Ok(());
    }
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
  }
  Err(format!("File not readable after retries: {}", path.display()))
}

#[tauri::command]
pub async fn resolve_background_source_to_cache(
  url: String,
  cache_dir: String,
  filename: String,
) -> Result<String, String> {
  download_to_dir(&url, &cache_dir, &filename).await
}

#[tauri::command]
pub async fn download_url_to_path(url: String, dest_path: String) -> Result<String, String> {
  let path = Path::new(&dest_path);
  let parent = path.parent().ok_or_else(|| "Invalid destination path".to_string())?;
  let filename = path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("image.jpg");
  download_to_dir(&url, parent.to_string_lossy().as_ref(), filename).await
}

async fn download_to_dir(url: &str, dir: &str, filename: &str) -> Result<String, String> {
  if !url.starts_with("http://") && !url.starts_with("https://") {
    return Err("URL must be http or https".to_string());
  }

  let cache_path = Path::new(dir);
  if !cache_path.exists() {
    fs::create_dir_all(cache_path)
      .map_err(|error| format!("Failed to create directory: {}", error))?;
  }

  let dest_path = cache_path.join(filename);

  if dest_path.exists() {
    return Ok(dest_path.to_string_lossy().to_string());
  }

  let response = reqwest::get(url)
    .await
    .map_err(|error| format!("Failed to download: {}", error))?;

  if !response.status().is_success() {
    return Err(format!("Download failed with status: {}", response.status()));
  }

  let bytes = response
    .bytes()
    .await
    .map_err(|error| format!("Failed to read response: {}", error))?;

  let mut file = fs::File::create(&dest_path)
    .map_err(|error| format!("Failed to create file: {}", error))?;

  file.write_all(&bytes)
    .map_err(|error| format!("Failed to write file: {}", error))?;

  drop(file);

  wait_until_file_readable(&dest_path).await?;

  Ok(dest_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn copy_files_to_backgrounds(
  source_paths: Vec<String>,
  destination_path: String,
) -> Result<Vec<String>, String> {
  let destination = Path::new(&destination_path);

  if !destination.exists() {
    fs::create_dir_all(destination)
      .map_err(|error| format!("Failed to create directory: {}", error))?;
  }

  if !destination.is_dir() {
    return Err("Destination is not a directory".to_string());
  }

  let mut copied_paths: Vec<String> = Vec::new();

  for source_path_str in &source_paths {
    let source = Path::new(source_path_str);

    if !source.exists() || !source.is_file() {
      continue;
    }

    let file_name = source
      .file_name()
      .and_then(|name| name.to_str())
      .ok_or_else(|| "Invalid source path".to_string())?;

    let dest_path = destination.join(file_name);
    let mut unique_dest = dest_path.clone();
    let mut counter = 1u32;

    while unique_dest.exists() {
      let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("file");
      let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
      let ext_dot = if ext.is_empty() { "" } else { "." };
      unique_dest = destination.join(format!("{} ({}){}{}", stem, counter, ext_dot, ext));
      counter += 1;
    }

    fs::copy(source, &unique_dest)
      .map_err(|error| format!("Failed to copy: {}", error))?;

    wait_until_file_readable(&unique_dest).await?;
    copied_paths.push(unique_dest.to_string_lossy().to_string());
  }

  Ok(copied_paths)
}
