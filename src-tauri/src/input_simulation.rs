// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
fn simulate_paste_shortcut_sync() -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP,
        VIRTUAL_KEY, VK_CONTROL, VK_V,
    };

    fn create_keyboard_input(
        virtual_key: VIRTUAL_KEY,
        flags: KEYBD_EVENT_FLAGS,
    ) -> INPUT {
        INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: virtual_key,
                    wScan: 0,
                    dwFlags: flags,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        }
    }

    unsafe {
        let inputs = [
            create_keyboard_input(VK_CONTROL, KEYBD_EVENT_FLAGS(0)),
            create_keyboard_input(VK_V, KEYBD_EVENT_FLAGS(0)),
            create_keyboard_input(VK_V, KEYEVENTF_KEYUP),
            create_keyboard_input(VK_CONTROL, KEYEVENTF_KEYUP),
        ];
        let sent_count = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);

        if sent_count as usize != inputs.len() {
            return Err("Failed to simulate paste shortcut".to_string());
        }
    }

    Ok(())
}

#[cfg(not(windows))]
fn simulate_paste_shortcut_sync() -> Result<(), String> {
    Err("Paste shortcut simulation is not supported on this platform".to_string())
}

#[tauri::command]
pub async fn simulate_paste_shortcut() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(simulate_paste_shortcut_sync)
        .await
        .map_err(|error| error.to_string())?
}
