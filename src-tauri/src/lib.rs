// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod app_updater;
mod archive;
mod background_sources;
mod copy_move_job;
mod default_file_manager;
mod delete_job;
mod dir_reader;
mod dir_size;
mod dir_watcher;
mod extensions;
mod file_operations;
mod global_search;
mod lan_share;
mod open_with;
mod startup_storage_bootstrap;
mod system_icons;
mod system_tray;
mod terminal;
#[cfg(windows)]
mod url_drop;
mod user_storage_files_config;
pub mod utils;

use serde::Serialize;
use tauri::{Emitter, Manager};

const SIGMA_AUTOSTART_CLI_FLAG: &str = "--sigma-autostart";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct LaunchContext {
    args: Vec<String>,
    cwd: Option<String>,
    executable_dir: Option<String>,
    had_absorbed_shell_paths: bool,
    had_delegated_shell_paths: bool,
}

#[cfg(windows)]
fn is_shell_namespace_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    path.starts_with("::{") || lower.starts_with("shell:")
}

#[cfg(windows)]
fn is_sfm_absorbed_shell_path(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    matches!(
        lower.as_str(),
        "::{20d04fe0-3aea-1069-a2d8-08002b30309d}"
            | "shell:mycomputerfolder"
            | "shell:::{20d04fe0-3aea-1069-a2d8-08002b30309d}"
    )
}

#[cfg(windows)]
fn open_in_native_explorer(path: &str) {
    let _ = std::process::Command::new("explorer.exe").arg(path).spawn();
}

#[cfg(windows)]
struct ShellFilterResult {
    filtered_args: Vec<String>,
    had_absorbed_paths: bool,
    delegated_paths: Vec<String>,
}

#[cfg(windows)]
impl ShellFilterResult {
    fn had_delegated_paths(&self) -> bool {
        !self.delegated_paths.is_empty()
    }
}

#[cfg(windows)]
fn filter_shell_namespace_args(args: Vec<String>) -> ShellFilterResult {
    let mut filtered = Vec::with_capacity(args.len());
    let mut had_absorbed_paths = false;
    let mut delegated_paths = Vec::new();

    for (index, arg) in args.into_iter().enumerate() {
        if index == 0 {
            filtered.push(arg);
            continue;
        }

        if is_shell_namespace_path(&arg) {
            if is_sfm_absorbed_shell_path(&arg) {
                had_absorbed_paths = true;
            } else {
                delegated_paths.push(arg);
            }
            continue;
        }

        filtered.push(arg);
    }

    ShellFilterResult {
        filtered_args: filtered,
        had_absorbed_paths,
        delegated_paths,
    }
}

#[cfg(windows)]
fn delegate_shell_namespace_paths(paths: &[String]) {
    for path in paths {
        open_in_native_explorer(path);
    }
}

fn launched_from_autostart(args: &[String]) -> bool {
    args.iter().any(|arg| arg == SIGMA_AUTOSTART_CLI_FLAG)
}

fn build_launch_context(
    args: Vec<String>,
    cwd: Option<String>,
    had_absorbed_shell_paths: bool,
    had_delegated_shell_paths: bool,
) -> LaunchContext {
    let executable_dir = std::env::current_exe().ok().and_then(|path| {
        path.parent()
            .map(|parent| parent.to_string_lossy().into_owned())
    });

    let resolved_cwd = cwd.or_else(|| {
        std::env::current_dir()
            .ok()
            .map(|path| path.to_string_lossy().into_owned())
    });

    LaunchContext {
        args,
        cwd: resolved_cwd,
        executable_dir,
        had_absorbed_shell_paths,
        had_delegated_shell_paths,
    }
}

