// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::desktop::{
    desktop_id_to_program, find_desktop_file, get_gio_mime_info, get_mimeapps_entries,
    get_xdg_default_app, merge_desktop_ids, GioMimeInfo, MimeappsEntries,
};
use super::mime::get_mime_type;
use crate::open_with::types::{AssociatedProgram, GetAssociatedProgramsResult, OpenWithResult};
use std::collections::HashSet;
use std::path::Path;
use std::process::Command;

pub fn get_associated_programs_impl(file_path: &str) -> GetAssociatedProgramsResult {
    let path = Path::new(file_path);
    if !path.exists() {
        return GetAssociatedProgramsResult {
            success: false,
            recommended_programs: vec![],
            other_programs: vec![],
            default_program: None,
            error: Some(format!("Path not found: {}", file_path)),
        };
    }

    log::info!("Open With Linux: resolving apps for {}", file_path);

    let mime_type = match get_mime_type(path) {
        Ok(value) => value,
        Err(message) => {
            log::warn!(
                "Open With Linux: failed to resolve mime type for {}: {}",
                file_path,
                message
            );
            return GetAssociatedProgramsResult {
                success: false,
                recommended_programs: vec![],
                other_programs: vec![],
                default_program: None,
                error: Some(message),
            };
        }
    };

    log::info!("Open With Linux: mime type {}", mime_type);

    let gio_info = get_gio_mime_info(&mime_type).unwrap_or(GioMimeInfo {
        default_app: None,
        recommended_apps: vec![],
        registered_apps: vec![],
    });

    let mimeapps_entries = get_mimeapps_entries(&mime_type);
    let xdg_default_app = get_xdg_default_app(&mime_type);

    let default_desktop_id = gio_info
        .default_app
        .or(mimeapps_entries.default_app)
        .or(xdg_default_app);

    if let Some(default_id) = default_desktop_id.as_ref() {
        log::info!("Open With Linux: default desktop id {}", default_id);
    } else {
        log::info!("Open With Linux: default desktop id not found");
    }

    let mut default_program: Option<AssociatedProgram> = None;
    if let Some(desktop_id) = default_desktop_id.as_ref() {
        if let Some(program) = desktop_id_to_program(desktop_id, true) {
            default_program = Some(program);
        } else {
            log::warn!(
                "Open With Linux: default desktop id not resolved {}",
                desktop_id
            );
        }
    }

    let mut seen_ids: HashSet<String> = HashSet::new();
    if let Some(desktop_id) = default_desktop_id.as_ref() {
        seen_ids.insert(desktop_id.to_lowercase());
    }

    let mut recommended_programs: Vec<AssociatedProgram> = Vec::new();
    let mut other_programs: Vec<AssociatedProgram> = Vec::new();

    let mut recommended_ids: Vec<String> = Vec::new();
    let mut other_ids: Vec<String> = Vec::new();

    merge_desktop_ids(&mut recommended_ids, &gio_info.recommended_apps);
    merge_desktop_ids(&mut recommended_ids, &mimeapps_entries.recommended_apps);

    merge_desktop_ids(&mut other_ids, &gio_info.registered_apps);
    merge_desktop_ids(&mut other_ids, &mimeapps_entries.other_apps);

    log::info!(
        "Open With Linux: candidates default={} recommended={} other={}",
        default_desktop_id.is_some(),
        recommended_ids.len(),
        other_ids.len()
    );

    for desktop_id in recommended_ids {
        if seen_ids.contains(&desktop_id.to_lowercase()) {
            continue;
        }
        if let Some(program) = desktop_id_to_program(&desktop_id, false) {
            seen_ids.insert(desktop_id.to_lowercase());
            recommended_programs.push(program);
        } else {
            log::warn!(
                "Open With Linux: recommended desktop id not resolved {}",
                desktop_id
            );
        }
    }

    for desktop_id in other_ids {
        if seen_ids.contains(&desktop_id.to_lowercase()) {
            continue;
        }
        if let Some(program) = desktop_id_to_program(&desktop_id, false) {
            seen_ids.insert(desktop_id.to_lowercase());
            other_programs.push(program);
        } else {
            log::warn!(
                "Open With Linux: other desktop id not resolved {}",
                desktop_id
            );
        }
    }

    log::info!(
        "Open With Linux: resolved default={} recommended={} other={}",
        default_program.is_some(),
        recommended_programs.len(),
        other_programs.len()
    );

    GetAssociatedProgramsResult {
        success: true,
        recommended_programs,
        other_programs,
        default_program,
        error: None,
    }
}

pub fn open_with_desktop_id(program_id: &str, file_path: &str) -> Option<OpenWithResult> {
    log::info!(
        "Open With Linux: launch request program={} file={}",
        program_id,
        file_path
    );
    let mut candidate_ids: Vec<String> = Vec::new();

    if program_id.ends_with(".desktop") {
        candidate_ids.push(program_id.to_string());
    } else {
        candidate_ids.push(format!("{}.desktop", program_id));
        candidate_ids.push(program_id.to_string());
    }

    let mut desktop_path: Option<String> = None;
    for candidate_id in &candidate_ids {
        if let Some(found_path) = find_desktop_file(candidate_id) {
            desktop_path = Some(found_path.to_string_lossy().to_string());
            break;
        }
    }

    if desktop_path.is_none() && !program_id.ends_with(".desktop") {
        log::warn!("Open With Linux: no desktop file found for {}", program_id);
        return None;
    }

    let launch_target = desktop_path.unwrap_or_else(|| program_id.to_string());

    match Command::new("gio")
        .args(["launch", &launch_target, file_path])
        .spawn()
    {
        Ok(_) => {
            log::info!("Open With Linux: launched via gio {}", launch_target);
            return Some(OpenWithResult {
                success: true,
                error: None,
            });
        }
        Err(command_error) => {
            log::warn!(
                "Open With Linux: gio launch failed for {}: {}",
                launch_target,
                command_error
            );
        }
    }

    let launch_id = launch_target.trim_end_matches(".desktop");
    match Command::new("gtk-launch")
        .arg(launch_id)
        .arg(file_path)
        .spawn()
    {
        Ok(_) => {
            log::info!("Open With Linux: launched via gtk-launch {}", launch_id);
            return Some(OpenWithResult {
                success: true,
                error: None,
            });
        }
        Err(command_error) => {
            log::warn!(
                "Open With Linux: gtk-launch failed for {}: {}",
                launch_id,
                command_error
            );
        }
    }

    Some(OpenWithResult {
        success: false,
        error: Some(format!("Failed to launch application: {}", program_id)),
    })
}
