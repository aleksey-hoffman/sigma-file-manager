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
    /// 兜底。**只在确实归不进上面七类时用**，不是「懒得分类」。
    Unknown,
}

impl RemoteErrorKind {
    /// 稳定的 snake_case 名字。阶段 1 的前端文案映射直接用它，不做反序列化。
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Auth => "auth",
            Self::Unreachable => "unreachable",
            Self::Permission => "permission",
            Self::NotFound => "not_found",
            Self::Protocol => "protocol",
            Self::Encoding => "encoding",
            Self::Disconnected => "disconnected",
            Self::Unknown => "unknown",
        }
    }
}

/// 远程操作的错误载荷。
///
/// 序列化后的形状 `{"kind":"auth","message":"..."}` 就是阶段 1 Tauri command 的
/// `Err` 载荷，前端会直接收到它。**本阶段就要把这个形状测死** ——
/// 否则阶段 1 改字段名要回头改前端。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteError {
    pub kind: RemoteErrorKind,
    pub message: String,
}

impl RemoteError {
    pub fn new(kind: RemoteErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
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

    #[test]
    fn covers_every_documented_kind() {
        let kinds = [
            RemoteErrorKind::Auth,
            RemoteErrorKind::Unreachable,
            RemoteErrorKind::Permission,
            RemoteErrorKind::NotFound,
            RemoteErrorKind::Protocol,
            RemoteErrorKind::Encoding,
            RemoteErrorKind::Disconnected,
            RemoteErrorKind::Unknown,
        ];
        let expected = [
            "auth",
            "unreachable",
            "permission",
            "not_found",
            "protocol",
            "encoding",
            "disconnected",
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
