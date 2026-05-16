// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

#[cfg(windows)]
pub(crate) fn resolve_path_volume_case_sensitive(_path: &str) -> Result<bool, String> {
    Ok(false)
}

#[cfg(target_os = "linux")]
pub(crate) fn resolve_path_volume_case_sensitive(_path: &str) -> Result<bool, String> {
    Ok(true)
}

#[cfg(target_os = "macos")]
pub(crate) fn resolve_path_volume_case_sensitive(path: &str) -> Result<bool, String> {
    use libc::{
        self, attrlist, c_char, c_void, statfs, vol_capabilities_attr_t, ATTR_BIT_MAP_COUNT,
        ATTR_VOL_CAPABILITIES, ATTR_VOL_INFO, VOL_CAPABILITIES_FORMAT, VOL_CAP_FMT_CASE_SENSITIVE,
    };
    use std::ffi::{CStr, CString};
    use std::mem::{size_of, MaybeUninit};

    let c_path = CString::new(path).map_err(|_| "Path contained a NUL byte".to_string())?;

    let path_for_getattrlist = {
        let mut stat_buffer = MaybeUninit::<libc::statfs>::uninit();
        let stat_result = unsafe { statfs(c_path.as_ptr(), stat_buffer.as_mut_ptr()) };
        if stat_result == 0 {
            let stat = unsafe { stat_buffer.assume_init() };
            let mount_name_ptr = stat.f_mntonname.as_ptr() as *const c_char;
            if mount_name_ptr.is_null() {
                c_path.clone()
            }
            else {
                let mount_name = unsafe { CStr::from_ptr(mount_name_ptr) };
                CString::new(mount_name.to_bytes())
                    .map_err(|_| "Mount point name contained an interior NUL byte".to_string())?
            }
        }
        else {
            c_path.clone()
        }
    };

    let mut attr_list = attrlist {
        bitmapcount: ATTR_BIT_MAP_COUNT,
        reserved: 0,
        commonattr: 0,
        volattr: ATTR_VOL_INFO | ATTR_VOL_CAPABILITIES,
        dirattr: 0,
        fileattr: 0,
        forkattr: 0,
    };

    let mut buffer = [0u8; 256];
    let status = unsafe {
        libc::getattrlist(
            path_for_getattrlist.as_ptr(),
            (&mut attr_list as *mut attrlist).cast::<c_void>(),
            buffer.as_mut_ptr().cast::<c_void>(),
            buffer.len(),
            0,
        )
    };

    if status != 0 {
        return Ok(true);
    }

    if buffer.len() < size_of::<u32>() + size_of::<vol_capabilities_attr_t>() {
        return Ok(true);
    }

    let reported_length = u32::from_ne_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;

    if reported_length < size_of::<u32>() + size_of::<vol_capabilities_attr_t>() {
        return Ok(true);
    }

    let vol_caps = unsafe { &*buffer.as_ptr().add(4).cast::<vol_capabilities_attr_t>() };

    let format_valid = vol_caps.valid[VOL_CAPABILITIES_FORMAT];
    let format_caps = vol_caps.capabilities[VOL_CAPABILITIES_FORMAT];

    if format_valid & VOL_CAP_FMT_CASE_SENSITIVE == 0 {
        return Ok(false);
    }

    Ok(format_caps & VOL_CAP_FMT_CASE_SENSITIVE != 0)
}

#[cfg(all(not(windows), not(target_os = "linux"), not(target_os = "macos")))]
pub(crate) fn resolve_path_volume_case_sensitive(_path: &str) -> Result<bool, String> {
    Ok(true)
}

#[cfg(target_os = "macos")]
pub(crate) fn resolve_path_comparison_volume_roots() -> Result<Vec<String>, String> {
    let mut roots = vec!["/".to_string()];
    let entries = std::fs::read_dir("/Volumes").map_err(|error| error.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            roots.push(path.to_string_lossy().into_owned());
        }
    }
    Ok(roots)
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn resolve_path_comparison_volume_roots() -> Result<Vec<String>, String> {
    Ok(Vec::new())
}
