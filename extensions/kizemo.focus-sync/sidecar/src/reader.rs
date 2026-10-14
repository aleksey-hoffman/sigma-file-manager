//! Path reader: recover the DIRECTORY a file dialog is currently showing.
//!
//! ============================ v0.5.13 =============================
//! The old implementation walked `FindAll(Descendants, TrueCondition)` and took
//! the FIRST element whose `ControlType == UIA_EditControlTypeId`, then read its
//! `ValuePattern`. `main.rs` fed that value in as `initial_path` under a comment
//! reading "the dialog's current path".
//!
//! It never was one. Measured 2026-10-14 with the SIDECAR'S OWN native
//! `IUIAutomation` on a live classic `#32770` Open dialog (183 descendants):
//!
//! ```text
//! === first element whose ControlType == UIA_EditControlTypeId ===
//!   idx=53  class=UIProperty  aid=System.ItemNameDisplay  value="2026-10-12"
//!
//! === nodes with automation_id 1148 / 1001 / 41477 ===
//!   idx=144 ct=50003(ComboBox) class=ComboBox         aid=1148  name="文件名(N):"
//!   idx=145 ct=50004(Edit)     class=Edit             aid=1148  name="文件名(N):"
//!   idx=162 ct=50033           class=Address Band Root aid=41477 value=None
//!   idx=165 ct=50021(Custom)   class=ToolbarWindow32   aid=1001  value=None
//!         name="地址: F:\\soft\\00selfmade\\filemanager\\_acceptance"
//! ```
//!
//! So the first Edit in a depth-first walk is a **per-file property cell inside
//! the file list** (`UIProperty` / `System.ItemNameDisplay`) — the name of the
//! first visible item — NOT the filename box. The real filename box
//! (`class=Edit aid=1148`) sits at index 145 and is never reached. Reproduced
//! live on an Edge upload picker, where the sidecar logged
//! `Read path="ad-cut"` while the dialog was sitting in
//! `F:\resourse_study\玺承\2026直播\...`.
//!
//! Confirmed against the full log history (931 `Read` events, 2026-10-01..10-14):
//!   * 12 reads (1.3%) returned anything shaped like a directory path;
//!   * 621 returned `""`; the rest returned a selected item's name
//!     (`"11.politics"`, `"图库"`, `"办公文件"`, `"report.docx"`, ...).
//!   * therefore `initial_path != current_path` held permanently, so
//!     `should_opened_write_back` was permanently true. hwnd=722614: 31 reads
//!     and 29 writes of the SAME target `E:\Models` inside 31 seconds — the
//!     flicker. (hwnd=69890 wrote a different target each time: genuine
//!     navigation, correct behaviour. Same target + repeated writes = flicker.)
//!
//! What this implementation does instead
//! -------------------------------------
//! A classic shell dialog publishes its current directory ONLY as the address
//! bar's `Name`, shaped `"地址: <path>"` / `"Address: <path>"`. Keyed on SHAPE,
//! not on id: `1001` is the filename box on WinUI 3 Save-As dialogs but the
//! breadcrumb toolbar on a classic shell one, so trusting the id alone would
//! reintroduce exactly this class of bug. `parse_address_label` accepts a value
//! only when the text past the label colon is itself a plausible directory,
//! which rejects `"文件名(N): report.txt"` even though that node carries an id
//! from the same family.
//!
//! Lookup uses a property-conditioned `FindAll` instead of a full-tree
//! `TrueCondition` walk. That walk was the source of 1515 of the 1599
//! `read_failed` log entries (1334 of them on one hwnd alone), all
//! `0x80040201` EVENT_E_ALL_SUBSCRIBERS_FAILED — the UIA provider refusing a
//! caller that re-walks the whole tree once per resync tick.
//!
//! Failure is a normal outcome, not a bug: `main.rs` already maps `Err` to an
//! empty `initial_path`, and `should_opened_write_back` refuses to write on an
//! empty one. That is the behaviour already running today for the 621 empty
//! reads, so returning `Err` degrades to a known-good path rather than
//! inventing a value that would keep re-triggering writes.
//!
//! SCOPE — this fixes the flicker only. It does NOT make navigation happen.
//! Writing `target_path` into the filename box is taken back by
//! `restore_filename_verified` without any Enter, so the dialog never moves;
//! `DialogOutcome::AddressBarWritten` and `Write strategy=uia` in the log both
//! report success for a write that changed nothing visible. Measured directly
//! (see `_acceptance/run-inject-probe.ps1`): address bar identical before and
//! after. Fixing that means changing the write strategy, not the reader.

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Accessibility::{
    IUIAutomation, IUIAutomationElement, IUIAutomationValuePattern, TreeScope_Descendants,
    UIA_ValuePatternId,
};
use windows::core::Result as WinResult;

