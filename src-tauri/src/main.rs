// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use tauri::Manager;

mod app_state;
mod dev;
mod fs_api;
mod listeners;
mod media_processor;
mod storage_info;
mod system_info;
mod system_tray;
mod user_settings;

fn main() {
    tauri::Builder::default()
        .setup(setup_handler)
        .plugin(tauri_plugin_store::Builder::default().build())
        .on_system_tray_event(system_tray::on_system_tray_event)
        .invoke_handler(tauri::generate_handler![
            system_info::get_system_stats,
            storage_info::get_storage_stats,
            fs_api::get_dir_paths,
            fs_api::get_dir_entries,
            fs_api::get_dir_entry,
            media_processor::generate_image_preview_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_handler(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error + 'static>> {
    let app_state = app_state::init(app)?;
    let tray = system_tray::get_system_tray(&app.handle()).build(app)?;
    app.manage(app_state);
    app.manage(tray);

    match user_settings::create_user_settings(app.handle().clone()) {
        Ok(_) => {}
        Err(error) => {
            eprintln!("Error creating user settings: {}", error);
        }
    }

    let mut main_window = app.get_window("main").unwrap();
    listeners::init_main_window_listeners(&mut main_window)?;
    dev::auto_open_devtools(&mut main_window)?;

    Ok(())
}
