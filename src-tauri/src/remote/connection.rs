// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程连接的模型与校验。
//!
//! **密码不在这个结构里。** 这里只有 `credential_key`（指向 DPAPI 密文的键），
//! 密文本身由 `credentials.rs` 存在独立文件里。两条链混用会绕过前端 schema 迁移
//! 与读白名单 —— 本项目已经因为「读写两侧不同步导致重启丢数据」吃过一次亏。

use crate::remote::error::{RemoteError, RemoteErrorKind};
use crate::remote::path::normalize_remote_path;
use crate::remote::transport::ProxyConfig;
use serde::{Deserialize, Serialize};

/// 支持的远程协议。序列化名同时用作设置页下拉框的值。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteProtocol {
    /// 明文 FTP。
    Ftp,
    /// 显式 FTPS：先 `AUTH TLS` 再登录，默认端口 21。
    FtpsExplicit,
    /// 隐式 FTPS：直接连 TLS，默认端口 990。
    FtpsImplicit,
    Sftp,
}

impl RemoteProtocol {
    /// IANA 登记的默认端口。
    pub fn default_port(self) -> u16 {
        match self {
            Self::Ftp | Self::FtpsExplicit => 21,
            Self::FtpsImplicit => 990,
            Self::Sftp => 22,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ftp => "ftp",
            Self::FtpsExplicit => "ftps_explicit",
            Self::FtpsImplicit => "ftps_implicit",
            Self::Sftp => "sftp",
        }
    }
}

/// 一条已保存的远程连接。**不含密码**。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteConnection {
    /// uuid v4 simple。**不得**含 `/` 或 `\` —— 它要嵌进 `sfm://remote/<id>/...` 路径。
    pub id: String,
    /// 用户自己起的名字，显示用。
    pub name: String,
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    /// 可以为空（匿名 FTP / 某些 SFTP）。
    pub username: String,
    /// 打开这个连接时进的目录。恒以 `/` 开头。
    pub initial_path: String,
    /// 可选的本地目录。保存了它之后，打开该连接会自动摆成左右双屏：
    /// 左格是这个本地目录，右格是远端目录。
    ///
    /// **可选** —— 绝大多数用户只想在远端浏览，不想每次都看见本地目录。
    /// 前后端都用「缺失或空串 = 不摆双屏」判定，不要给这个字段编默认值。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_path: Option<String>,
    pub proxy: ProxyConfig,
    /// DPAPI 密文的键。没有密码的连接是 `None`。
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credential_key: Option<String>,
}

impl RemoteConnection {
    /// 逐条校验。返回 `None` 表示合法，否则给出**已经分类**的错误 ——
    /// 配置写错是用户的问题，不该报成 `Protocol` 或 `Unknown`。
    pub fn validate(&self) -> Result<(), RemoteError> {
        if self.id.is_empty() || self.id.contains('/') || self.id.contains('\\') {
            return Err(RemoteError::protocol(
                "连接 id 不能为空，且不能包含斜杠或反斜杠",
            ));
        }

        if self.name.trim().is_empty() {
            return Err(RemoteError::protocol("连接名称不能为空"));
        }

        if self.host.trim().is_empty() {
            return Err(RemoteError::protocol("服务器地址不能为空"));
        }

        if self.host.chars().any(char::is_whitespace) {
            return Err(RemoteError::protocol(
                "服务器地址不能包含空格（IPv6 请用方括号括起来）",
            ));
        }

        if self.port == 0 {
            return Err(RemoteError::protocol("端口不能为 0"));
        }

        if normalize_remote_path(&self.initial_path).is_none() {
            return Err(RemoteError::protocol(
                "初始目录含有不合法的段（不能是 . 或 ..）",
            ));
        }

        // 本地目录**只查「像不像路径」**，不查存在性 ——
        // 校验发生在写盘之前，去 stat 一个还没建好的目录只会误报。
        if let Some(local_path) = self.local_path.as_deref() {
            if !local_path.trim().is_empty() && local_path.chars().any(char::is_whitespace) {
                return Err(RemoteError::protocol("本地目录不能包含空格"));
            }
        }

        Ok(())
    }

    /// 规范化后的初始目录。
    pub fn normalized_initial_path(&self) -> String {
        normalize_remote_path(&self.initial_path).unwrap_or_else(|| "/".to_string())
    }
}

/// 建一条新连接时用的表单。`password` 只在**写凭据**时用到，不进 `RemoteConnection`。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewRemoteConnection {
    pub name: String,
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub initial_path: String,
    /// 空串与 `None` 等价 —— 「不摆双屏」。
    pub local_path: Option<String>,
    pub proxy: ProxyConfig,
    /// 空串表示「这个连接没有密码」，落盘时 `credential_key` 记 `None`。
    pub password: String,
}

