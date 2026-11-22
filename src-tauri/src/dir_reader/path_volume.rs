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
            } else {
                let mount_name = unsafe { CStr::from_ptr(mount_name_ptr) };
                CString::new(mount_name.to_bytes())
                    .map_err(|_| "Mount point name contained an interior NUL byte".to_string())?
            }
        } else {
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
        return Ok(false);
    }

    if buffer.len() < size_of::<u32>() + size_of::<vol_capabilities_attr_t>() {
        return Ok(false);
    }

    let reported_length = u32::from_ne_bytes([buffer[0], buffer[1], buffer[2], buffer[3]]) as usize;

    if reported_length < size_of::<u32>() + size_of::<vol_capabilities_attr_t>() {
        return Ok(false);
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

#[cfg(any(target_os = "linux", target_os = "macos"))]
fn deepest_mount_is_network(path: &str, mounts: impl Iterator<Item = (String, bool)>) -> bool {
    let mut deepest: Option<(usize, bool)> = None;
    for (mount_point, is_network) in mounts {
        let contains_path =
            path == mount_point || crate::utils::path_is_descendant_of(path, &mount_point);
        if contains_path && deepest.map_or(true, |(length, _)| mount_point.len() > length) {
            deepest = Some((mount_point.len(), is_network));
        }
    }
    deepest.map(|(_, is_network)| is_network).unwrap_or(false)
}

#[cfg(windows)]
pub(crate) fn path_is_on_network_volume(path: &str) -> bool {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;

    const DRIVE_REMOTE: u32 = 4;

    let normalized = crate::utils::normalize_path(path);
    if normalized.starts_with("//") {
        return true;
    }
    let bytes = normalized.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return false;
    }
    let root: Vec<u16> = format!("{}:\\", bytes[0] as char)
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe { GetDriveTypeW(PCWSTR::from_raw(root.as_ptr())) == DRIVE_REMOTE }
}

#[cfg(target_os = "linux")]
pub(crate) fn path_is_on_network_volume(path: &str) -> bool {
    let Ok(mounts) = std::fs::read_to_string("/proc/self/mounts") else {
        return false;
    };
    deepest_mount_is_network(
        path,
        mounts.lines().filter_map(|line| {
            let mut fields = line.split_whitespace();
            let _device = fields.next()?;
            let mount_point = fields.next()?.replace("\040", " ");
            let file_system = fields.next()?;
            Some((
                mount_point,
                super::drives_platform::is_network_filesystem(file_system),
            ))
        }),
    )
}

#[cfg(target_os = "macos")]
pub(crate) fn path_is_on_network_volume(path: &str) -> bool {
    use std::ffi::CStr;

    let mut mounts: *mut libc::statfs = std::ptr::null_mut();
    let count = unsafe { libc::getmntinfo(&mut mounts, libc::MNT_NOWAIT) };
    if count <= 0 || mounts.is_null() {
        return false;
    }
    let mounts = unsafe { std::slice::from_raw_parts(mounts, count as usize) };
    deepest_mount_is_network(
        path,
        mounts.iter().map(|mount| {
            let mount_point = unsafe { CStr::from_ptr(mount.f_mntonname.as_ptr()) }
                .to_string_lossy()
                .into_owned();
            let file_system = unsafe { CStr::from_ptr(mount.f_fstypename.as_ptr()) }
                .to_string_lossy()
                .to_lowercase();
            let is_network = matches!(
                file_system.as_str(),
                "smbfs" | "nfs" | "afpfs" | "webdav" | "cifs" | "ftp"
            );
            (mount_point, is_network)
        }),
    )
}

#[cfg(all(not(windows), not(target_os = "linux"), not(target_os = "macos")))]
pub(crate) fn path_is_on_network_volume(_path: &str) -> bool {
    false
}
