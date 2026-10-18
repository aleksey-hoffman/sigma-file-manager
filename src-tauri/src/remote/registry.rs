// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程连接表与凭据的装配。
//!
//! # 2026-10-18 用户拍板：方案 C —— **Rust 自己读连接表与 DPAPI 密码**
//!
//! 连接元数据归前端 store（`user-data/user-remote-connections.json`），
//! 密码归 Rust 的 DPAPI 档案（`remote-credentials.json`，键就是连接 id）。
//! 阶段 2 的 `remote_read_dir` 因此**只收一个 `path`**：
//! 前端不用把连接对象和明文密码在每次翻目录时重新塞进 IPC，
//! 明文密码也**一次都不跨进程**。
//!
//! ## 代价，以及护栏在哪
//!
//! 代价是连接表多了一个读者，schema 与前端 `src/types/remote.ts` 存在漂移风险。
//! 护栏是 `src-shared/remote-connection.sample.json` —— **Rust 与前端各有一份测试读同一个文件**，
//! 任何一侧改了字段名而另一侧没跟上，两边的测试会同时转红。
//! 靠注释提醒「两边要同步」是提醒不住的，AGENTS 已经记过一次「读写两侧不同步导致重启丢数据」。
//!
//! ## 两条链仍然分开
//!
//! 这里读到的 `RemoteConnection` **永远不含明文密码**，密码单独从 DPAPI 档案取。
//! 把密码塞回连接对象再往下传，等于让两条链又混到一起。

use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::connection::RemoteConnection;
use super::credentials;
use super::error::RemoteError;

/// 与 `src-shared/user-storage-files.json` 里的文件名一致。
/// **不要动 `legacy_file_names`** —— 那会触发历史文件 rename。
pub const REMOTE_CONNECTIONS_FILE: &str = "user-remote-connections.json";

/// `tauri-plugin-store` 写出来的连接表文件形状。
///
/// 整份文件里只有 `connections` 一个键。写成结构体而不是 `serde_json::Value`，
/// 是为了让「字段改名」在**编译期**就变成一次显式的适配，而不是运行时读到 `null`。
#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionsFile {
    #[serde(default)]
    pub connections: Vec<RemoteConnection>,
}

/// 一次远程操作需要的全部东西：连接元数据 + 明文密码。
///
/// 密码是 `Option`：`None` 表示**这条连接没有存过密码**（匿名 FTP / 免密 SFTP），
/// 与「存过但读不出来」不同 —— 后者在这里就是一条错误，不会走到协议层。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedConnection {
    pub connection: RemoteConnection,
    pub password: Option<String>,
}

pub fn connections_path_in(user_data_dir: &Path) -> PathBuf {
    user_data_dir.join(REMOTE_CONNECTIONS_FILE)
}

/// 读连接表。
///
/// **文件不存在 = 一条连接都没有，这不是错误。** 第一次用远程功能、
/// 还没在设置页存过任何连接时就是这个样子，把它报成错误会让「空列表」变成故障。
pub fn load_connections(user_data_dir: &Path) -> Result<Vec<RemoteConnection>, RemoteError> {
    let path = connections_path_in(user_data_dir);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|error| RemoteError::unknown(format!("读取远程连接列表失败：{error}")))?;

    let file: ConnectionsFile = serde_json::from_str(&text).map_err(|error| {
        // 这一条是**配置坏了**，不是网络或服务器的问题，归到 `Protocol` 才不会
        // 引导用户去检查密码和网络。
        RemoteError::protocol(format!("远程连接列表无法解析：{error}"))
    })?;

    Ok(file.connections)
}

/// 按 id 找一条连接。
///
/// 找不到就是 `NotFound` —— workspace 里可能留着一条连接被删掉之后的标签页，
/// 那种情况下远程那一格应该显示「这条连接已经不在了」，而不是静默跳回本机目录。
pub fn find_connection(
    user_data_dir: &Path,
    connection_id: &str,
) -> Result<RemoteConnection, RemoteError> {
    load_connections(user_data_dir)?
        .into_iter()
        .find(|connection| connection.id == connection_id)
        .ok_or_else(|| {
            RemoteError::not_found(format!("这条远程连接已经不在连接列表里了：{connection_id}"))
        })
}