/// AutomationId of the breadcrumb / address toolbar in a classic shell dialog.
const ADDRESS_BAR_ID: &str = "1001";

/// AutomationId of the `ComboBoxEx32` "Address Band Root". Fallback only: it
/// exposes a ValuePattern-bearing Edit just AFTER the user presses Ctrl+L,
/// which the sidecar never does on its own.
const ADDRESS_BAND_ID: &str = "41477";

#[derive(Debug)]
pub enum ReadError {
    NoAutomation,
    /// v0.5.13: nothing in the dialog yielded a directory-shaped value. Normal
    /// for dialogs parked on "This PC"; must stay an `Err` so `main.rs` skips
    /// the write instead of guessing.
    NoDirectoryFound,
    Other(String),
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::NoAutomation => write!(f, "no UIA automation instance"),
            ReadError::NoDirectoryFound => write!(f, "no directory-shaped value in dialog"),
            ReadError::Other(s) => write!(f, "UIA error: {s}"),
        }
    }
}
impl std::error::Error for ReadError {}

/// True when `s` is something the user could navigate to: `C:\...` or UNC
/// `\\server\share`. Deliberately strict — it is the guard that stops
/// `"文件名(N): report.txt"` from being mistaken for a location.
fn looks_like_dir(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    if s.starts_with("\\\\") {
        return true;
    }
    let b = s.as_bytes();
    // Requires at least "X:\" — a bare "C:" is a drive spec, not a directory,
    // and treating it as one would make it differ from every real target path.
    b.len() >= 3 && b[1] == b':' && (b[2] == b'\\' || b[2] == b'/')
}

/// Extract a directory from an address-bar label such as `"地址: C:\Users"`.
///
/// Returns `Some(path)` only when the text behind the label is itself a
/// plausible directory. A bare path with no label is accepted too, so the
/// result does not depend on the shell being localized.
fn parse_address_label(label: &str) -> Option<String> {
    let trimmed = label.trim();
    if trimmed.is_empty() {
        return None;
    }
    if looks_like_dir(trimmed) {
        return Some(trimmed.to_string());
    }
    // `^<label>: <value>` with a short label. The label must not itself contain
    // a colon, otherwise "C:\Users" would match with label "C".
    let colon = trimmed.find(':')?;
    let head = trimmed[..colon].trim();
    if head.is_empty() || head.chars().count() > 16 {
        return None;
    }
    let tail = trimmed[colon + 1..].trim();
    if looks_like_dir(tail) {
        Some(tail.to_string())
    } else {
        None
    }
}

/// Collect the address-bar candidates in ONE subtree walk.
///
/// A property-conditioned `CreatePropertyCondition` lookup would be the tidier
/// tool, but windows-rs gates it behind the `Win32_System_Variant` feature,
/// which this crate does not enable — and adding a feature flag to shave one
/// traversal is not worth touching the dependency surface for a fix whose real
/// cost driver is CALL FREQUENCY, not traversal width: `0x80040201` appeared
/// because the reader was re-invoked on every resync tick (once per 1.2s per
/// open dialog, ~200 times on the worst hwnd). Fixing what gets read collapses
/// that frequency on its own. One walk, both targets, same call count as the
/// code this replaces.
fn collect_address_candidates(
    uia: &IUIAutomation,
    root: &IUIAutomationElement,
) -> (Vec<IUIAutomationElement>, Vec<IUIAutomationElement>) {
    let mut bar = Vec::new();
    let mut band = Vec::new();

    let Ok(cond) = (unsafe { uia.CreateTrueCondition() }) else {
        return (bar, band);
    };
    let Ok(found) = (unsafe { root.FindAll(TreeScope_Descendants, &cond) }) else {
        return (bar, band);
    };
    let Ok(count) = (unsafe { found.Length() }) else {
        return (bar, band);
    };

    for i in 0..count {
        let Ok(e) = (unsafe { found.GetElement(i) }) else {
            continue;
        };
        let aid = unsafe { e.CurrentAutomationId() }
            .map(|b| b.to_string())
            .unwrap_or_default();
        if aid == ADDRESS_BAR_ID {
            bar.push(e);
        } else if aid == ADDRESS_BAND_ID {
            band.push(e);
        }
    }
    (bar, band)
}

fn current_name(e: &IUIAutomationElement) -> Option<String> {
    unsafe { e.CurrentName() }.ok().map(|b| b.to_string())
}

