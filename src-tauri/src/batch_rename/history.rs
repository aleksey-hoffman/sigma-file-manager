// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 批量改名的操作历史与撤销。
//!
//! # 与失败回滚的区别
//!
//! 两者都在「把文件移回去」，但触发时机和语义完全不同：
//!
//! | | [`crate::batch_rename::executor`] 的回滚 | 本模块的撤销 |
//! |---|---|---|
//! | 触发 | 本批改名**中途出错**，自动发生 | 用户主动点「撤销」 |
//! | 数据来源 | 执行过程中的内存状态 | 跨进程持久化的日志文件 |
//! | 结果 | 目录回到**本批执行前** | 目录回到**某个历史批次执行前** |
//!
//! 所以撤销不能复用回滚那段代码：回滚能靠内存里的计划反推，
//! 撤销只能靠磁盘上的记录，且记录可能已经**过期**（用户中途动过文件）。
//!
//! # 过期记录怎么办
//!
//! 历史是「当时的情况」，用户可能在改名后又手动改了文件。
//! 撤销前必须重新跑一次冲突检测：目标名已被占用就**拒绝撤销并如实报错**，
//! 绝不能覆盖用户后来的文件。

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::batch_rename::conflict::{PlannedRename, detect, normalize_for_compare};
use crate::batch_rename::executor::{ExecutionOutcome, MoveBackend};

/// 保留最近多少条。超过就淘汰最老的。
pub const MAX_HISTORY_ENTRIES: usize = 10;

const HISTORY_FILE_NAME: &str = "batch-rename-history.json";

/// 一条改名记录。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    /// 改名前的完整路径。
    pub from: String,
    /// 改名后的完整路径。
    pub to: String,
}

/// 一批改名的记录。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    /// Unix 毫秒。
    pub timestamp_ms: u64,
    /// 该批次所在目录。
    pub directory: String,
    pub items: Vec<HistoryItem>,
    /// 条目数，给 UI 显示用，避免前端每次都遍历。
    pub item_count: usize,
}

impl HistoryEntry {
    /// 供 UI 显示的一行摘要，例如「改名 12 个文件」。
    pub fn summary_key(&self) -> String {
        "batchRename.history.itemCount".to_string()
    }
}

/// 历史文件路径。
///
/// 与 startup_probe 同一个 `logs` 目录，用户报障时只需要看一个地方。
/// 注意 `com.sigma-file-manager.app` 是**受保护常量**，与 Tauri `identifier`
/// 保持一致，不要因为产品改名而改它。
fn history_file() -> Option<PathBuf> {
    dirs::data_local_dir().map(|dir| {
        dir.join("com.sigma-file-manager.app")
            .join("logs")
            .join(HISTORY_FILE_NAME)
    })
}

/// 读取全部历史，最新的在前。
///
/// **永不 panic**：文件不存在是正常情况（首次运行），
/// 文件损坏则当作空历史处理并保留原文件供事后排查。
pub fn load() -> Vec<HistoryEntry> {
    let Some(path) = history_file() else {
        return Vec::new();
    };
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    match serde_json::from_str::<Vec<HistoryEntry>>(&raw) {
        Ok(entries) => entries,
        Err(_) => Vec::new(),
    }
}

/// 把新记录写入历史，并淘汰超出上限的旧记录。
pub fn record(entry: HistoryEntry) -> Result<(), String> {
    let path = history_file().ok_or_else(|| "无法定位历史文件目录".to_string())?;

    let mut entries = load();
    entries.insert(0, entry);
    entries.truncate(MAX_HISTORY_ENTRIES);

    write_atomically(&path, &entries)
}

/// 删除某条记录（撤销成功后调用）。
pub fn remove(id: &str) -> Result<(), String> {
    let path = history_file().ok_or_else(|| "无法定位历史文件目录".to_string())?;
    let entries: Vec<HistoryEntry> = load().into_iter().filter(|e| e.id != id).collect();
    if entries.is_empty() {
        // 全删光时把文件本身也删掉，避免留一个空数组文件。
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    write_atomically(&path, &entries)
}

/// 先写临时文件再 rename，避免中途崩溃留下半个 JSON。
///
/// Windows 上 `rename` 对已存在目标会失败，所以先删旧的。
fn write_atomically(path: &Path, entries: &[HistoryEntry]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建历史目录失败: {e}"))?;
    }

    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("序列化历史失败: {e}"))?;

    let temp = path.with_extension("json.tmp");
    std::fs::write(&temp, json.as_bytes()).map_err(|e| format!("写入临时历史失败: {e}"))?;

    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    std::fs::rename(&temp, path).map_err(|e| format!("提交历史文件失败: {e}"))
}

