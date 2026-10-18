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
//! 而 OpenSSH 用户实际核对的也正是 `ssh-keygen -lf` 给出的那串。
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

/// 这条记录钉住的是**哪种**身份。
///
/// # 为什么键里必须有它
///
/// 记录的唯一键是 `(host, port, kind)` 而不是 `(host, port)`。
/// 一台主机可以同时跑 SSH（22）与 FTPS（990），两者的「信任」是两件事：
/// 信任了 SSH 公钥**不构成**对 X.509 证书的任何信任，反过来也一样。
/// 键里少一位，中间人只要在另一条记录上拿到凭据就能一路畅通 ——
/// 而这恰恰是 SSH known_hosts 与 X.509 pinning 各自的立身之本。
///
/// # 为什么序列化是小写单词
///
/// 前端设置页要显示「SSH 公钥」/「X.509 证书」，需要能直接 switch；
/// 而 `host_key_unknown` 那条错误里的 `keyType` 仍然是算法名
/// （`Ed25519` / `RSA-SHA256`），两者不要混。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrustKind {
    Ssh,
    X509,
}

impl TrustKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ssh => "ssh",
            Self::X509 => "x509",
        }
    }
}

/// 一条已信任的主机记录。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnownHostEntry {
    /// 主机名或 IP，**原样**存用户填的那一份（不做大小写归一）。
    pub host: String,
    pub port: u16,
    /// `SHA256:...`。SSH 是 OpenSSH 的标准形式（可直接粘进 `ssh-keygen -lf` 对照）；
    /// X.509 是证书 DER 的 SHA-256，同样是 OpenSSL 与浏览器显示的那一串。
    pub fingerprint: String,
    /// 仅供显示：SSH 是公钥算法名，X.509 固定是 `X509`。
    pub key_type: String,
    /// 首次信任的 Unix 秒。
    pub added_at: u64,
    /// 缺这个键的老文件**一律视为 SSH** —— 阶段 2 写出的每条记录都只可能是
    /// SSH 公钥，语义上这个默认值是**正确**的，不是猜测。
    ///
    /// 刻意**不**给 `known_hosts.json` 升版本号：升版本会让所有老用户的信任记录
    /// 直接变成「版本不认识」而必须重新信任，那是一次纯粹由加字段造成的返工。
    /// `#[serde(default)]` 就是为这种「加一个可选字段」准备的迁移手段。
    #[serde(default)]
    pub kind: TrustKind,
}