fn read_via_uia(uia: &IUIAutomation, hwnd: HWND) -> Option<String> {
    let root = unsafe { uia.ElementFromHandle(hwnd) }.ok()?;
    let (bar, band) = collect_address_candidates(uia, &root);

    // Primary: the breadcrumb toolbar. It has no ValuePattern — the path lives
    // in its Name — which is why the old ValuePattern reader could never find it.
    for e in bar {
        if let Some(dir) = current_name(&e).and_then(|n| parse_address_label(&n)) {
            return Some(dir);
        }
    }

    // Fallback: after Ctrl+L the address band exposes a real Edit. Shape-checked,
    // so an unexpected value degrades to "not found" rather than a guess.
    for e in band {
        let pattern: WinResult<IUIAutomationValuePattern> =
            unsafe { e.GetCurrentPatternAs(UIA_ValuePatternId) };
        if let Ok(vp) = pattern {
            if let Ok(v) = unsafe { vp.CurrentValue() } {
                if let Some(dir) = parse_address_label(&v.to_string()) {
                    return Some(dir);
                }
            }
        }
    }

    None
}

/// Read the directory the file dialog at `hwnd_isize` is currently showing.
///
/// Returns `Err(ReadError::NoDirectoryFound)` when no directory-shaped value
/// exists — callers must treat that as "do not write".
pub fn read_path(hwnd_isize: isize) -> Result<String, ReadError> {
    let uia = crate::uia_inject::automation().ok_or(ReadError::NoAutomation)?;
    let hwnd = HWND(hwnd_isize as *mut core::ffi::c_void);

    read_via_uia(&uia, hwnd).ok_or(ReadError::NoDirectoryFound)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_label_in_chinese_shell_yields_the_path() {
        assert_eq!(
            parse_address_label(r"地址: F:\soft\00selfmade\filemanager\_acceptance"),
            Some(r"F:\soft\00selfmade\filemanager\_acceptance".to_string())
        );
    }

    #[test]
    fn address_label_in_english_shell_yields_the_path() {
        assert_eq!(
            parse_address_label(r"Address: C:\Users\kizemo"),
            Some(r"C:\Users\kizemo".to_string())
        );
    }

    /// The regression guard for the actual bug: the filename box carries a label
    /// of the same SHAPE and an id from the same family. It must never be taken
    /// for a location — that mistake is the bug being fixed.
    #[test]
    fn filename_box_label_is_rejected() {
        assert_eq!(parse_address_label("文件名(N): report.txt"), None);
        assert_eq!(parse_address_label("File name(N): report.txt"), None);
        assert_eq!(parse_address_label("文件名(N): "), None);
    }

    /// Exactly the values the old reader returned over and over.
    #[test]
    fn bare_item_names_are_rejected() {
        for s in [
            "图库",
            "办公文件",
            "11.politics",
            ".obsidian",
            "ad-cut",
            "Loop Engineering 快速留存.docx",
        ] {
            assert_eq!(parse_address_label(s), None, "should reject {s:?}");
        }
    }

    #[test]
    fn bare_path_without_label_is_accepted() {
        assert_eq!(
            parse_address_label(r"  E:\Models  "),
            Some(r"E:\Models".to_string())
        );
    }

    #[test]
    fn unc_path_is_accepted_in_both_forms() {
        assert_eq!(
            parse_address_label(r"地址: \\nas\share\docs"),
            Some(r"\\nas\share\docs".to_string())
        );
        assert_eq!(
            parse_address_label(r"\\nas\share\docs"),
            Some(r"\\nas\share\docs".to_string())
        );
    }

    /// `C:` alone is a drive spec, not a directory; accepting it would make it
    /// differ from every real target path and defeat the dedup.
    #[test]
    fn bare_drive_letter_is_rejected() {
        assert_eq!(parse_address_label("C:"), None);
        assert_eq!(parse_address_label("地址: C:"), None);
    }

    #[test]
    fn empty_and_whitespace_are_rejected() {
        for s in ["", "   ", "地址:", "地址: ", ":\\foo"] {
            assert_eq!(parse_address_label(s), None, "should reject {s:?}");
        }
    }

    /// Guards the drive-letter colon from being mistaken for the label colon:
    /// split on the FIRST colon, then validate the remainder.
    #[test]
    fn label_with_colon_inside_path_is_split_once() {
        assert_eq!(
            parse_address_label(r"Address: D:\Program Files\Alpha"),
            Some(r"D:\Program Files\Alpha".to_string())
        );
    }

    #[test]
    fn overlong_head_is_not_treated_as_a_label() {
        let long = format!("{}: {}", "x".repeat(40), r"C:\dir");
        assert_eq!(parse_address_label(&long), None);
    }

    /// Whatever this returns must be a usable path, never a bare name — the
    /// caller feeds it straight into `should_opened_write_back`.
    #[test]
    fn accepted_values_always_look_like_a_directory() {
        for s in [
            r"地址: F:\a",
            r"Address: C:\b",
            r"E:\Models",
            r"\\nas\share",
        ] {
            let got = parse_address_label(s).unwrap_or_else(|| panic!("{s:?} should parse"));
            assert!(looks_like_dir(&got), "{s:?} -> {got:?} is not dir-shaped");
        }
    }
}
