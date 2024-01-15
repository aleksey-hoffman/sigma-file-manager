// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub fn auto_open_devtools(main_window: &mut tauri::Window) -> Result<(), Box<dyn std::error::Error + 'static>> {
    #[cfg(debug_assertions)]
    main_window.open_devtools();
    Ok(())
}
