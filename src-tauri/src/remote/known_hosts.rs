// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! SSH 主机公钥的记录与校验（known_hosts）。
//!
//! # 这一模块存在的理由：`connection_test.rs` 不校验服务器身份
//!
//! 「测试连接」无条件 `Ok(true)` 是**刻意的**：用户在测的是刚填进去的地址，
//! 此时还没有可对照的指纹，强校验只会一律失败。但真正读取远端目录时，
//! 那就是一次静默的中间人窗口。本模块是那条窗口的关闭者。
//!
//! # 2026-10-18 用户拍板：自建文件 + **首见弹窗确认指纹**
//!
//! 存储位置刻意**不**按规格 §3.5 写在 `user-data/` 下，而是与
//! `remote-credentials.json` 并列放在 app-data 目录根：
//! `user-data/` 是 `tauri-plugin-store` 的地盘，把一个 Rust 独占写、
//! 需要原子替换的文件塞进去，等于让两个所有者共用一个目录 —— 而 AGENTS
//! 已经记过「读写两侧不同步导致重启丢数据」。文件名与规格一致，
//! 只是换了目录。
//!
//! # 为什么只存指纹，不存完整公钥
//!
//! 比对的就是指纹。存完整公钥要多解析、多一个可能与 `ssh-key` 版本绑定的字段，
//! 却不会带来任何额外的验证能力 —— SHA-256 碰撞在这个场景不是现实风险，
//! 而 OpenSSH 用户实际核对���也正是 `ssh-keygen -lf` 给出的那串。
//! `key_type` 保留下来是为了让设置页能显示「这是一把 ed25519 公钥」，
//! 而不是一串无从判断的字符。

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::error::RemoteError;

pub const REMOTE_KNOWN_HOSTS_FILE: &str = "remote-known-hosts.json";

/// 文件格式版本。改动结构时 +1，并在读的时候明确处理不认识的版本，
/// 而不是默默当成空 —— 后者会把用户的信任记录一次性清空。
pub const KNOWN_HOSTS_VERSION: u32 = 1;

/// 一条已信任的主机记录。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHostEntry {
    /// 主机名或 IP，**原样**存用户填的那一份（不做大小写归一）。
    pub host: String,
    pub port: u16,
    /// `SHA256:...`，OpenSSH 的标准形式，用户可以直接粘进 `ssh-keygen -lf` 对照。
    pub fingerprint: String,
    /// 公钥算法名，仅供显示。
    pub key_type: String,
    /// 首次信任的 Unix 秒。
    pub added_at: u64,
}

#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct KnownHostsFile {
    #[serde(default)]
    version: u32,
    #[serde(default)]
    entries: Vec<KnownHostEntry>,
}

pub fn known_hosts_path_in(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(REMOTE_KNOWN_HOSTS_FILE)
}

/// 一次连接里，这台主机的公钥算不算「认识」。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HostKeyDecision {
    /// 有记录且指纹一致 —— 放行。
    Trusted,
    /// 从没见过这台主机。**必须让用户确认指纹，不能自动信任。**
    Unknown,
    /// 有记录，但指纹对不上。
    Changed {
        /// 已记录的那一份，给用户做对照。
        expected: String,
    },
}

/// 读全部记录。文件不存在 = 一台都没信任过，不是错误。
pub fn load(app_data_dir: &Path) -> Result<Vec<KnownHostEntry>, RemoteError> {
    let path = known_hosts_path_in(app_data_dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| RemoteError::unknown(format!("读取已信任主机列表失败：{error}")))?;

    let file: KnownHostsFile = serde_json::from_str(&text).map_err(|error| {
        RemoteError::protocol(format!("已信任主机列表无法解析：{error}"))
    })?;

    if file.version != KNOWN_HOSTS_VERSION {
        return Err(RemoteError::protocol(format!(
            "已信任主机列表的格式版本是 {}，本版本只认 {KNOWN_HOSTS_VERSION}。\
             请到设置页删除该文件后重新信任主机。",
            file.version
        )));
    }

    Ok(file.entries)
}

