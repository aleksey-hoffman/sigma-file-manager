// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use serde::{Deserialize, Serialize};
use std::fmt;

/// 远程操作的错误分类。
///
/// 序列化用 snake_case，与 `dir_reader::types::DirEntryLinkType` 保持一致。
/// 七类都**不可再合并** —— 设计规格 §6 要求「不能只报『连接失败』」：
/// 认证失败要让用户去改密码，网络不可达要让他检查代理，两者给的处置完全不同。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteErrorKind {
    /// 凭据错误：认证失败、账号锁定。
    Auth,
    /// 首次见到这台 SSH 主机，指纹未知，**等着用户确认**。
    ///
    /// 刻意与 `Auth` 分开：处置完全不同 —— `Auth` 让用户去改密码，
    /// 而这一类要弹一个「这台主机是 SHA256:xxx，你信任吗」的确认框。
    /// 合成一类的话，前端只能靠解析文案来分流，那正是规格 §6.3 禁止的做法。
    HostKeyUnknown,
    /// 主机公钥与已记录的不一致 —— **可能是中间人，也可能只是服务器重装了密钥**。
    ///
    /// 同样不能并进 `Auth`：这一类必须显式警告并展示双方指纹，
    /// 默认动作是拒绝，绝不能自动接受。
    HostKeyChanged,
    /// 网络不可达：DNS 失败、连接被拒、超时。
    Unreachable,
    /// 已连上但没权限：远端拒绝该操作。
    Permission,
    /// 路径或条目不存在。
    NotFound,
    /// 协议层错误：命令语法不被接受、响应无法解析。
    Protocol,
    /// 文件名编码无法按当前配置解码。
    Encoding,
    /// 连接已建立但中途断开。
    Disconnected,
    /// 本平台不具备该能力。阶段 1 的凭据加密是 Windows DPAPI，
    /// macOS / Linux 上没有等价物 —— 归到 `Unknown` 就退化成规格 §6.3 明令禁止的「笼统错误」，
    /// 用户会以为是服务器的问题。
    Unsupported,
    /// 兜底。**只在确实归不进上面几类时用**，不是「懒得分类」。
    Unknown,
}

impl RemoteErrorKind {
    /// 稳定的 snake_case 名字。阶段 1 的前端文案映射直接用它，不做反序列化。
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth => "auth",
            Self::HostKeyUnknown => "host_key_unknown",
            Self::HostKeyChanged => "host_key_changed",
            Self::Unreachable => "unreachable",
            Self::Permission => "permission",
            Self::NotFound => "not_found",
            Self::Protocol => "protocol",
            Self::Encoding => "encoding",
            Self::Disconnected => "disconnected",
            Self::Unsupported => "unsupported",
            Self::Unknown => "unknown",
        }
    }
}

/// 远程操作的错误载荷。
///
/// 序列化后的形状 `{"kind":"auth","message":"..."}` 就是阶段 1 Tauri command 的
/// `Err` 载荷，前端会直接收到它。**本阶段就要把这个形状测死** ——
/// 否则阶段 1 改字段名要回头改前端。
///
/// # 指纹为什么是结构化字段而不是拼进 `message`
///
/// 前端要弹「这台主机是 `SHA256:...`，你信任吗」的确认框，就得拿到指纹本身。
/// 拼进文案的话前端只能解析字符串，而 AGENTS 与规格 §6.3 都要求前端**按类别分支、
/// 不解析 message**。所以指纹单独成字段，且 `None` 时整个键不写出去 ——
/// 非主机密钥类错误的 JSON 形状因此与阶段 1 逐字节相同。
///
/// `rename_all = "camelCase"` 与前端 `RemoteErrorPayload` 对齐。
/// 单词的字段（`kind` / `message` / `fingerprint`）不受影响，
/// 所以阶段 1 定死的那份 `{"kind":"auth","message":"密码错误"}` 仍然逐字节相同。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteError {
    pub kind: RemoteErrorKind,
    pub message: String,
    /// 本次连接**实际收到**的主机指纹，`SHA256:...`。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fingerprint: Option<String>,
    /// 已记录、但与本次不一致的指纹。只在 `HostKeyChanged` 时有值。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expected_fingerprint: Option<String>,
}