impl Default for TrustKind {
    fn default() -> Self {
        Self::Ssh
    }
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
///
/// `kind` 是**键的一部分**，不是附加条件：SSH 公钥与 X.509 证书不能互相放行。
pub fn decide(
    entries: &[KnownHostEntry],
    host: &str,
    port: u16,
    kind: TrustKind,
    fingerprint: &str,
) -> HostKeyDecision {
    match entries
        .iter()
        .find(|entry| entry.host == host && entry.port == port && entry.kind == kind)
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

    entries.retain(|existing| {
        !(existing.host == entry.host
            && existing.port == entry.port
            && existing.kind == entry.kind)
    });

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

/// 忘记一台主机的**某一种**信任。返回是否真的删掉了一条 —— 设置页要用它区分
/// 「已删除」与「本来就没有」，否则用户点了没反应却看不出原因。
///
/// 带 `kind` 是必须的：设置页上同一台主机的 SSH 与 X.509 是**两行**，
/// 点掉 SSH 那行不该顺手把证书那行也删了 —— 那等于用户想收紧一条信任，
/// 结果两条都松了。
pub fn forget(
    app_data_dir: &Path,
    host: &str,
    port: u16,
    kind: TrustKind,
) -> Result<bool, RemoteError> {
    let mut entries = load(app_data_dir)?;
    let before = entries.len();

    entries.retain(|entry| {
        !(entry.host == host && entry.port == port && entry.kind == kind)
    });

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

/// 证书 DER 的 SHA-256 指纹，**OpenSSL 形式**：`SHA256:AB:CD:EF:…`。
///
/// # 为什么不用 SSH 那套 Base64
///
/// 用户核对的是**服务器管理员给的那串**。X.509 生态里所有人拿到的都是
/// `openssl x509 -fingerprint -sha256` 那一串冒号十六进制
/// （浏览器、curl -v、Java 的 keytool 都是这个形状）。
/// 这里若输出 OpenSSH 的 Base64，用户会拿着管理员给的串比对失败 ——
/// 而一个**永远对不上**的指纹比不给指纹更糟，它会让用户养成
/// 「看到指纹就点信任」的习惯，这正是我们想消灭的行为。
///
/// ⚠️ 算的是**叶证书的 DER** 本身，不是 SPKI。SPFI 指纹更稳定
/// （续签时不变），但它需要重新编码 DER 才能算，且各工具的默认输出不一致；
/// 叶证书 DER 是与 OpenSSL/浏览器**逐字节一致**的那一份，核对成本最低。
pub fn describe_certificate(der: &[u8]) -> Result<(String, String), RemoteError> {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(der);
    let digest = hasher.finalize();

    Ok((format_openssl_fingerprint(&digest), "X509".to_string()))
}

/// 二进制摘要 → `SHA256:AB:CD:…`。
///
/// 单独抽成纯函数是为了能逐字对照 OpenSSL 的输出：
/// 冒号、大写、两位一组 —— 任何一处不同，用户就永远核对不上。
pub fn format_openssl_fingerprint(digest: &[u8]) -> String {
    let mut out = String::from("SHA256:");

    for (index, byte) in digest.iter().enumerate() {
        if index > 0 {
            out.push(':');
        }

        out.push_str(&format!("{byte:02X}"));
    }

    out
}

/// 指纹的形状对不对。
///
/// **必须按 `kind` 分开校验。** 两者的「用户能拿去核对什么」根本不同：
/// SSH 是 OpenSSH 的 `SHA256:` + Base64（`ssh-keygen -lf` 的输出）；
/// X.509 是 OpenSSL 的 `SHA256:` + 冒号分隔十六进制（`openssl x509 -fingerprint -sha256`
/// 的输出）。用同一条规则去卡其中一种，等于让用户面对一个**永远对不上**的串 ——
/// 而一个对不上的确认框比不给确认更糟：它会让用户养成「看到指纹就点信任」的习惯。
pub fn fingerprint_matches_kind(fingerprint: &str, kind: TrustKind) -> bool {
    let Some(rest) = fingerprint.strip_prefix("SHA256:") else {
        return false;
    };

    match kind {
        TrustKind::Ssh => {
            // OpenSSH 的 Base64：只允许字母数字与 `+/=`，且不为空。
            !rest.is_empty()
                && rest
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
        }
        TrustKind::X509 => {
            // OpenSSL 的十六进制冒号串：成对的十六进制数字，用 `:` 分隔。
            let bytes: Vec<&str> = rest.split(':').collect();

            !bytes.is_empty()
                && bytes
                    .iter()
                    .all(|byte| byte.len() == 2 && byte.chars().all(|c| c.is_ascii_hexdigit()))
        }
    }
}

/// 形状不对时给用户的一句说明。**按 kind 给**，否则同一条消息对两种协议都是错的。
pub fn fingerprint_shape_hint(kind: TrustKind) -> &'static str {
    match kind {
        TrustKind::Ssh => "主机公钥指纹格式不对，应当形如 SHA256:…（可由 ssh-keygen -lf 得到）",
        TrustKind::X509 =>
            "证书指纹格式不对，应当形如 SHA256:AB:CD:…（可由 openssl x509 -fingerprint -sha256 得到）",
    }
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
            kind: TrustKind::Ssh,
        }
    }

    #[test]
    fn decide_covers_the_three_outcomes() {
        let entries = vec![entry("nas", 22, "SHA256:known")];

        assert_eq!(
            decide(&entries, "nas", 22, TrustKind::Ssh, "SHA256:known"),
            HostKeyDecision::Trusted
        );
        assert_eq!(
            decide(&entries, "other-host", 22, TrustKind::Ssh, "SHA256:known"),
            HostKeyDecision::Unknown
        );
        // 同一个主机但端口不同 = 另一台服务，不能拿 22 的记录放行 2222。
        assert_eq!(
            decide(&entries, "nas", 2222, TrustKind::Ssh, "SHA256:known"),
            HostKeyDecision::Unknown
        );
        assert_eq!(
            decide(&entries, "nas", 22, TrustKind::Ssh, "SHA256:other"),
            HostKeyDecision::Changed {
                expected: "SHA256:known".to_string(),
            }
        );
    }

