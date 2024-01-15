// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// use serde_json::json;
use tauri::{AppHandle, CustomMenuItem, Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};

pub fn get_system_tray(app: &AppHandle) -> SystemTray {
    let app_version = app.package_info().version.to_string();
    let app_name = app.package_info().name.to_string();
    let main_title_text = format!("{} – v{}", app_name, app_version);
    let actions_title_text = "App actions".to_uppercase();
    let main_title_item = CustomMenuItem::new("title".to_string(), main_title_text.clone()).disabled();
    let actions_title_item = CustomMenuItem::new("title".to_string(), actions_title_text.clone()).disabled();
    let show_main_window_item = CustomMenuItem::new("show_main_window".to_string(), "Open window");
    let reload_main_window_item = CustomMenuItem::new("reload_main_window".to_string(), "Reload window");
    let quit_item = CustomMenuItem::new("quit".to_string(), "Quit");
    let tray_menu = SystemTrayMenu::new()
        .add_item(main_title_item)
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(actions_title_item)
        .add_item(show_main_window_item)
        .add_item(reload_main_window_item)
        .add_item(quit_item);
    SystemTray::new()
        .with_menu(tray_menu)
        .with_tooltip(main_title_text.as_str())
}

pub fn on_system_tray_event(app: &AppHandle, event: SystemTrayEvent) {
    return match event {
        SystemTrayEvent::LeftClick {
            position: _, size: _, ..
        } => {
            focus_main_window(app);
        }
        SystemTrayEvent::RightClick {
            position: _, size: _, ..
        } => {}
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "show_main_window" => show_main_window(app),
            "reload_main_window" => reload_main_window(app),
            "quit" => quit_app(),
            _ => {}
        },
        _ => {}
    };
}

pub fn show_main_window(app: &AppHandle) {
    let window = app.get_window("main").unwrap();
    window.show().unwrap();
    window.set_focus().unwrap();
}

pub fn focus_main_window(app: &AppHandle) {
    let window: tauri::Window = app.get_window("main").unwrap();
    let is_focused = window.is_focused().unwrap();
    let is_minimized = window.is_minimized().unwrap();
    if is_minimized {
        window.unminimize().unwrap();
        show_main_window(app);
        return;
    }
    if !is_focused {
        show_main_window(app)
    }
}

pub fn reload_main_window(app: &AppHandle) {
    let result = app.emit_to("main", "reload-window", "payload".to_string());
    match result {
        Ok(_) => {}
        Err(error) => eprintln!("failed to emit event: {:?}", error),
    }
}

pub fn quit_app() {
    std::process::exit(0);
}