/// 装配一次远程操作所需的全部凭据。
///
/// # 「标记了有密码、却读不到密文」必须报错，不能当成「没存密码」
///
/// `credentialKey` 存在但 DPAPI 档案里没有对应条目时，若悄悄降级成「不带密码」，
/// 用户看到的会是「服务器拒绝了用户名或密码」—— 而他的密码一个字都没错，
/// 真正的问题是密文丢了。这正是 AGENTS 记过的那个坑的镜像版本：
/// **一条指向不存在数据的引用，比一条明写着「没有」的引用危险得多。**
pub fn resolve_connection(
    user_data_dir: &Path,
    app_data_dir: &Path,
    connection_id: &str,
) -> Result<ResolvedConnection, RemoteError> {
    let connection = find_connection(user_data_dir, connection_id)?;
    connection.validate()?;

    let Some(credential_key) = connection.credential_key.as_deref() else {
        return Ok(ResolvedConnection {
            connection,
            password: None,
        });
    };

    let password = credentials::load_credential(app_data_dir, credential_key)?.ok_or_else(|| {
        RemoteError::auth(format!(
            "这条连接标记了已保存密码，但本机找不到对应的加密记录。\
             请到设置页重新保存一次密码。（连接：{connection_id}）"
        ))
    })?;

    if password.is_empty() {
        return Err(RemoteError::auth(format!(
            "这条连接保存下来的密码是空串。请到设置页重新填写密码。（连接：{connection_id}）"
        )));
    }

    Ok(ResolvedConnection {
        connection,
        password: Some(password),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::connection::RemoteProtocol;
    use crate::remote::error::RemoteErrorKind;
    use crate::remote::transport::ProxyConfig;
    use tempfile::TempDir;

    /// 与前端 `src/stores/storage/remote-connections.ts` 共用同一份 fixture。
    /// 任何一侧改了连接字段名，这个测试会先转红。
    const SHARED_FIXTURE: &str = include_str!("../../../src-shared/remote-connection.sample.json");

    fn write_connections(user_data_dir: &Path, contents: &str) {
        std::fs::write(connections_path_in(user_data_dir), contents).expect("write connections file");
    }

    fn connection(id: &str) -> RemoteConnection {
        RemoteConnection {
            id: id.to_string(),
            name: "测试".to_string(),
            protocol: RemoteProtocol::Sftp,
            host: "192.168.1.9".to_string(),
            port: 22,
            username: "duanyi".to_string(),
            initial_path: "/".to_string(),
            local_path: None,
            proxy: ProxyConfig::Direct,
            credential_key: None,
        }
    }

    #[test]
    fn reads_the_shared_fixture_that_the_frontend_also_uses() {
        // 这条是跨语言护栏：fixture 里三条连接必须原样读得回来，
        // 并且各自的协议 / 代理 / 可选字段都对上。
        let dir = TempDir::new().expect("temp dir");
        write_connections(dir.path(), SHARED_FIXTURE);

        let connections = load_connections(dir.path()).expect("fixture must parse");

        assert_eq!(connections.len(), 3);

        let sftp = &connections[0];
        assert_eq!(sftp.id, "e2b24ab525544dc7adeb5cedb192179b");
        assert_eq!(sftp.protocol, RemoteProtocol::Sftp);
        assert_eq!(sftp.port, 22);
        assert_eq!(sftp.username, "duanyi");
        assert_eq!(sftp.local_path.as_deref(), Some("E:/website_sbt"));
        assert_eq!(sftp.credential_key.as_deref(), Some(sftp.id.as_str()));
        assert_eq!(sftp.proxy, ProxyConfig::Direct);
        assert_eq!(sftp.validate(), Ok(()));

        let ftp = &connections[1];
        assert_eq!(ftp.protocol, RemoteProtocol::Ftp);
        assert_eq!(
            ftp.proxy,
            ProxyConfig::Socks5 {
                host: "127.0.0.1".to_string(),
                port: 1080,
                username: None,
                password: None,
            }
        );
        // fixture 刻意没有 localPath —— 缺失必须读成 None 而不是崩。
        assert_eq!(ftp.local_path, None);

        let anonymous = &connections[2];
        assert_eq!(anonymous.username, "");
        assert_eq!(anonymous.credential_key, None);
        assert_eq!(anonymous.validate(), Ok(()));
    }

    #[test]
    fn a_missing_file_means_no_connections_rather_than_an_error() {
        let dir = TempDir::new().expect("temp dir");

        assert_eq!(load_connections(dir.path()).expect("must not fail"), Vec::new());
        assert_eq!(
            find_connection(dir.path(), "nobody").expect_err("must fail").kind,
            RemoteErrorKind::NotFound
        );
    }

    #[test]
    fn an_unparsable_file_is_a_config_error_not_a_network_error() {
        let dir = TempDir::new().expect("temp dir");
        write_connections(dir.path(), "{ this is not json");

        let error = load_connections(dir.path()).expect_err("must fail");

        // 归到 Protocol 是为了不把「配置坏了」引导成「去检查密码和网络」。
        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    #[test]
    fn an_empty_connections_array_is_valid() {
        let dir = TempDir::new().expect("temp dir");
        write_connections(dir.path(), r#"{"connections":[]}"#);

        assert!(load_connections(dir.path()).expect("must parse").is_empty());
    }

    #[test]
    fn a_file_without_the_connections_key_reads_as_empty() {
        // tauri-plugin-store 允许文件里只有别的键。不该因此报「解析失败」。
        let dir = TempDir::new().expect("temp dir");
        write_connections(dir.path(), r#"{"somethingElse":42}"#);

        assert!(load_connections(dir.path()).expect("must parse").is_empty());
    }

    #[test]
    fn unknown_connection_ids_are_not_found() {
        let dir = TempDir::new().expect("temp dir");
        write_connections(dir.path(), SHARED_FIXTURE);

        let error = find_connection(dir.path(), "keep-me").expect("must be found");
        assert_eq!(error.id, "keep-me");

        let missing = find_connection(dir.path(), "gone").expect_err("must fail");
        assert_eq!(missing.kind, RemoteErrorKind::NotFound);
    }

    #[test]
    fn a_connection_without_a_credential_key_resolves_to_no_password() {
        let dir = TempDir::new().expect("temp dir");
        let user_data = dir.path().join("user-data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        write_connections(&user_data, SHARED_FIXTURE);

        let resolved = resolve_connection(&user_data, dir.path(), "no-secret").expect("must resolve");

        assert_eq!(resolved.password, None);
        assert_eq!(resolved.connection.protocol, RemoteProtocol::Ftp);
    }

    /// 判别性的一条：fixture 里 `keep-me` 标了 `credentialKey`，但本机没有密文。
    /// 若悄悄降级成「不带密码」，用户会去改一个根本没问题的密码。
    #[test]
    fn a_dangling_credential_key_is_an_error_not_a_missing_password() {
        let dir = TempDir::new().expect("temp dir");
        let user_data = dir.path().join("user-data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        write_connections(&user_data, SHARED_FIXTURE);

        let error = resolve_connection(&user_data, dir.path(), "keep-me")
            .expect_err("must fail loudly");

        assert_eq!(error.kind, RemoteErrorKind::Auth);
    }

    #[test]
    fn a_stored_password_is_decrypted_and_handed_over() {
        let dir = TempDir::new().expect("temp dir");
        let user_data = dir.path().join("user-data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        write_connections(
            &user_data,
            &serde_json::to_string(&ConnectionsFile {
                connections: vec![RemoteConnection {
                    credential_key: Some("saved-secret".to_string()),
                    ..connection("conn-secret")
                }],
            })
            .expect("serialize"),
        );
        credentials::save_credential(dir.path(), "saved-secret", "P@ssw0rd")
            .expect("save credential");

        let resolved =
            resolve_connection(&user_data, dir.path(), "conn-secret").expect("must resolve");

        assert_eq!(resolved.password.as_deref(), Some("P@ssw0rd"));
    }

    #[test]
    fn an_empty_stored_password_is_rejected_instead_of_being_sent() {
        // 空口令会被真的发给服务器，于是得到一句含糊的「拒绝登录」。
        // 与其在协议层猜，不如在这里说清楚是存档出了问题。
        let dir = TempDir::new().expect("temp dir");
        let user_data = dir.path().join("user-data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        write_connections(
            &user_data,
            &serde_json::to_string(&ConnectionsFile {
                connections: vec![RemoteConnection {
                    credential_key: Some("blank-secret".to_string()),
                    ..connection("conn-blank")
                }],
            })
            .expect("serialize"),
        );
        credentials::save_credential(dir.path(), "blank-secret", "").expect("save credential");

        let error = resolve_connection(&user_data, dir.path(), "conn-blank").expect_err("must fail");

        assert_eq!(error.kind, RemoteErrorKind::Auth);
    }

    #[test]
    fn a_corrupt_connection_stops_the_operation_before_it_reaches_the_network() {
        let dir = TempDir::new().expect("temp dir");
        let user_data = dir.path().join("user-data");
        std::fs::create_dir_all(&user_data).expect("mkdir");
        let mut broken = connection("conn-broken");
        broken.host = "  ".to_string();
        write_connections(
            &user_data,
            &serde_json::to_string(&ConnectionsFile {
                connections: vec![broken],
            })
            .expect("serialize"),
        );

        let error = resolve_connection(&user_data, dir.path(), "conn-broken")
            .expect_err("must fail");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }
}
