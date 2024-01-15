// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub fn init_main_window_listeners(main_window: &mut tauri::Window) -> Result<(), Box<dyn std::error::Error + 'static>> {
    let _main_window_listener_id = main_window.listen("event-name", |event| {
        println!("got window event-name with payload {:?}", event.payload());
    });
    Ok(())
}
