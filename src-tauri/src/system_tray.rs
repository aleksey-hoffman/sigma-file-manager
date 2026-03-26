// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    shortcut_hint: Option<&str>,
) -> tauri::Result<Menu<R>> {
    let app_version = app.package_info().version.to_string();
    let app_name = app.package_info().name.to_string();
    let main_title_text = format!("{} – v{}", app_name, app_version);

    let show_text = match shortcut_hint {
        Some(hint) => format!("Open window ({})", hint),
        None => "Open window".to_string(),
    };
    let title_item = MenuItem::with_id(app, "title", &main_title_text, false, None::<&str>)?;
    let show_item = MenuItem::with_id(app, "show_main_window", &show_text, true, None::<&str>)?;
    let reload_item = MenuItem::with_id(
        app,
        "reload_main_window",
        "Reload window",
        true,
        None::<&str>,
    )?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &title_item,
            &PredefinedMenuItem::separator(app)?,
            &show_item,
            &reload_item,
            &PredefinedMenuItem::separator(app)?,
            &quit_item,
        ],
    )
}

pub fn setup_system_tray<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let app_version = app.package_info().version.to_string();
    let app_name = app.package_info().name.to_string();
    let tooltip_text = format!("{} – v{}", app_name, app_version);

    let menu = build_tray_menu(app, None)?;

    let _tray = TrayIconBuilder::with_id("main")
        .tooltip(&tooltip_text)
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            on_system_tray_event(tray.app_handle(), event);
        })
        .build(app)?;

    Ok(())
}

pub fn on_system_tray_event<R: Runtime>(app: &AppHandle<R>, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Left,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
        } => {
            focus_main_window(app);
        }
        TrayIconEvent::Click {
            button: tauri::tray::MouseButton::Right,
            button_state: tauri::tray::MouseButtonState::Up,
            ..
        } => {
            // Right click handled by context menu
        }
        TrayIconEvent::Enter { .. } => {
            // Mouse entered tray icon area
        }
        TrayIconEvent::Leave { .. } => {
            // Mouse left tray icon area
        }
        _ => {}
    }
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        "show_main_window" => show_main_window(app),
        "reload_main_window" => reload_main_window(app),
        "quit" => quit_app(app),
        _ => {}
    }
}

pub fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn focus_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_focused = window.is_focused().unwrap_or(false);
        let is_minimized = window.is_minimized().unwrap_or(false);

        if is_minimized {
            let _ = window.unminimize();
            show_main_window(app);
            return;
        }

        if !is_focused {
            show_main_window(app);
        }
    }
}

pub fn reload_main_window<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.reload() {
            eprintln!("Failed to reload window: {:?}", error);
        }
    } else {
        eprintln!("Main window not found");
    }
}

#[tauri::command]
pub fn reload_webview(app: tauri::AppHandle) {
    reload_main_window(&app);
}

#[tauri::command]
pub fn update_tray_shortcut(app: tauri::AppHandle, shortcut: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let shortcut_hint = if shortcut.is_empty() {
            None
        } else {
            Some(shortcut.as_str())
        };
        if let Ok(menu) = build_tray_menu(&app, shortcut_hint) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

pub fn quit_app<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    app.exit(0);
}