/// 落盘。**先写临时文件再改名**，避免中途崩溃留下半截 JSON
/// —— 那会让下一次加载报「解析失败」，把所有已信任记录一次性废掉。
fn save(app_data_dir: &Path, entries: &[KnownHostEntry]) -> Result<(), RemoteError> {
    let path = known_hosts_path_in(app_data_dir);
    let file = KnownHostsFile {
        version: KNOWN_HOSTS_VERSION,
        entries: entries.to_vec(),
    };
    let body = serde_json::to_string_pretty(&file)
        .map_err(|error| RemoteError::unknown(format!("序列化已信任主机列表失败：{error}")))?;

    let temp = path.with_extension("json.tmp");

    std::fs::write(&temp, body.as_bytes())
        .map_err(|error| RemoteError::unknown(format!("写入已信任主机列表失败：{error}")))?;

    std::fs::rename(&temp, &path).map_err(|error| {
        let _ = std::fs::remove_file(&temp);
        RemoteError::unknown(format!("提交已信任主机列表失败：{error}"))
    })
}

/// 一台主机在本次连接里的判定。**纯函数**，可以逐条钉住。
pub fn decide(
    entries: &[KnownHostEntry],
    host: &str,
    port: u16,
    fingerprint: &str,
) -> HostKeyDecision {
    match entries
        .iter()
        .find(|entry| entry.host == host && entry.port == port)
    {
        None => HostKeyDecision::Unknown,
        Some(entry) if entry.fingerprint == fingerprint => HostKeyDecision::Trusted,
        Some(entry) => HostKeyDecision::Changed {
            expected: entry.fingerprint.clone(),
        },
    }
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0)
}

/// 用户点了「我核对过了，信任它」之后调用。
///
/// 同名主机重复信任时**覆盖**旧记录而不是追加 —— 追加会留下一条永远过期的
/// 旧指纹，而 `decide` 只认第一条匹配，之后再改密码之类的操作会被永久判成
/// 「主机密钥变了」，用户删不掉也加不进。
pub fn trust(app_data_dir: &Path, entry: KnownHostEntry) -> Result<(), RemoteError> {
    let mut entries = load(app_data_dir)?;

    entries.retain(|existing| !(existing.host == entry.host && existing.port == entry.port));

    if entry.added_at == 0 {
        entries.push(KnownHostEntry {
            added_at: now_unix_seconds(),
            ..entry
        });
    } else {
        entries.push(entry);
    }

    save(app_data_dir, &entries)
}

/// 忘记一台主机。返回是否真的删掉了一条 —— 设置页要用它区分
/// 「已删除」与「本来就没有」，否则用户点了没反应却看不出原因。
pub fn forget(app_data_dir: &Path, host: &str, port: u16) -> Result<bool, RemoteError> {
    let mut entries = load(app_data_dir)?;
    let before = entries.len();

    entries.retain(|entry| !(entry.host == host && entry.port == port));

    if entries.len() == before {
        return Ok(false);
    }

    save(app_data_dir, &entries)?;

    Ok(true)
}

