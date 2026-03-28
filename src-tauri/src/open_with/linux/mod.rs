// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

mod desktop;
mod mime;
mod open;

pub use open::{get_associated_programs_impl, open_with_desktop_id};