#[tauri::command]
fn get_launch_context() -> LaunchContext {
    let raw_args: Vec<String> = std::env::args().collect();

    #[cfg(windows)]
    {
        let filter_result = filter_shell_namespace_args(raw_args);
        let had_delegated_shell_paths = filter_result.had_delegated_paths();
        build_launch_context(
            filter_result.filtered_args,
            None,
            filter_result.had_absorbed_paths,
            had_delegated_shell_paths,
        )
    }
    #[cfg(not(windows))]
    {
        build_launch_context(raw_args, None, false, false)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(startup_storage_bootstrap::StartupStorageBootstrapState::default())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            #[cfg(windows)]
            {
                let filter_result = filter_shell_namespace_args(argv);
                delegate_shell_namespace_paths(&filter_result.delegated_paths);
                let has_filesystem_paths = filter_result.filtered_args.len() > 1;
                let should_focus = has_filesystem_paths
                    || filter_result.had_absorbed_paths
                    || !filter_result.had_delegated_paths();

                if should_focus {
                    system_tray::focus_main_window(app);
                }

                if has_filesystem_paths {
                    let had_delegated_shell_paths = filter_result.had_delegated_paths();
                    let launch_context = build_launch_context(
                        filter_result.filtered_args,
                        Some(cwd),
                        filter_result.had_absorbed_paths,
                        had_delegated_shell_paths,
                    );
                    let _ = app.emit("app-launch-args", launch_context);
                }
            }

            #[cfg(not(windows))]
            {
                system_tray::focus_main_window(app);
                let launch_context = build_launch_context(argv, Some(cwd), false, false);
                let _ = app.emit("app-launch-args", launch_context);
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin({
            use tauri_plugin_window_state::StateFlags;
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::VISIBLE)
                .with_denylist(&["quick-view"])
                .build()
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_system_fonts::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .args([SIGMA_AUTOSTART_CLI_FLAG])
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            get_launch_context,
            startup_storage_bootstrap::get_startup_storage_bootstrap,
            default_file_manager::is_default_file_manager,
            default_file_manager::set_default_file_manager,
            app_updater::check_for_updates,
            app_updater::download_release_installer,
            app_updater::app_updates_managed_externally,
            system_tray::reload_webview,
            system_tray::update_tray_shortcut,
            dir_reader::read_dir,
            dir_reader::read_dir_with_timeout,
            dir_reader::get_dir_entry,
            dir_reader::get_dir_entry_with_timeout,
            dir_reader::resolve_windows_directory_shortcut,
            dir_reader::get_system_drives,
            dir_reader::get_parent_dir,
            dir_reader::path_exists,
            dir_reader::path_exists_with_timeout,
            dir_reader::paths_are_directories,
            dir_reader::get_mountable_devices,
            dir_reader::mount_drive,
            dir_reader::unmount_drive,
            dir_reader::mount_network_share,
            dir_size::get_dir_size,
            dir_size::get_dir_sizes_batch,
            dir_size::get_dir_size_progress,
            dir_size::get_active_calculations,
            dir_size::invalidate_dir_size_cache,
            dir_size::clear_dir_size_cache,
            dir_size::cancel_dir_size,
            file_operations::check_conflicts,
            file_operations::copy_items,
            file_operations::ensure_directory,
            file_operations::move_items,
            file_operations::rename_item,
            file_operations::delete_items,
            file_operations::create_item,
            archive::start_archive_job,
            archive::cancel_archive_job,
            copy_move_job::start_copy_move_job,
            copy_move_job::cancel_copy_move_job,
            delete_job::start_delete_job,
            delete_job::cancel_delete_job,
            global_search::global_search_init,
            global_search::global_search_get_status,
            global_search::global_search_start_scan,
            global_search::global_search_cancel_scan,
            global_search::global_search_index_paths,
            global_search::global_search_query,
            global_search::global_search_query_paths,
            open_with::get_associated_programs,
            open_with::open_with_program,
            open_with::open_with_default,
            open_with::open_native_open_with_dialog,
            open_with::get_shell_context_menu,
            open_with::invoke_shell_context_menu_item,
            system_icons::get_system_icon,
            terminal::get_available_terminals,
            terminal::get_terminal_icons,
            terminal::open_terminal,
            dir_watcher::watch_directory,
            dir_watcher::unwatch_directory,
            dir_watcher::get_watched_directories,
            extensions::register_extension_install_cancellation,
            extensions::cancel_extension_install_cancellation,
            extensions::clear_extension_install_cancellation,
            extensions::get_extensions_dir,
            extensions::get_extension_path,
            extensions::get_extension_storage_path,
            extensions::download_extension,
            extensions::delete_extension,
            extensions::install_local_extension,
            extensions::get_installed_extensions,
            extensions::read_extension_manifest,
            extensions::read_extension_file,
            extensions::read_text_preview,
            extensions::read_file_binary,
            extensions::write_file_binary,
            extensions::import_extension_storage_file,
            extensions::delete_file_binary,
            extensions::is_path_within_directory,
            extensions::extension_path_exists,
            extensions::run_extension_command,
            extensions::download_extension_file,
            extensions::start_extension_command,
            extensions::cancel_extension_command,
            extensions::cancel_all_extension_commands,
            extensions::rename_part_files_to_ts,
            extensions::get_platform_info,
            extensions::get_extension_binary_path,
            extensions::download_extension_binary,
            extensions::remove_extension_binary,
            extensions::extension_binary_exists,
            extensions::download_and_extract_extension_binary,
            extensions::get_shared_binary_path,
            extensions::download_shared_binary,
            extensions::download_and_extract_shared_binary,
            extensions::remove_shared_binary,
            extensions::shared_binary_exists,
            extensions::get_shared_binaries_base_dir,
            extensions::fetch_github_tags,
            extensions::fetch_url_text,
            background_sources::resolve_background_source_to_cache,
            background_sources::download_url_to_path,
            background_sources::copy_files_to_backgrounds,
            lan_share::start_lan_share,
            lan_share::stop_lan_share,
            lan_share::get_local_ip,
        ])
        .setup(setup_handler)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() == "main" {
                    tokio::spawn(async { lan_share::stop_lan_share().await.ok() });
                }
            }
        })
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

    system_tray::setup_system_tray(app.handle())?;
    startup_storage_bootstrap::migrate_legacy_user_storage_filenames(app.handle());
    startup_storage_bootstrap::start_preload(
        app.handle().clone(),
        app.state::<startup_storage_bootstrap::StartupStorageBootstrapState>()
            .inner()
            .clone(),
    );

    let raw_args: Vec<String> = std::env::args().collect();

    #[cfg(windows)]
    let should_hide_main_window_on_startup = {
        let filter_result = filter_shell_namespace_args(raw_args.clone());
        delegate_shell_namespace_paths(&filter_result.delegated_paths);
        url_drop::setup(app.handle());

        let launched_only_with_delegated_paths = !filter_result.had_absorbed_paths
            && filter_result.had_delegated_paths()
            && filter_result.filtered_args.len() <= 1;

        launched_from_autostart(&raw_args) || launched_only_with_delegated_paths
    };

    #[cfg(not(windows))]
    let should_hide_main_window_on_startup = launched_from_autostart(&raw_args);

    if !should_hide_main_window_on_startup {
        if let Some(main_window) = app.get_webview_window("main") {
            let _ = main_window.show();
        }
    }

    #[cfg(feature = "devtools")]
    {
        use tauri::Manager;
        if let Some(window) = app.get_webview_window("main") {
            window.open_devtools();
        }
    }

    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::filter_shell_namespace_args;

    #[test]
    fn delegated_shell_namespace_paths_are_removed_from_launch_args() {
        let result = filter_shell_namespace_args(vec![
            "sigma-file-manager.exe".to_string(),
            "shell:downloads".to_string(),
            "C:\\Users\\aleks\\Documents".to_string(),
        ]);

        assert_eq!(
            result.filtered_args,
            vec![
                "sigma-file-manager.exe".to_string(),
                "C:\\Users\\aleks\\Documents".to_string(),
            ]
        );
        assert_eq!(result.delegated_paths, vec!["shell:downloads".to_string()]);
        assert!(!result.had_absorbed_paths);
        assert!(result.had_delegated_paths());
    }

    #[test]
    fn absorbed_shell_namespace_paths_are_tracked_without_delegation() {
        let result = filter_shell_namespace_args(vec![
            "sigma-file-manager.exe".to_string(),
            "shell:MyComputerFolder".to_string(),
        ]);

        assert_eq!(
            result.filtered_args,
            vec!["sigma-file-manager.exe".to_string()]
        );
        assert!(result.delegated_paths.is_empty());
        assert!(result.had_absorbed_paths);
        assert!(!result.had_delegated_paths());
    }
}