impl NewRemoteConnection {
    /// 校验表单。协议非法这类问题归到 `Protocol`，但**不把它当成远端服务器的错误** ——
    /// 阶段 1 还没有任何真实连接发生。
    pub fn validate(&self) -> Result<(), RemoteError> {
        let draft = RemoteConnection {
            id: "placeholder".to_string(),
            name: self.name.clone(),
            protocol: self.protocol,
            host: self.host.clone(),
            port: self.port,
            username: self.username.clone(),
            initial_path: self.initial_path.clone(),
            local_path: self.local_path.clone(),
            proxy: self.proxy.clone(),
            credential_key: None,
        };

        draft.validate()
    }

    pub fn default_port(&self) -> u16 {
        self.protocol.default_port()
    }
}

/// 校验代理地址。主机名与端口的规则和连接本身一致。
pub fn validate_proxy(proxy: &ProxyConfig) -> Result<(), RemoteError> {
    let (host, port) = match proxy {
        ProxyConfig::Direct => return Ok(()),
        ProxyConfig::Socks5 { host, port, .. } | ProxyConfig::HttpConnect { host, port, .. } => {
            (host, *port)
        }
    };

    if host.trim().is_empty() {
        return Err(RemoteError::protocol("代理地址不能为空"));
    }

    if host.chars().any(char::is_whitespace) {
        return Err(RemoteError::protocol("代理地址不能包含空格"));
    }

    if port == 0 {
        return Err(RemoteError::protocol("代理端口不能为 0"));
    }

    Ok(())
}