    #[test]
    fn an_ssh_key_never_authorises_an_x509_certificate_on_the_same_endpoint() {
        // **这一条是加 `kind` 的全部理由。**
        //
        // 一台主机可以同时跑 SSH（22）与 FTPS（990），但更现实的是同一端口上
        // 两种服务并存（反向代理、容器端口映射）。键里少一位，中间人只要
        // 拿到另一种信任就能一路畅通 —— 而 SSH known_hosts 与 X.509 pinning
        // 各自的立身之本就是「我认的那一种，别的都不认」。
        let entries = vec![entry("nas", 22, "SHA256:ssh-fingerprint")];

        assert_eq!(
            decide(&entries, "nas", 22, TrustKind::X509, "SHA256:ssh-fingerprint"),
            HostKeyDecision::Unknown,
            "一份 SSH 信任绝不能放行 X.509"
        );

        // 加上 X.509 记录之后，两条各自独立生效。
        let mut both = entries.clone();
        both.push(KnownHostEntry {
            host: "nas".to_string(),
            port: 22,
            fingerprint: "SHA256:cert-fingerprint".to_string(),
            key_type: "X509".to_string(),
            added_at: 0,
            kind: TrustKind::X509,
        });

        assert_eq!(
            decide(&both, "nas", 22, TrustKind::Ssh, "SHA256:ssh-fingerprint"),
            HostKeyDecision::Trusted
        );
        assert_eq!(
            decide(&both, "nas", 22, TrustKind::X509, "SHA256:cert-fingerprint"),
            HostKeyDecision::Trusted
        );
        // 证书换了 —— 只有证书那条报 Changed，SSH 那条仍然可用。
        assert_eq!(
            decide(&both, "nas", 22, TrustKind::X509, "SHA256:other-cert"),
            HostKeyDecision::Changed {
                expected: "SHA256:cert-fingerprint".to_string(),
            }
        );
        assert_eq!(
            decide(&both, "nas", 22, TrustKind::Ssh, "SHA256:ssh-fingerprint"),
            HostKeyDecision::Trusted
        );
    }

    #[test]
    fn a_record_without_a_kind_field_is_read_as_ssh() {
        // 迁移断言：阶段 2 写出的每一条都只可能是 SSH 公钥，
        // 所以「缺 kind = ssh」是**正确**的默认值，不是猜测。
        // 这一条同时保证加字段不需要给 known_hosts.json 升版本号 ——
        // 升了的话所有老用户都得重新信任主机，那是一次纯由加字段造成的返工。
        let legacy = r#"{
          "version": 1,
          "entries": [
            { "host": "nas", "port": 22, "fingerprint": "SHA256:old", "keyType": "Ed25519", "addedAt": 1700000000 }
          ]
        }"#;

        let file: KnownHostsFile = serde_json::from_str(legacy).expect("legacy file must parse");