/// 撤销结果。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UndoOutcome {
    pub entry_id: String,
    pub restored_count: usize,
    pub failed: Option<String>,
    /// 因目标名被占用而**未能撤销**时的阻断清单。
    pub blocked_by: Vec<String>,
    pub rollback: crate::batch_rename::executor::RollbackOutcome,
}

impl UndoOutcome {
    pub fn is_successful(&self) -> bool {
        self.failed.is_none() && self.blocked_by.is_empty() && self.rollback.succeeded
    }
}

/// 撤销指定的一条历史记录。
pub fn undo<B: MoveBackend>(id: &str, backend: &B) -> UndoOutcome {
    let Some(entry) = load().into_iter().find(|e| e.id == id) else {
        return UndoOutcome {
            entry_id: id.to_string(),
            restored_count: 0,
            failed: Some("找不到该条历史记录".to_string()),
            blocked_by: Vec::new(),
            rollback: crate::batch_rename::executor::RollbackOutcome {
                attempted: false,
                succeeded: true,
                error: None,
            },
        };
    };

    undo_entry(&entry, backend)
}

/// 撤销一条已加载的记录。测试可直接调用，不必经过文件。
pub fn undo_entry<B: MoveBackend>(entry: &HistoryEntry, backend: &B) -> UndoOutcome {
    let directory = PathBuf::from(&entry.directory);
    let blocked = UndoOutcome {
        entry_id: entry.id.clone(),
        restored_count: 0,
        failed: None,
        blocked_by: Vec::new(),
        rollback: crate::batch_rename::executor::RollbackOutcome {
            attempted: false,
            succeeded: true,
            error: None,
        },
    };

    // 反向映射：把 `to` 当作当前位置，`from` 当作目标名。
    let mut entries: Vec<PlannedRename> = Vec::new();
    let mut missing = 0usize;
    for item in &entry.items {
        let current = PathBuf::from(&item.to);
        if !current.exists() {
            // 文件已不在原位（用户动过，或中途失败了）。
            // 跳过而不是硬报错，否则一条陈旧记录会让整次撤销都做不了。
            missing += 1;
            continue;
        }
        entries.push(PlannedRename {
            path: current.to_string_lossy().to_string(),
            old_name: file_name_of(&item.to).to_string(),
            new_name: file_name_of(&item.from).to_string(),
            unchanged: false,
        });
    }

    if entries.is_empty() {
        return UndoOutcome {
            failed: Some(format!("该批次的 {} 个文件都已不在原位，无法撤销", missing)),
            ..blocked
        };
    }

    // 撤销前重新检测冲突：历史是过去式，用户可能已经新建了同名文件。
    let existing = sibling_names(&directory);
    let report = detect(&entries, &existing);

    if !report.is_executable() {
        let mut blocked_by: Vec<String> = report
            .conflicts
            .iter()
            .map(|c| c.target_name.clone())
            .collect();
        blocked_by.extend(report.invalid_names.iter().map(|n| n.target_name.clone()));
        return UndoOutcome {
            blocked_by,
            failed: Some("撤销被阻断：目标名已被占用或非法".to_string()),
            ..blocked
        };
    }

    let outcome: ExecutionOutcome =
        crate::batch_rename::executor::execute(&entries, &report.needs_staging, &directory, backend);

    let (restored, failed) = if outcome.is_fully_successful() {
        (entries.len(), None)
    } else {
        (
            0,
            outcome
                .failed
                .first()
                .map(|f| f.error.clone())
                .or(Some("撤销执行失败".to_string())),
        )
    };

    UndoOutcome {
        entry_id: entry.id.clone(),
        restored_count: restored,
        failed,
        blocked_by: Vec::new(),
        rollback: outcome.rollback,
    }
}

/// 目录下现有文件名。
fn sibling_names(directory: &Path) -> HashSet<String> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return HashSet::new();
    };
    entries
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect()
}