impl RemoteError {
    pub fn new(kind: RemoteErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            fingerprint: None,
            expected_fingerprint: None,
        }
    }

    /// 首次见到这台主机。`fingerprint` 是本次收到的指纹，等用户确认。
    pub fn host_key_unknown(host: &str, fingerprint: String) -> Self {
        Self {
            kind: RemoteErrorKind::HostKeyUnknown,
            message: format!(
                "首次连接到 {host}，它的主机指纹还没有被信任。请核对下面的指纹后再决定是否信任。"
            ),
            fingerprint: Some(fingerprint),
            expected_fingerprint: None,
        }
    }

    /// 主机密钥变了。两个指纹都要给出去，用户才有判断依据。
    pub fn host_key_changed(host: &str, received: String, expected: String) -> Self {
        Self {
            kind: RemoteErrorKind::HostKeyChanged,
            message: format!(
                "{host} 的主机公钥与已信任的记录不一致。可能是服务器重装了密钥，\
                 也可能是有人在中途。要继续请先删除旧记录再重新信任。"
            ),
            fingerprint: Some(received),
            expected_fingerprint: Some(expected),
        }
    }

    pub fn auth(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Auth, message)
    }

    pub fn unreachable(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Unreachable, message)
    }

    pub fn permission(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Permission, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::NotFound, message)
    }

    pub fn protocol(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Protocol, message)
    }

    pub fn encoding(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Encoding, message)
    }

    pub fn disconnected(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Disconnected, message)
    }

    pub fn unsupported(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Unsupported, message)
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(RemoteErrorKind::Unknown, message)
    }
}

impl fmt::Display for RemoteError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{}: {}", self.kind.as_str(), self.message)
    }
}

impl std::error::Error for RemoteError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_kind_as_snake_case() {
        let json = serde_json::to_string(&RemoteError::auth("密码错误")).expect("serialize");

        assert_eq!(json, r#"{"kind":"auth","message":"密码错误"}"#);
    }

    /// 指纹字段**只在有值时出现**。这条锁住的是「阶段 1 的 JSON 形状不许因为
    /// 新加字段而变」—— 改了这里前端与验收脚本的逐字对照会一起炸。
    #[test]
    fn fingerprint_fields_are_absent_unless_they_carry_a_value() {
        let plain = serde_json::to_value(&RemoteError::auth("密码错误")).expect("serialize");
        assert_eq!(plain.get("fingerprint"), None);
        assert_eq!(plain.get("expectedFingerprint"), None);

        let unknown = serde_json::to_value(&RemoteError::host_key_unknown(
            "192.168.1.9",
            "SHA256:abc".to_string(),
        ))
        .expect("serialize");
        assert_eq!(unknown["kind"], "host_key_unknown");
        assert_eq!(unknown["fingerprint"], "SHA256:abc");
        assert_eq!(unknown.get("expectedFingerprint"), None);
    }

    #[test]
    fn a_changed_host_key_carries_both_fingerprints() {
        let error = RemoteError::host_key_changed(
            "192.168.1.9",
            "SHA256:new".to_string(),
            "SHA256:old".to_string(),
        );

        assert_eq!(error.kind, RemoteErrorKind::HostKeyChanged);
        assert_eq!(error.fingerprint.as_deref(), Some("SHA256:new"));
        assert_eq!(error.expected_fingerprint.as_deref(), Some("SHA256:old"));

        let json = serde_json::to_value(&error).expect("serialize");
        assert_eq!(json["fingerprint"], "SHA256:new");
        assert_eq!(json["expectedFingerprint"], "SHA256:old");
    }

