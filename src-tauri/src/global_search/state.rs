// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::types::GlobalSearchStatus;
use once_cell::sync::Lazy;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use tantivy::schema::Field;
use tantivy::{Index, IndexReader};

#[derive(Debug, Clone, Copy)]
pub(super) struct GlobalSearchIndexFields {
    pub(super) path: Field,
    pub(super) name: Field,
    pub(super) name_lower: Field,
    pub(super) is_file: Field,
    pub(super) is_dir: Field,
    pub(super) modified_time: Field,
    pub(super) size: Field,
}

pub(super) struct GlobalSearchState {
    pub(super) status: GlobalSearchStatus,
    pub(super) index: Option<Index>,
    pub(super) reader: Option<IndexReader>,
    pub(super) fields: Option<GlobalSearchIndexFields>,
    pub(super) cancel_flag: Arc<AtomicBool>,
}

pub(super) static GLOBAL_SEARCH_STATE: Lazy<Arc<RwLock<GlobalSearchState>>> = Lazy::new(|| {
    Arc::new(RwLock::new(GlobalSearchState {
        status: GlobalSearchStatus {
            is_scan_in_progress: false,
            is_committing: false,
            is_parallel_scan: false,
            last_scan_time: None,
            indexed_item_count: 0,
            index_size_bytes: 0,
            current_drive_root: None,
            drive_scan_errors: vec![],
            is_index_valid: false,
            scanned_drives_count: 0,
            total_drives_count: 0,
        },
        index: None,
        reader: None,
        fields: None,
        cancel_flag: Arc::new(AtomicBool::new(false)),
    }))
});

pub(super) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}
