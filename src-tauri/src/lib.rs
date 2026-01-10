// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod dir_reader;
mod file_operations;
mod global_search;
mod system_icons;
mod system_tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            dir_reader::read_dir,
            dir_reader::get_system_drives,
            dir_reader::get_parent_dir,
            dir_reader::path_exists,
            file_operations::copy_items,
            file_operations::move_items,
            file_operations::delete_items,
            global_search::global_search_init,
            global_search::global_search_get_status,
            global_search::global_search_start_scan,
            global_search::global_search_cancel_scan,
            global_search::global_search_query,
            system_icons::get_system_icon,
        ])
        .setup(setup_handler)
        .on_menu_event(system_tray::handle_menu_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_handler(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) {
        app.handle().plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )?;
    }

    // Initialize system tray for Tauri v2
    system_tray::setup_system_tray(&app.handle())?;

    Ok(())
}
