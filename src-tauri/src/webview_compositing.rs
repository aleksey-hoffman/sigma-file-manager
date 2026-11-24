// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(any(test, all(target_os = "linux", not(feature = "cef"))))]
fn compositing_mode_value_disables_compositing(value: Option<&std::ffi::OsStr>) -> bool {
    value.is_some_and(|value| value != "0")
}

/// WebKitGTK crashes on view transitions when `WEBKIT_DISABLE_COMPOSITING_MODE` turns compositing
/// off, so the frontend skips them in that mode. WebKitGTK treats any value except "0" as set.
#[tauri::command]
pub fn webview_compositing_disabled() -> bool {
    #[cfg(all(target_os = "linux", not(feature = "cef")))]
    {
        compositing_mode_value_disables_compositing(
            std::env::var_os("WEBKIT_DISABLE_COMPOSITING_MODE").as_deref(),
        )
    }

    #[cfg(not(all(target_os = "linux", not(feature = "cef"))))]
    {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::compositing_mode_value_disables_compositing;
    use std::ffi::OsStr;

    fn value_disables_compositing(value: &str) -> bool {
        compositing_mode_value_disables_compositing(Some(OsStr::new(value)))
    }

    #[test]
    fn compositing_stays_on_when_the_variable_is_unset_or_zero() {
        assert!(!compositing_mode_value_disables_compositing(None));
        assert!(!value_disables_compositing("0"));
    }

    #[test]
    fn any_other_value_turns_compositing_off() {
        assert!(value_disables_compositing("1"));
        assert!(value_disables_compositing(""));
        assert!(value_disables_compositing("true"));
    }
}