/// 连接配置出错时给前端的提示类别。前端据此决定文案，而不是解析 `message`。
pub fn connection_error_hint(error: &RemoteError) -> &'static str {
    match error.kind {
        RemoteErrorKind::Auth => "auth",
        RemoteErrorKind::Unreachable => "unreachable",
        RemoteErrorKind::Permission => "permission",
        RemoteErrorKind::NotFound => "not_found",
        RemoteErrorKind::Protocol => "config",
        RemoteErrorKind::Encoding => "encoding",
        RemoteErrorKind::Disconnected => "disconnected",
        RemoteErrorKind::Unsupported => "unsupported",
        RemoteErrorKind::Unknown => "unknown",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid() -> RemoteConnection {
        RemoteConnection {
            id: "conn-1".to_string(),
            name: "备份服务器".to_string(),
            protocol: RemoteProtocol::Ftp,
            host: "ftp.example.com".to_string(),
            port: 21,
            username: "anonymous".to_string(),
            initial_path: "/pub".to_string(),
            local_path: None,
            proxy: ProxyConfig::Direct,
            credential_key: Some("cred-1".to_string()),
        }
    }

    #[test]
    fn protocols_carry_their_registered_default_ports() {
        assert_eq!(RemoteProtocol::Ftp.default_port(), 21);
        assert_eq!(RemoteProtocol::FtpsExplicit.default_port(), 21);
        assert_eq!(RemoteProtocol::FtpsImplicit.default_port(), 990);
        assert_eq!(RemoteProtocol::Sftp.default_port(), 22);
    }

    #[test]
    fn a_well_formed_connection_validates() {
        assert_eq!(valid().validate(), Ok(()));
    }

    #[test]
    fn connection_id_must_not_break_the_remote_path_family() {
        for bad in ["", "a/b", "a\\b"] {
            let mut connection = valid();
            connection.id = bad.to_string();
            assert!(connection.validate().is_err(), "id {bad:?} 必须被拒");
        }
    }

    #[test]
    fn blank_name_and_host_are_rejected() {
        let mut connection = valid();
        connection.name = "   ".to_string();
        assert!(connection.validate().is_err());

        let mut connection = valid();
        connection.host = "".to_string();
        assert!(connection.validate().is_err());
    }

    #[test]
    fn host_with_whitespace_is_rejected() {
        let mut connection = valid();
        connection.host = "ftp example com".to_string();
        assert!(connection.validate().is_err());
    }

    #[test]
    fn zero_port_is_rejected() {
        let mut connection = valid();
        connection.port = 0;
        assert!(connection.validate().is_err());
    }

    #[test]
    fn initial_path_with_dot_segments_is_rejected() {
        for bad in ["/pub/../etc", "/./x"] {
            let mut connection = valid();
            connection.initial_path = bad.to_string();
            assert!(connection.validate().is_err(), "初始目录 {bad:?} 必须被拒");
        }
    }

    #[test]
    fn initial_path_is_normalized_on_read() {
        let mut connection = valid();
        connection.initial_path = "pub//docs/".to_string();

        assert!(connection.validate().is_ok());
        assert_eq!(connection.normalized_initial_path(), "/pub/docs");
    }

    #[test]
    fn connections_round_trip_through_json_without_any_password_field() {
        let json = serde_json::to_string(&valid()).expect("serialize");

        assert!(!json.contains("password"), "序列化结果绝不能带密码字段：{json}");
        assert!(json.contains("\"credentialKey\":\"cred-1\""));

        let parsed: RemoteConnection = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed, valid());
    }

    #[test]
    fn credential_key_is_optional_for_passwordless_connections() {
        let mut connection = valid();
        connection.credential_key = None;
        connection.username = String::new();

        let json = serde_json::to_string(&connection).expect("serialize");
        assert!(!json.contains("credentialKey"));

        let parsed: RemoteConnection = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed, connection);
        assert_eq!(parsed.validate(), Ok(()));
    }

    #[test]
    fn proxy_configuration_is_validated_separately() {
        assert_eq!(validate_proxy(&ProxyConfig::Direct), Ok(()));

        assert!(validate_proxy(&ProxyConfig::Socks5 {
            host: "  ".to_string(),
            port: 1080,
            username: None,
            password: None,
        })
        .is_err());

        assert!(validate_proxy(&ProxyConfig::HttpConnect {
            host: "proxy.example.com".to_string(),
            port: 0,
            username: None,
            password: None,
        })
        .is_err());

        assert_eq!(
            validate_proxy(&ProxyConfig::Socks5 {
                host: "127.0.0.1".to_string(),
                port: 1080,
                username: None,
                password: None,
            }),
            Ok(())
        );
    }

    #[test]
    fn new_connection_form_reports_the_protocol_default_port() {
        let form = NewRemoteConnection {
            name: "sftp".to_string(),
            protocol: RemoteProtocol::Sftp,
            host: "h".to_string(),
            port: 0,
            username: String::new(),
            initial_path: "/".to_string(),
            local_path: None,
            proxy: ProxyConfig::Direct,
            password: String::new(),
        };

        assert_eq!(form.default_port(), 22);
        assert!(form.validate().is_err(), "端口 0 必须被拒");
    }

    // ---- 本地目录（可选） ---------------------------------------------------

    #[test]
    fn local_path_round_trips_through_json_when_present() {
        let mut connection = valid();
        connection.local_path = Some("C:/Users/test/Downloads".to_string());

        let json = serde_json::to_string(&connection).expect("serialize");
        assert!(json.contains("\"localPath\":\"C:/Users/test/Downloads\""));

        let parsed: RemoteConnection = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed.local_path.as_deref(), Some("C:/Users/test/Downloads"));
        assert_eq!(parsed.validate(), Ok(()));
    }

    /// 老记录里没有这个键 —— 必须读得回来，不能因为新增字段把既有连接全判成损坏。
    #[test]
    fn connections_saved_before_local_path_existed_still_load() {
        let json = r#"{
            "id":"conn-1",
            "name":"old",
            "protocol":"ftp",
            "host":"ftp.example.com",
            "port":21,
            "username":"anonymous",
            "initialPath":"/pub",
            "proxy":{"kind":"direct"},
            "credentialKey":"cred-1"
        }"#;

        let parsed: RemoteConnection = serde_json::from_str(json).expect("deserialize");

        assert_eq!(parsed.local_path, None);
        assert_eq!(parsed.validate(), Ok(()));
        assert!(!serde_json::to_string(&parsed)
            .expect("serialize")
            .contains("localPath"));
    }

    #[test]
    fn local_path_with_whitespace_is_rejected() {
        let mut connection = valid();
        connection.local_path = Some("C:/My Documents/Downloads".to_string());

        assert!(connection.validate().is_err(), "含空格的本地目录必须被拒");
    }

    #[test]
    fn local_path_is_optional_and_empty_means_no_split_view() {
        for local_path in [None, Some(String::new()), Some("   ".to_string())] {
            let mut connection = valid();
            connection.local_path = local_path.clone();

            assert_eq!(
                connection.validate(),
                Ok(()),
                "{local_path:?} 应当被当作「不摆双屏」放行"
            );
        }
    }

    #[test]
    fn config_errors_map_to_a_hint_the_frontend_can_use() {
        assert_eq!(
            connection_error_hint(&RemoteError::protocol("x")),
            "config"
        );
        assert_eq!(
            connection_error_hint(&RemoteError::auth("x")),
            "auth"
        );
        assert_eq!(
            connection_error_hint(&RemoteError::unsupported("x")),
            "unsupported",
            "平台不支持要单独成类，不能混进 unknown"
        );
    }

    /// 穷尽性：新增一个 `RemoteErrorKind` 时忘了给前端映射，
    /// 编译器会在这里报错，而不是让前端在运行时显示成「未知错误」。
    #[test]
    fn every_error_kind_has_a_hint() {
        let kinds = [
            RemoteErrorKind::Auth,
            RemoteErrorKind::Unreachable,
            RemoteErrorKind::Permission,
            RemoteErrorKind::NotFound,
            RemoteErrorKind::Protocol,
            RemoteErrorKind::Encoding,
            RemoteErrorKind::Disconnected,
            RemoteErrorKind::Unsupported,
            RemoteErrorKind::Unknown,
        ];

        for kind in kinds {
            let hint = connection_error_hint(&RemoteError::new(kind, "x"));
            assert!(!hint.is_empty(), "{kind:?} 必须有前端文案类别");
        }
    }
}