    #[test]
    fn an_unknown_host_key_has_no_expected_fingerprint() {
        let error = RemoteError::host_key_unknown("nas", "SHA256:abc".to_string());

        assert_eq!(error.kind, RemoteErrorKind::HostKeyUnknown);
        assert_eq!(error.expected_fingerprint, None);
    }

    /// 逐条钉住：这两类必须**分别**存在。把它们并进 `Auth` 的话，
    /// 「密码错」和「这台主机没被信任过」会拿到同一段处置指引。
    #[test]
    fn host_key_trust_failures_are_not_reported_as_auth_failures() {
        assert_ne!(
            RemoteError::host_key_unknown("h", "SHA256:a".to_string()).kind,
            RemoteError::auth("密码错了").kind
        );
        assert_ne!(
            RemoteError::host_key_changed("h", "SHA256:a".to_string(), "SHA256:b".to_string()).kind,
            RemoteError::auth("密码错了").kind
        );
    }

    #[test]
    fn covers_every_documented_kind() {
        let kinds = [
            RemoteErrorKind::Auth,
            RemoteErrorKind::HostKeyUnknown,
            RemoteErrorKind::HostKeyChanged,
            RemoteErrorKind::Unreachable,
            RemoteErrorKind::Permission,
            RemoteErrorKind::NotFound,
            RemoteErrorKind::Protocol,
            RemoteErrorKind::Encoding,
            RemoteErrorKind::Disconnected,
            RemoteErrorKind::Unsupported,
            RemoteErrorKind::Unknown,
        ];
        let expected = [
            "auth",
            "host_key_unknown",
            "host_key_changed",
            "unreachable",
            "permission",
            "not_found",
            "protocol",
            "encoding",
            "disconnected",
            "unsupported",
            "unknown",
        ];

        for (kind, name) in kinds.iter().zip(expected) {
            assert_eq!(
                serde_json::to_string(kind).expect("serialize"),
                format!("\"{name}\"")
            );
            assert_eq!(kind.as_str(), name);
        }
    }

    #[test]
    fn constructors_set_the_matching_kind() {
        assert_eq!(RemoteError::auth("m").kind, RemoteErrorKind::Auth);
        assert_eq!(
            RemoteError::unreachable("m").kind,
            RemoteErrorKind::Unreachable
        );
        assert_eq!(
            RemoteError::permission("m").kind,
            RemoteErrorKind::Permission
        );
        assert_eq!(RemoteError::not_found("m").kind, RemoteErrorKind::NotFound);
        assert_eq!(RemoteError::protocol("m").kind, RemoteErrorKind::Protocol);
        assert_eq!(RemoteError::encoding("m").kind, RemoteErrorKind::Encoding);
        assert_eq!(
            RemoteError::disconnected("m").kind,
            RemoteErrorKind::Disconnected
        );
        assert_eq!(
            RemoteError::unsupported("m").kind,
            RemoteErrorKind::Unsupported
        );
        assert_eq!(RemoteError::unknown("m").kind, RemoteErrorKind::Unknown);
        assert_eq!(
            RemoteError::new(RemoteErrorKind::Protocol, "m").kind,
            RemoteErrorKind::Protocol
        );
    }

    #[test]
    fn displays_kind_and_message() {
        assert_eq!(
            RemoteError::not_found("没有那个目录").to_string(),
            "not_found: 没有那个目录"
        );
    }

    #[test]
    fn round_trips_through_json() {
        let original = RemoteError::disconnected("连接被远端关闭");
        let text = serde_json::to_string(&original).expect("serialize");
        let parsed: RemoteError = serde_json::from_str(&text).expect("deserialize");

        assert_eq!(parsed, original);
    }

    #[test]
    fn is_usable_as_a_std_error() {
        fn takes_error(_: &dyn std::error::Error) {}

        takes_error(&RemoteError::auth("m"));
    }
}