        assert_eq!(file.entries.len(), 1);
        assert_eq!(file.entries[0].kind, TrustKind::Ssh);
        assert_eq!(
            decide(&file.entries, "nas", 22, TrustKind::Ssh, "SHA256:old"),
            HostKeyDecision::Trusted,
            "老记录必须继续生效"
        );
    }

    #[test]
    fn forgetting_one_kind_leaves_the_other_intact() {
        // 设置页上同一台主机的两条记录是两行；点掉一行不该动另一行。
        let dir = TempDir::new().expect("temp dir");
        trust(dir.path(), entry("nas", 22, "SHA256:ssh")).expect("trust ssh");
        trust(
            dir.path(),
            KnownHostEntry {
                host: "nas".to_string(),
                port: 22,
                fingerprint: "SHA256:cert".to_string(),
                key_type: "X509".to_string(),
                added_at: 0,
                kind: TrustKind::X509,
            },
        )
        .expect("trust cert");

        assert!(forget(dir.path(), "nas", 22, TrustKind::Ssh).expect("forget ssh"));

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].kind, TrustKind::X509);
        assert_eq!(
            decide(&loaded, "nas", 22, TrustKind::X509, "SHA256:cert"),
            HostKeyDecision::Trusted
        );
    }

    #[test]
    fn a_missing_file_means_nothing_is_trusted_yet() {
        let dir = TempDir::new().expect("temp dir");

        assert!(load(dir.path()).expect("must not fail").is_empty());
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
            decide(&loaded, "nas", 22, TrustKind::Ssh, "SHA256:new"),
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
            decide(&loaded, "nas", 22, TrustKind::Ssh, "SHA256:sftp"),
            HostKeyDecision::Trusted
        );
        assert_eq!(
            decide(&loaded, "nas", 2222, TrustKind::Ssh, "SHA256:ssh2"),
            HostKeyDecision::Trusted
        );
    }

    #[test]
    fn forget_removes_only_the_named_host() {
        let dir = TempDir::new().expect("temp dir");
        trust(dir.path(), entry("nas", 22, "SHA256:a")).expect("trust");
        trust(dir.path(), entry("backup", 22, "SHA256:b")).expect("trust");

        assert!(forget(dir.path(), "nas", 22, TrustKind::Ssh).expect("forget"));

        let loaded = load(dir.path()).expect("load");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].host, "backup");
    }

    #[test]
    fn forgetting_an_unknown_host_reports_false_rather_than_pretending_to_work() {
        let dir = TempDir::new().expect("temp dir");

        assert!(!forget(dir.path(), "never-trusted", 22, TrustKind::Ssh).expect("forget"));
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
        // kind 必须**写出去**：设置页要靠它区分同一台主机的两行，
        // 缺了键的话前端只能猜，猜错就是「删掉了证书信任却以为删的是 SSH」。
        assert_eq!(json["kind"], "ssh");
        assert!(json.get("addedAt").is_some());
    }

    #[test]
    fn an_x509_record_round_trips_too() {
        let json = serde_json::to_value(KnownHostEntry {
            host: "nas".to_string(),
            port: 990,
            fingerprint: "AA:BB:CC".to_string(),
            key_type: "X509".to_string(),
            added_at: 1,
            kind: TrustKind::X509,
        })
        .expect("serialize");

        assert_eq!(json["kind"], "x509");
        assert_eq!(json["keyType"], "X509");
        assert_eq!(TrustKind::X509.as_str(), "x509");
        assert_eq!(TrustKind::Ssh.as_str(), "ssh");
    }

    #[test]
    fn openssl_fingerprint_format_matches_what_openssl_prints() {
        // 这是**逐字对照** OpenSSL 的 `x509 -fingerprint -sha256`：
        // 大写、冒号、两位一组。任何一处不同，用户就永远核对不上，
        // 而一个永远核对不上的指纹比不给指纹更糟。
        assert_eq!(
            format_openssl_fingerprint(&[0x00, 0x0f, 0xff, 0xa5]),
            "SHA256:00:0F:FF:A5"
        );
        assert_eq!(
            format_openssl_fingerprint(&[0xab]),
            "SHA256:AB"
        );
        // 空摘要是「算不出来」而不是「一个空串」—— 空串会让
        // `remote_trust_host` 的形状校验失败，用户看到一句莫名其妙的格式错误。
        assert_eq!(format_openssl_fingerprint(&[]), "SHA256:");
    }

    #[test]
    fn certificate_fingerprints_are_stable_and_kind_aware() {
        // 同一份 DER 必须永远给出同一个串 —— 这是用户唯一能拿去核对的东西。
        let der = b"\x30\x82fake-der-bytes";

        let first = describe_certificate(der).expect("fingerprint");
        let second = describe_certificate(der).expect("fingerprint");

        assert_eq!(first, second);
        assert_eq!(first.1, "X509");
        assert!(first.0.starts_with("SHA256:"));

        // 不同的证书必须给出不同的指纹，否则「换了证书但指纹不变」
        // 会被当成「没变」，而那正是中间人最想要的效果。
        let other = describe_certificate(b"\x30\x83different").expect("fingerprint");
        assert_ne!(first.0, other.0);
    }

    #[test]
    fn an_openssl_style_fingerprint_is_not_accepted_as_an_ssh_key() {
        // 反过来的方向同样要挡住：SSH 的 Base64 串不能被当成证书指纹存进去。
        // 挡住之后设置页会显示一条永远对不上的记录，而用户没法自己看出原因。
        let openssl = "SHA256:AB:CD:EF:01";
        let openssh = "SHA256:abcdefghijklmnop";

        assert!(fingerprint_matches_kind(openssl, TrustKind::X509));
        assert!(!fingerprint_matches_kind(openssl, TrustKind::Ssh));
        assert!(fingerprint_matches_kind(openssh, TrustKind::Ssh));
        assert!(!fingerprint_matches_kind(openssh, TrustKind::X509));

        // 空与畸形一律拒绝 —— 空串会让设置页显示一行什么都没有的记录。
        assert!(!fingerprint_matches_kind("", TrustKind::X509));
        assert!(!fingerprint_matches_kind("SHA256:", TrustKind::X509));
        assert!(!fingerprint_matches_kind("SHA256:A", TrustKind::X509));
        assert!(!fingerprint_matches_kind("MD5:ABCD", TrustKind::X509));
    }
}
