// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub mod compress;
pub mod encoding;
pub mod extract;
pub mod jobs;

#[cfg(unix)]
pub use extract::safe_unix_mode;
pub use extract::{extract_zip_to_directory, is_safe_archive_relative_path};