fn file_name_of(path: &str) -> &str {
    match path.rfind(['/', '\\']) {
        Some(i) => &path[i + 1..],
        None => path,
    }
}

/// 生成一条历史记录的 id。时间戳 + 计数，够用且不引新依赖。
pub fn make_entry_id(timestamp_ms: u64, seq: u64) -> String {
    format!("{timestamp_ms}-{seq}")
}

/// 用当前批次结果构造历史记录。
pub fn build_entry(
    id: String,
    timestamp_ms: u64,
    directory: &Path,
    planned: &[PlannedRename],
) -> HistoryEntry {
    let items = planned
        .iter()
        .filter(|p| !p.unchanged)
        .map(|p| HistoryItem {
            from: p.path.clone(),
            to: directory.join(&p.new_name).to_string_lossy().to_string(),
        })
        .collect::<Vec<_>>();

    HistoryEntry {
        item_count: items.len(),
        id,
        timestamp_ms,
        directory: directory.to_string_lossy().to_string(),
        items,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct RealBackend;
    impl MoveBackend for RealBackend {
        fn move_item(&self, from: &str, to: &str) -> Result<(), String> {
            std::fs::rename(from, to).map_err(|e| format!("{from} -> {to}: {e}"))
        }
    }

    fn make_file(dir: &Path, name: &str, content: &str) {
        std::fs::write(dir.join(name), content).unwrap();
    }

    fn entry(dir: &Path, old: &str, new: &str) -> PlannedRename {
        PlannedRename {
            path: dir.join(old).to_string_lossy().to_string(),
            old_name: old.to_string(),
            new_name: new.to_string(),
            unchanged: normalize_for_compare(old) == normalize_for_compare(new),
        }
    }

    fn snapshot(dir: &Path) -> std::collections::HashMap<String, String> {
        std::fs::read_dir(dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_file())
            .map(|e| {
                (
                    e.file_name().to_string_lossy().to_string(),
                    std::fs::read_to_string(e.path()).unwrap_or_default(),
                )
            })
            .collect()
    }

    fn make_history(dir: &Path, pairs: &[(&str, &str)], contents: &[(&str, &str)]) -> HistoryEntry {
        for (name, content) in contents {
            make_file(dir, name, content);
        }
        let planned: Vec<PlannedRename> = pairs
            .iter()
            .map(|(o, n)| entry(dir, o, n))
            .collect();
        build_entry("test-1".into(), 1_700_000_000_000, dir, &planned)
    }

    // ---------- 撤销往返 ----------

    #[test]
    fn undo_restores_original_names() {
        let dir = tempfile::tempdir().unwrap();
        let history = make_history(
            dir.path(),
            &[("old1.txt", "new1.txt"), ("old2.txt", "new2.txt")],
            &[("old1.txt", "内容1"), ("old2.txt", "内容2")],
        );

        // 先真的执行改名
        let planned: Vec<PlannedRename> = history
            .items
            .iter()
            .map(|i| PlannedRename {
                path: i.from.clone(),
                old_name: file_name_of(&i.from).to_string(),
                new_name: file_name_of(&i.to).to_string(),
                unchanged: false,
            })
            .collect();
        crate::batch_rename::executor::execute(&planned, &[], dir.path(), &RealBackend);
        assert!(dir.path().join("new1.txt").exists());

        // 再撤销
        let outcome = undo_entry(&history, &RealBackend);
        assert!(outcome.is_successful(), "{outcome:?}");
        assert_eq!(outcome.restored_count, 2);

        let after = snapshot(dir.path());
        assert_eq!(after.get("old1.txt"), Some(&"内容1".to_string()));
        assert_eq!(after.get("old2.txt"), Some(&"内容2".to_string()));
        assert_eq!(after.len(), 2, "{after:?}");
    }

    #[test]
    fn undo_of_a_swap_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let history = make_history(
            dir.path(),
            &[("a.txt", "b.txt"), ("b.txt", "a.txt")],
            &[("a.txt", "原本是A"), ("b.txt", "原本是B")],
        );
        let before = snapshot(dir.path());

        let planned: Vec<PlannedRename> = history
            .items
            .iter()
            .map(|i| PlannedRename {
                path: i.from.clone(),
                old_name: file_name_of(&i.from).to_string(),
                new_name: file_name_of(&i.to).to_string(),
                unchanged: false,
            })
            .collect();
        crate::batch_rename::executor::execute(&planned, &[0, 1], dir.path(), &RealBackend);

        let outcome = undo_entry(&history, &RealBackend);
        assert!(outcome.is_successful(), "{outcome:?}");
        // 交换的撤销也是交换，靠 build_staging_plan 处理。
        assert_eq!(snapshot(dir.path()), before, "交换后撤销必须完全还原");
    }

    // ---------- 过期记录 ----------

    #[test]
    fn undo_is_blocked_when_original_name_got_occupied() {
        let dir = tempfile::tempdir().unwrap();
        let history = make_history(
            dir.path(),
            &[("old.txt", "new.txt")],
            &[("old.txt", "原内容")],
        );
        // 执行改名，然后用户又新建了一个 old.txt。
        std::fs::rename(dir.path().join("old.txt"), dir.path().join("new.txt")).unwrap();
        make_file(dir.path(), "old.txt", "用户后来新建的");

        let outcome = undo_entry(&history, &RealBackend);
        assert!(!outcome.is_successful());
        assert_eq!(outcome.blocked_by, vec!["old.txt".to_string()]);
        // 关键：绝不能覆盖用户后来新建的文件。
        assert_eq!(
            std::fs::read_to_string(dir.path().join("old.txt")).unwrap(),
            "用户后来新建的"
        );
    }

    #[test]
    fn undo_skips_entries_whose_file_vanished() {
        let dir = tempfile::tempdir().unwrap();
        let history = make_history(
            dir.path(),
            &[("a.txt", "x.txt"), ("b.txt", "y.txt")],
            &[("a.txt", "A"), ("b.txt", "B")],
        );
        std::fs::rename(dir.path().join("a.txt"), dir.path().join("x.txt")).unwrap();
        std::fs::rename(dir.path().join("b.txt"), dir.path().join("y.txt")).unwrap();
        // b 对应的文件被用户删了。
        std::fs::remove_file(dir.path().join("y.txt")).unwrap();

        let outcome = undo_entry(&history, &RealBackend);
        // 剩下的 a 要能撤销，而不是因为 b 缺失就整批放弃。
        assert!(outcome.is_successful(), "{outcome:?}");
        assert_eq!(outcome.restored_count, 1);
        assert!(dir.path().join("a.txt").exists());
    }

    #[test]
    fn undo_reports_missing_entry_id() {
        let outcome = undo("不存在的id", &RealBackend);
        assert!(!outcome.is_successful());
        assert!(outcome.failed.unwrap().contains("找不到"));
    }

    // ---------- 历史条目构造 ----------

    #[test]
    fn build_entry_records_only_changed_items() {
        let dir = tempfile::tempdir().unwrap();
        let planned = vec![
            entry(dir.path(), "a.txt", "x.txt"),
            entry(dir.path(), "same.txt", "same.txt"),
        ];
        let built = build_entry("id-1".into(), 123, dir.path(), &planned);

        assert_eq!(built.item_count, 1, "未变化的条目不该进历史");
        assert_eq!(built.items.len(), 1);
        assert!(built.items[0].from.ends_with("a.txt"));
        assert!(built.items[0].to.ends_with("x.txt"));
    }

    #[test]
    fn make_entry_id_is_distinct_per_batch() {
        assert_ne!(make_entry_id(100, 0), make_entry_id(100, 1));
        assert_eq!(make_entry_id(100, 3), "100-3");
    }

    #[test]
    fn history_entry_round_trips_through_json() {
        let entry = HistoryEntry {
            id: "x".into(),
            timestamp_ms: 5,
            directory: "C:/d".into(),
            item_count: 1,
            items: vec![HistoryItem {
                from: "C:/d/a".into(),
                to: "C:/d/b".into(),
            }],
        };
        let json = serde_json::to_string(&entry).unwrap();
        let parsed: HistoryEntry = serde_json::from_str(&json).unwrap();
        assert_eq!(entry, parsed);
    }

    #[test]
    fn max_history_is_ten() {
        assert_eq!(MAX_HISTORY_ENTRIES, 10);
    }
}