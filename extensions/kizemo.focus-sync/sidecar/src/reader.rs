//! Path reader: UIA ValuePattern read on a detected file dialog's filename box.

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::Accessibility::{
    IUIAutomation, IUIAutomationElement, IUIAutomationValuePattern, TreeScope_Descendants,
    UIA_EditControlTypeId, UIA_ValuePatternId,
};
use windows::core::Result as WinResult;

#[derive(Debug)]
pub enum ReadError {
    NoAutomation,
    NoEditElement,
    NoValuePattern,
    Other(String),
}

impl std::fmt::Display for ReadError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ReadError::NoAutomation => write!(f, "no UIA automation instance"),
            ReadError::NoEditElement => write!(f, "no Edit element in dialog"),
            ReadError::NoValuePattern => write!(f, "element does not support ValuePattern"),
            ReadError::Other(s) => write!(f, "UIA error: {s}"),
        }
    }
}
impl std::error::Error for ReadError {}

/// Read the current path from the filename box of the file dialog at `hwnd_isize`.
pub fn read_path(hwnd_isize: isize) -> Result<String, ReadError> {
    let uia = crate::uia_inject::automation().ok_or(ReadError::NoAutomation)?;
    let hwnd = HWND(hwnd_isize as *mut core::ffi::c_void);

    read_via_uia(&uia, hwnd).map_err(|e| ReadError::Other(format!("{e}")))
}

fn read_via_uia(uia: &IUIAutomation, hwnd: HWND) -> WinResult<String> {
    let root = unsafe { uia.ElementFromHandle(hwnd) }?;
    let condition = unsafe { uia.CreateTrueCondition() }?;
    let elements = unsafe { root.FindAll(TreeScope_Descendants, &condition) }?;
    let count = unsafe { elements.Length() }?;

    let mut best_edit: Option<IUIAutomationElement> = None;
    for i in 0..count {
        let element = unsafe { elements.GetElement(i) }?;
        let control_type = unsafe { element.CurrentControlType() }?;
        if control_type == UIA_EditControlTypeId && best_edit.is_none() {
            best_edit = Some(element);
        }
    }

    let edit = best_edit.ok_or_else(|| {
        windows::core::Error::from(windows::Win32::Foundation::E_FAIL)
    })?;
    let pattern: IUIAutomationValuePattern =
        unsafe { edit.GetCurrentPatternAs(UIA_ValuePatternId) }?;
    let value_bstr = unsafe { pattern.CurrentValue() }?;
    Ok(value_bstr.to_string())
}