/// 从 russh 交来的公钥算出指纹与算法名。
///
/// 用 `PublicKeyOrCertificate::public_key()`（russh 自己提供的那个方法）而不是自己 match：
/// 它对证书会取出证书内含的那把公钥 —— 我们关心的是**身份**，不是「这次是用证书登进来的」。
pub fn describe_server_key(
    key: &russh::keys::PublicKeyOrCertificate,
) -> Result<(String, String), RemoteError> {
    use russh::keys::HashAlg;

    let public_key = key.public_key();

    Ok((
        public_key.fingerprint(HashAlg::Sha256).to_string(),
        format!("{:?}", public_key.algorithm()),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn entry(host: &str, port: u16, fingerprint: &str) -> KnownHostEntry {
        KnownHostEntry {
            host: host.to_string(),
            port,
            fingerprint: fingerprint.to_string(),
            key_type: "Ed25519".to_string(),
            added_at: 0,
        }
    }

    #[test]
    fn a_missing_file_means_nothing_is_trusted_yet() {
        let dir = TempDir::new().expect("temp dir");

        assert!(load(dir.path()).expect("must not fail").is_empty());
    }

    #[test]
    fn decide_covers_the_three_outcomes() {
        let entries = vec![entry("nas", 22, "SHA256:known")];

        assert_eq!(
            decide(&entries, "nas", 22, "SHA256:known"),
            HostKeyDecision::Trusted
        );
        assert_eq!(
            decide(&entries, "other-host", 22, "SHA256:known"),
            HostKeyDecision::Unknown
        );
        // 同一个主机但端口不同 = 另一台服务，不能拿 22 的记录放行 2222。
        assert_eq!(
            decide(&entries, "nas", 2222, "SHA256:known"),
            HostKeyDecision::Unknown
        );
        assert_eq!(
            decide(&entries, "nas", 22, "SHA256:other"),
            HostKeyDecision::Changed {
                expected: "SHA256:known".to_string(),
            }
        );
    }

    #[test]
    fn trust_then_load_round_trips_through_disk() {
        let dir = TempDir::new().expect("temp dir");

        trust(dir.path(), entry("nas", 22, "SHA256:known")).expect("trust");

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].fingerprint, "SHA256:known");
        assert_eq!(loaded[0].host, "nas");
        assert_eq!(loaded[0].port, 22);
        // 时间戳必须真的被填上 —— 留 0 会让设置页显示「1970 年信任」。
        assert!(loaded[0].added_at > 0);
    }

    #[test]
    fn trusting_the_same_host_twice_replaces_instead_of_appending() {
        // 追加会留下一条永远过期的旧指纹，而 `decide` 只认第一条匹配 ——
        // 结果是用户再也连不上，也删不干净。
        let dir = TempDir::new().expect("temp dir");

        trust(dir.path(), entry("nas", 22, "SHA256:old")).expect("trust");
        trust(dir.path(), entry("nas", 22, "SHA256:new")).expect("re-trust");

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].fingerprint, "SHA256:new");
        assert_eq!(
            decide(&loaded, "nas", 22, "SHA256:new"),
            HostKeyDecision::Trusted
        );
    }

    #[test]
    fn different_ports_on_the_same_host_coexist() {
        let dir = TempDir::new().expect("temp dir");

        trust(dir.path(), entry("nas", 22, "SHA256:sftp")).expect("trust");
        trust(dir.path(), entry("nas", 2222, "SHA256:ssh2")).expect("trust");

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 2);
        assert_eq!(
            decide(&loaded, "nas", 22, "SHA256:sftp"),
            HostKeyDecision::Trusted
        );
        assert_eq!(
            decide(&loaded, "nas", 2222, "SHA256:ssh2"),
            HostKeyDecision::Trusted
        );
    }

    #[test]
    fn forget_removes_only_the_named_host() {
        let dir = TempDir::new().expect("temp dir");
        trust(dir.path(), entry("nas", 22, "SHA256:a")).expect("trust");
        trust(dir.path(), entry("backup", 22, "SHA256:b")).expect("trust");

        assert!(forget(dir.path(), "nas", 22).expect("forget"));

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].host, "backup");
    }

    #[test]
    fn forgetting_an_unknown_host_reports_false_rather_than_pretending_to_work() {
        let dir = TempDir::new().expect("temp dir");

        assert!(!forget(dir.path(), "never-trusted", 22).expect("forget"));
    }

    #[test]
    fn an_unrecognised_file_version_is_refused_instead_of_wiping_the_records() {
        // 默默当成空 = 用户的信任记录被一次性清空，下次连接又会报「首次见到」。
        let dir = TempDir::new().expect("temp dir");
        trust(dir.path(), entry("nas", 22, "SHA256:a")).expect("trust");

        let path = known_hosts_path_in(dir.path());
        let text = std::fs::read_to_string(&path).expect("read");
        let file: KnownHostsFile = serde_json::from_str(&text).expect("parse");
        let future = KnownHostsFile {
            version: KNOWN_HOSTS_VERSION + 1,
            entries: file.entries,
        };
        std::fs::write(&path, serde_json::to_string(&future).expect("serialize"))
            .expect("write");

        assert!(load(dir.path()).is_err());
    }

    #[test]
    fn a_corrupt_file_is_a_config_error_not_a_silent_reset() {
        let dir = TempDir::new().expect("temp dir");
        std::fs::write(known_hosts_path_in(dir.path()), "{ broken").expect("write");

        assert!(load(dir.path()).is_err());
    }

    #[test]
    fn saving_never_leaves_a_temp_file_behind() {
        let dir = TempDir::new().expect("temp dir");
        trust(dir.path(), entry("nas", 22, "SHA256:a")).expect("trust");

        assert!(!known_hosts_path_in(dir.path()).with_extension("json.tmp").exists());
    }

    #[test]
    fn records_round_trip_through_json_in_camel_case() {
        let json = serde_json::to_value(entry("nas", 22, "SHA256:a")).expect("serialize");

        assert_eq!(json["host"], "nas");
        assert_eq!(json["port"], 22);
        assert_eq!(json["fingerprint"], "SHA256:a");
        assert_eq!(json["keyType"], "Ed25519");
        assert!(json.get("addedAt").is_some());
    }
}
