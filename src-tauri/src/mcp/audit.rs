// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

/// 审计日志文件名（JSON Lines，一行一条）。
pub const MCP_AUDIT_FILE: &str = "mcp-audit.jsonl";

/// 单个日志文件上限。超过就轮转一份 `.1`，避免无上限增长。
pub const MCP_AUDIT_MAX_BYTES: u64 = 1024 * 1024;

/// 一次工具调用的结果。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AuditOutcome {
    Allowed,
    Denied,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Unix 毫秒时间戳。
    pub timestamp: u128,
    pub tool: String,
    /// 参数摘要。只记关键标识（路径 / 查询词），不整段抄参数 ——
    /// 审计的目的是「它动了什么」，不是留一份调用镜像。
    pub summary: String,
    pub outcome: AuditOutcome,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

pub fn audit_path_in(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(MCP_AUDIT_FILE)
}

/// 追加一条审计记录。写失败只记日志、不影响调用结果 ——
/// 审计不该把用户的只读查询变成失败。
pub fn append_entry_in(app_data_dir: &Path, entry: &AuditEntry) -> Result<(), String> {
    fs::create_dir_all(app_data_dir)
        .map_err(|error| format!("创建审计日志目录失败: {error}"))?;

    rotate_if_oversized_in(app_data_dir)?;

    let mut line = serde_json::to_string(entry).map_err(|error| format!("序列化审计记录失败: {error}"))?;
    line.push('\n');

    let path = audit_path_in(app_data_dir);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("打开审计日志失败: {error}"))?;
    file.write_all(line.as_bytes())
        .map_err(|error| format!("写入审计日志失败: {error}"))
}

fn rotate_if_oversized_in(app_data_dir: &Path) -> Result<(), String> {
    let path = audit_path_in(app_data_dir);
    let Ok(metadata) = fs::metadata(&path) else {
        return Ok(());
    };
    if metadata.len() <= MCP_AUDIT_MAX_BYTES {
        return Ok(());
    }

    let rotated = path.with_extension("jsonl.1");
    let _ = fs::remove_file(&rotated);
    fs::rename(&path, &rotated).map_err(|error| format!("轮转审计日志失败: {error}"))
}

/// 读取审计日志（设置页展示用）。按时间倒序返回，最新的在前。
pub fn read_entries_in(app_data_dir: &Path, limit: usize) -> Result<Vec<AuditEntry>, String> {
    let path = audit_path_in(app_data_dir);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let raw = fs::read_to_string(&path).map_err(|error| format!("读取审计日志失败: {error}"))?;
    let mut entries: Vec<AuditEntry> = raw
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| serde_json::from_str::<AuditEntry>(line).ok())
        .collect();

    entries.reverse();
    entries.truncate(limit);
    Ok(entries)
}

/// 当前 UNIX 毫秒。抽成函数是为了让测试能写出确定的断言。
pub fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0)
}

/// 审计写入器。持一把进程内互斥锁，避免并发调用把 JSON 行写串。
#[derive(Clone, Default)]
pub struct AuditLog {
    app_data_dir: Arc<PathBuf>,
    write_lock: Arc<Mutex<()>>,
}

impl AuditLog {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            app_data_dir: Arc::new(app_data_dir),
            write_lock: Arc::new(Mutex::new(())),
        }
    }

    pub fn record(
        &self,
        tool: &str,
        summary: impl Into<String>,
        outcome: AuditOutcome,
        detail: Option<String>,
    ) {
        let entry = AuditEntry {
            timestamp: now_millis(),
            tool: tool.to_string(),
            summary: summary.into(),
            outcome,
            detail,
        };

        let _guard = self.write_lock.lock().unwrap_or_else(|error| error.into_inner());
        if let Err(error) = append_entry_in(&self.app_data_dir, &entry) {
            log::warn!("Failed to append MCP audit entry: {error}");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entries_are_appended_as_one_json_object_per_line() {
        let dir = tempfile::tempdir().unwrap();

        for index in 0..3 {
            append_entry_in(
                dir.path(),
                &AuditEntry {
                    timestamp: 1_700_000_000_000 + index,
                    tool: "list_directory".into(),
                    summary: format!("D:/{index}"),
                    outcome: AuditOutcome::Allowed,
                    detail: None,
                },
            )
            .unwrap();
        }

        let raw = fs::read_to_string(audit_path_in(dir.path())).unwrap();
        assert_eq!(raw.lines().count(), 3);
        assert!(raw.lines().all(|line| serde_json::from_str::<AuditEntry>(line).is_ok()));
    }

    #[test]
    fn read_entries_returns_newest_first_and_honours_limit() {
        let dir = tempfile::tempdir().unwrap();
        for index in 0..5 {
            append_entry_in(
                dir.path(),
                &AuditEntry {
                    timestamp: index,
                    tool: "search_files".into(),
                    summary: format!("q{index}"),
                    outcome: AuditOutcome::Allowed,
                    detail: None,
                },
            )
            .unwrap();
        }

        let entries = read_entries_in(dir.path(), 2).unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].summary, "q4");
        assert_eq!(entries[1].summary, "q3");
    }

    #[test]
    fn reading_a_missing_log_is_empty_not_an_error() {
        let dir = tempfile::tempdir().unwrap();
        assert!(read_entries_in(dir.path(), 10).unwrap().is_empty());
    }

    /// 损坏的行不能让整份日志读不出来 —— 手写或半截写入都不该
    /// 让「AI 到底改了什么」变成查不到。
    #[test]
    fn malformed_lines_are_skipped_without_losing_the_rest() {
        let dir = tempfile::tempdir().unwrap();
        let mut raw = String::new();
        raw.push_str(
            &serde_json::to_string(&AuditEntry {
                timestamp: 1,
                tool: "get_drives".into(),
                summary: "C:".into(),
                outcome: AuditOutcome::Allowed,
                detail: None,
            })
            .unwrap(),
        );
        raw.push_str("\n{ this is not json\n");
        raw.push_str(
            &serde_json::to_string(&AuditEntry {
                timestamp: 2,
                tool: "get_drives".into(),
                summary: "D:".into(),
                outcome: AuditOutcome::Allowed,
                detail: None,
            })
            .unwrap(),
        );
        raw.push('\n');
        fs::write(audit_path_in(dir.path()), raw).unwrap();

        let entries = read_entries_in(dir.path(), 10).unwrap();

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].summary, "D:");
    }

    #[test]
    fn oversized_log_is_rotated_instead_of_growing_forever() {
        let dir = tempfile::tempdir().unwrap();
        let filler = "x".repeat(64);
        let mut raw = String::new();
        while raw.len() as u64 <= MCP_AUDIT_MAX_BYTES {
            raw.push_str(&filler);
        }
        fs::write(audit_path_in(dir.path()), &raw).unwrap();

        append_entry_in(
            dir.path(),
            &AuditEntry {
                timestamp: 3,
                tool: "get_drives".into(),
                summary: "E:".into(),
                outcome: AuditOutcome::Allowed,
                detail: None,
            },
        )
        .unwrap();

        assert!(dir.path().join("mcp-audit.jsonl.1").exists());
        let entries = read_entries_in(dir.path(), 10).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].summary, "E:");
    }
}
