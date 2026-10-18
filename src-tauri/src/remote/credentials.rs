// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程凭据的 DPAPI 加解密与落盘。
//!
//! 本文件被 `cargo test --lib` 的测试二进制链接，**不得出现 `tauri::` 的任何路径** ——
//! 理由见 `src-tauri/src/remote/mod.rs` 顶部。
//!
//! 密文走**独立文件**（`<app_data_dir>/remote-credentials.json`），不进 storage 文件链。
//! 两条链混用会绕过前端 schema 迁移与读白名单 —— 本项目已经因为
//! 「读写两侧不同步导致重启丢数据」吃过一次亏。

use crate::remote::error::{RemoteError, RemoteErrorKind};
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// 凭据文件名。落在应用自己的 app-data 目录里，与 `mcp-access.json` 平级。
pub const REMOTE_CREDENTIALS_FILE: &str = "remote-credentials.json";

/// 存档格式版本。读到不认识的版本按「没有凭据」处理 ——
/// 宁可让用户重输一次密码，也不要拿一份自己读不懂的存档去猜。
const VAULT_VERSION: u32 = 1;

/// `remote-credentials.json` 的落盘形状。
///
/// 用 `BTreeMap` 而不是 `HashMap`：存档顺序稳定，写同一个键两次得到同一份文件，
/// 差异才好排查。值是 base64 编码的 DPAPI 密文，**不是密码本身**。
#[derive(Debug, Clone, Serialize, Deserialize)]
struct CredentialVault {
    version: u32,
    #[serde(default)]
    entries: BTreeMap<String, String>,
}

impl CredentialVault {
    fn empty() -> Self {
        Self {
            version: VAULT_VERSION,
            entries: BTreeMap::new(),
        }
    }
}

pub fn credentials_path_in(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(REMOTE_CREDENTIALS_FILE)
}

/// 读存档。**文件缺失、解析失败、版本不认识，三者都按「没有凭据」处理** ——
/// 与 `mcp/auth.rs` 的既有策略一致：宁可退回干净状态，也不要拿半截文件推导状态。
fn read_vault(app_data_dir: &Path) -> CredentialVault {
    let path = credentials_path_in(app_data_dir);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return CredentialVault::empty();
    };

    match serde_json::from_str::<CredentialVault>(&raw) {
        Ok(vault) if vault.version == VAULT_VERSION => vault,
        Ok(vault) => {
            log::warn!(
                "Ignoring credential vault {} because it uses version {} instead of {VAULT_VERSION}",
                path.display(),
                vault.version
            );
            CredentialVault::empty()
        }
        Err(error) => {
            log::warn!(
                "Treating unreadable credential vault {} as empty: {error}",
                path.display()
            );
            CredentialVault::empty()
        }
    }
}

fn write_vault(app_data_dir: &Path, vault: &CredentialVault) -> Result<(), RemoteError> {
    std::fs::create_dir_all(app_data_dir).map_err(|error| {
        RemoteError::unknown(format!("创建远程凭据目录失败: {error}"))
    })?;

    let payload = serde_json::to_string_pretty(vault)
        .map_err(|error| RemoteError::unknown(format!("序列化远程凭据失败: {error}")))?;

    let path = credentials_path_in(app_data_dir);
    std::fs::write(&path, payload)
        .map_err(|error| RemoteError::unknown(format!("写入远程凭据文件失败: {error}")))?;

    // DPAPI 已经把同机其他账号挡住了，收 DACL 是再加一层。
    // 这一步失败只记警告 —— 收紧权限是加固，不该因为它把「保存密码」整个挡掉。
    crate::mcp::auth::restrict_to_current_user(&path, "remote credential");
    Ok(())
}

fn validate_key(key: &str) -> Result<(), RemoteError> {
    if key.trim().is_empty() {
        return Err(RemoteError::protocol("凭据键不能为空"));
    }
    Ok(())
}

/// 用当前用户的 DPAPI 加密。
///
/// **必须**带 `CRYPTPROTECT_UI_FORBIDDEN`：少了它，Windows 可以在任何时候弹 UI 索要凭据，
/// 而这是一条无人值守的后台路径，弹窗既没人看也挡不住。
#[cfg(windows)]
pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, RemoteError> {
    use windows::Win32::Security::Cryptography::{
        CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };
    use windows::core::PCWSTR;

    let length = u32::try_from(plaintext.len())
        .map_err(|_| RemoteError::protocol("待加密的内容超过 DPAPI 的长度上限"))?;

    let input = CRYPT_INTEGER_BLOB {
        cbData: length,
        // DPAPI 只读这块内存。这里抹掉 const 纯粹是为了对上 Win32 的签名。
        pbData: plaintext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    let result = unsafe {
        CryptProtectData(
            &input,
            PCWSTR::null(),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };

    result.map_err(|error| RemoteError::auth(format!("DPAPI 加密失败: {error}")))?;
    let bytes = take_dpapi_blob(output.pbData, output.cbData);
    free_dpapi_blob(output.pbData);

    Ok(bytes)
}

#[cfg(not(windows))]
pub fn protect(_plaintext: &[u8]) -> Result<Vec<u8>, RemoteError> {
    Err(RemoteError::unsupported(
        "凭据加密目前只支持 Windows（DPAPI），当前平台无法保存密码",
    ))
}

/// 解 DPAPI 密文。
///
/// 解不开**归 `Auth` 而不是 `Unknown`**：成因几乎都是「这份密文不是当前用户写的」
/// （用户换了、数据目录被复制过来、文件被手改），用户侧的处置都是重新输入密码。
#[cfg(windows)]
pub fn unprotect(ciphertext: &[u8]) -> Result<Vec<u8>, RemoteError> {
    use windows::Win32::Security::Cryptography::{
        CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    };

    let length = u32::try_from(ciphertext.len())
        .map_err(|_| RemoteError::auth("已保存的凭据长度不合法，请重新输入密码"))?;

    let input = CRYPT_INTEGER_BLOB {
        cbData: length,
        pbData: ciphertext.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    let result = unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };

    result.map_err(|error| {
        RemoteError::auth(format!("已保存的凭据无法解密，请重新输入密码: {error}"))
    })?;
    let bytes = take_dpapi_blob(output.pbData, output.cbData);
    free_dpapi_blob(output.pbData);

    Ok(bytes)
}

#[cfg(not(windows))]
pub fn unprotect(_ciphertext: &[u8]) -> Result<Vec<u8>, RemoteError> {
    Err(RemoteError::unsupported(
        "凭据解密目前只支持 Windows（DPAPI），当前平台无法读取已保存的密码",
    ))
}

/// DPAPI 分配的缓冲区由 `LocalFree` 释放，不是 Rust 的 `Vec`。
#[cfg(windows)]
fn free_dpapi_blob(pointer: *mut u8) {
    use windows::Win32::Foundation::{HLOCAL, LocalFree};

    if pointer.is_null() {
        return;
    }

    unsafe {
        let _returned = LocalFree(HLOCAL(pointer as *mut core::ffi::c_void));
    }
}

/// 拷出 DPAPI 的输出。`cbData == 0` 时**不能**调 `from_raw_parts` ——
/// 那要求指针非空且对齐，拿一个可能为 null 的指针去构造零长切片是 UB。
#[cfg(windows)]
fn take_dpapi_blob(pointer: *mut u8, length: u32) -> Vec<u8> {
    if length == 0 || pointer.is_null() {
        return Vec::new();
    }

    unsafe { std::slice::from_raw_parts(pointer, length as usize) }.to_vec()
}

/// 读一个已保存的密码。没有就是 `Ok(None)`。
///
/// **解不开时报错，不悄悄当成「没存」。** 悄悄吞掉的话，用户会用空密码去连服务器，
/// 拿回来的是一个更迷惑的远端 `Auth` 错误 —— 那时候没人查得到是这个文件坏了。
pub fn load_credential(app_data_dir: &Path, key: &str) -> Result<Option<String>, RemoteError> {
    validate_key(key)?;

    let vault = read_vault(app_data_dir);
    let Some(encoded) = vault.entries.get(key) else {
        return Ok(None);
    };

    let ciphertext = BASE64_STANDARD.decode(encoded).map_err(|error| {
        RemoteError::auth(format!("已保存的凭据不是有效的密文，请重新输入密码: {error}"))
    })?;

    let plaintext = unprotect(&ciphertext)?;

    String::from_utf8(plaintext)
        .map(Some)
        .map_err(|_| RemoteError::auth("已保存的凭据不是有效文本，请重新输入密码"))
}

/// 加密并保存一个密码。同键再次调用会**替换**旧值。
pub fn save_credential(app_data_dir: &Path, key: &str, secret: &str) -> Result<(), RemoteError> {
    validate_key(key)?;

    let ciphertext = protect(secret.as_bytes())?;
    let mut vault = read_vault(app_data_dir);
    vault
        .entries
        .insert(key.to_string(), BASE64_STANDARD.encode(&ciphertext));

    write_vault(app_data_dir, &vault)
}

/// 删掉一个已保存的密码。键不存在是**成功的空操作**，不是错误 ——
/// 删除动作的调用方不该因为「本来就没有」而中断。
pub fn delete_credential(app_data_dir: &Path, key: &str) -> Result<(), RemoteError> {
    validate_key(key)?;

    let mut vault = read_vault(app_data_dir);
    if vault.entries.remove(key).is_none() {
        return Ok(());
    }

    write_vault(app_data_dir, &vault)
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
    use tempfile::TempDir;

    /// 一个 1 MiB 的确定性填充块。DPAPI 没有长度上限，
    /// 这一条防的是「实现里写了个人为的长度上限」。
    fn megabyte() -> Vec<u8> {
        (0..1024 * 1024).map(|index| (index % 251) as u8).collect()
    }

    fn temp_dir() -> TempDir {
        TempDir::new().expect("create temp dir")
    }

    // ---- protect / unprotect -------------------------------------------------

    /// 阳性对照：如果这一条不成立，下面所有「round-trip 通过」都可能只是
    /// `unprotect` 把输入原样返回了。
    #[test]
    fn protect_produces_ciphertext_that_is_not_the_plaintext() {
        let plaintext = b"correct horse battery staple";

        let ciphertext = protect(plaintext).expect("protect");

        assert_ne!(ciphertext.as_slice(), plaintext);
        assert!(
            !contains_subslice(&ciphertext, plaintext),
            "密文里不能出现明文片段"
        );
        assert!(
            ciphertext.len() >= plaintext.len(),
            "DPAPI 会带头部与签名，长度不该比明文短"
        );
    }

    #[test]
    fn protect_and_unprotect_round_trip() {
        // 中文、emoji、空格混排 —— 密码里出现非 ASCII 是常态，不是边界情况。
        let plaintext = "p@ss 中文🔐 word".as_bytes();

        let ciphertext = protect(plaintext).expect("protect");
        let recovered = unprotect(&ciphertext).expect("unprotect");

        assert_eq!(recovered.as_slice(), plaintext);
    }

    #[test]
    fn empty_plaintext_round_trips() {
        let ciphertext = protect(b"").expect("protect");

        assert_eq!(unprotect(&ciphertext).expect("unprotect"), Vec::<u8>::new());
    }

    #[test]
    fn large_plaintext_round_trips() {
        let plaintext = megabyte();

        let ciphertext = protect(&plaintext).expect("protect");
        let recovered = unprotect(&ciphertext).expect("unprotect");

        assert_eq!(recovered.len(), plaintext.len());
        assert_eq!(recovered.as_slice(), plaintext.as_slice());
    }

    #[test]
    fn the_same_plaintext_encrypts_to_different_ciphertext_each_time() {
        // DPAPI 带随机熵。不锁住这一条的话，「密文相同就说明没加密」这种误判会一直存在。
        let plaintext = b"same input";

        let first = protect(plaintext).expect("first protect");
        let second = protect(plaintext).expect("second protect");

        assert_ne!(first, second);
        assert_eq!(unprotect(&first).expect("first unprotect"), plaintext);
        assert_eq!(unprotect(&second).expect("second unprotect"), plaintext);
    }

    #[test]
    fn random_bytes_are_rejected_as_ciphertext() {
        let garbage: Vec<u8> = (0..64).map(|index| (index * 7 + 3) as u8).collect();

        let error = unprotect(&garbage).expect_err("随机字节必须被拒");

        assert_eq!(
            error.kind,
            RemoteErrorKind::Auth,
            "解不开的密文归 Auth，让用户去重输密码，不是笼统的 Unknown：{error}"
        );
    }

    #[test]
    fn truncated_ciphertext_is_rejected() {
        let ciphertext = protect(b"a reasonably long secret value").expect("protect");
        let truncated = &ciphertext[..ciphertext.len() / 2];

        assert!(unprotect(truncated).is_err(), "半截密文必须被拒");
    }

    #[test]
    fn empty_ciphertext_is_rejected() {
        assert!(unprotect(&[]).is_err(), "空输入不可能是合法密文");
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_platform_reports_unsupported_instead_of_panicking() {
        assert_eq!(
            protect(b"x").expect_err("macOS / Linux 上没有 DPAPI").kind,
            RemoteErrorKind::Unsupported
        );
        assert_eq!(
            unprotect(b"x").expect_err("macOS / Linux 上没有 DPAPI").kind,
            RemoteErrorKind::Unsupported
        );
    }

    // ---- 落盘往返 -----------------------------------------------------------

    #[test]
    fn the_credential_file_sits_next_to_the_other_app_data_files() {
        let dir = temp_dir();

        let path = credentials_path_in(dir.path());

        assert_eq!(path, dir.path().join(REMOTE_CREDENTIALS_FILE));
        assert_eq!(path.file_name().and_then(|n| n.to_str()), Some("remote-credentials.json"));
    }

    #[test]
    fn save_then_load_round_trips_through_the_real_file() {
        let dir = temp_dir();

        save_credential(dir.path(), "cred-1", "s3cr3t").expect("save");
        let loaded = load_credential(dir.path(), "cred-1").expect("load");

        assert_eq!(loaded.as_deref(), Some("s3cr3t"));
    }

    /// 阳性对照：真正证明「加密落盘」发生了，而不只是「写了个文件」。
    ///
    /// ⚠️ 第一版这条只查「文件里有没有出现明文」，**完全绕过 DPAPI 时它照样是绿的** ——
    /// 因为落盘的是 base64，明文当然搜不到。查明文证明不了任何事，
    /// 只有「密文能被 unprotect 解回原文」才真的区分了「加密」与「随便编个 base64」。
    #[test]
    fn the_credential_file_stores_real_dpapi_ciphertext() {
        let dir = temp_dir();
        let secret = "PlainTextSecret123";

        save_credential(dir.path(), "cred-1", secret).expect("save");

        let raw = std::fs::read(credentials_path_in(dir.path())).expect("read raw file");

        // 一、明文与它的 base64 都不许出现在文件里。
        assert!(
            !contains_subslice(&raw, secret.as_bytes()),
            "凭据文件里绝不能出现明文密码"
        );
        assert!(
            !String::from_utf8_lossy(&raw).contains(&BASE64_STANDARD.encode(secret)),
            "凭据文件里绝不能出现密码的 base64 —— 那等于明文落盘换个写法"
        );

        // 二、文件里那条必须能被 unprotect 解回原文。
        let stored = extract_cipher_text(&String::from_utf8_lossy(&raw));
        let ciphertext = BASE64_STANDARD.decode(&stored).expect("存档里应当是 base64");
        assert_eq!(
            unprotect(&ciphertext).expect("存档里必须是真正的 DPAPI 密文"),
            secret.as_bytes(),
            "存档里的东西必须能被 DPAPI 解回原文"
        );
    }

    #[test]
    fn a_unicode_secret_survives_the_round_trip_byte_for_byte() {
        let dir = temp_dir();
        let secret = "密码🔐with spaces";

        save_credential(dir.path(), "cred-1", secret).expect("save");

        assert_eq!(
            load_credential(dir.path(), "cred-1").expect("load").as_deref(),
            Some(secret)
        );
    }

    #[test]
    fn loading_an_unknown_key_returns_none() {
        let dir = temp_dir();
        save_credential(dir.path(), "cred-1", "value").expect("save");

        assert_eq!(load_credential(dir.path(), "cred-2").expect("load"), None);
    }

    #[test]
    fn loading_from_a_missing_file_returns_none_rather_than_an_error() {
        let dir = temp_dir();

        assert_eq!(load_credential(dir.path(), "cred-1").expect("load"), None);
    }

    #[test]
    fn saving_again_replaces_the_previous_secret() {
        let dir = temp_dir();

        save_credential(dir.path(), "cred-1", "old").expect("first save");
        save_credential(dir.path(), "cred-1", "new").expect("second save");

        assert_eq!(
            load_credential(dir.path(), "cred-1").expect("load").as_deref(),
            Some("new")
        );
    }

    #[test]
    fn saving_one_key_keeps_the_others() {
        let dir = temp_dir();

        save_credential(dir.path(), "cred-1", "one").expect("save 1");
        save_credential(dir.path(), "cred-2", "two").expect("save 2");
        save_credential(dir.path(), "cred-3", "three").expect("save 3");

        assert_eq!(
            load_credential(dir.path(), "cred-1").expect("load 1").as_deref(),
            Some("one")
        );
        assert_eq!(
            load_credential(dir.path(), "cred-2").expect("load 2").as_deref(),
            Some("two")
        );
        assert_eq!(
            load_credential(dir.path(), "cred-3").expect("load 3").as_deref(),
            Some("three")
        );
    }

    #[test]
    fn delete_removes_only_the_named_key() {
        let dir = temp_dir();
        save_credential(dir.path(), "cred-1", "one").expect("save 1");
        save_credential(dir.path(), "cred-2", "two").expect("save 2");

        delete_credential(dir.path(), "cred-1").expect("delete");

        assert_eq!(load_credential(dir.path(), "cred-1").expect("load 1"), None);
        assert_eq!(
            load_credential(dir.path(), "cred-2").expect("load 2").as_deref(),
            Some("two")
        );
    }

    #[test]
    fn deleting_an_unknown_key_is_a_no_op() {
        let dir = temp_dir();
        save_credential(dir.path(), "cred-1", "one").expect("save");

        delete_credential(dir.path(), "cred-absent").expect("delete absent");
        delete_credential(dir.path(), "cred-absent").expect("delete twice");

        assert_eq!(
            load_credential(dir.path(), "cred-1").expect("load").as_deref(),
            Some("one")
        );
    }

    #[test]
    fn save_creates_the_app_data_dir_when_it_is_missing() {
        let dir = temp_dir();
        let nested = dir.path().join("not").join("created").join("yet");

        save_credential(&nested, "cred-1", "value").expect("save");

        assert_eq!(
            load_credential(&nested, "cred-1").expect("load").as_deref(),
            Some("value")
        );
    }

    #[test]
    fn blank_keys_are_rejected() {
        let dir = temp_dir();

        assert!(save_credential(dir.path(), "", "value").is_err());
        assert!(save_credential(dir.path(), "   ", "value").is_err());
        assert!(load_credential(dir.path(), "").is_err());
        assert!(delete_credential(dir.path(), "").is_err());
    }

    // ---- 损坏数据的处置 -----------------------------------------------------

    /// 关键策略：解不开的密文**必须报错**，不能悄悄当成「没存密码」。
    /// 悄悄吞掉的话，用户会用空密码去连服务器，拿回来的是一个更迷惑的 `Auth`。
    #[test]
    fn a_corrupted_entry_surfaces_an_error_instead_of_silently_dropping_the_secret() {
        let dir = temp_dir();
        save_credential(dir.path(), "cred-1", "value").expect("save");

        // 把这一条替换成「能过 base64、但不是 DPAPI 密文」的内容。
        let raw = std::fs::read_to_string(credentials_path_in(dir.path())).expect("read");
        let tampered = raw.replace(
            &extract_cipher_text(&raw),
            "bm90LWEtcmVhbC1kcGFwaS1jaXBoZXJ0ZXh0",
        );
        std::fs::write(credentials_path_in(dir.path()), tampered).expect("write tampered");

        let error = load_credential(dir.path(), "cred-1").expect_err("损坏的密文必须报错");

        assert_eq!(error.kind, RemoteErrorKind::Auth);
    }

    #[test]
    fn an_entry_that_is_not_even_base64_surfaces_an_error() {
        let dir = temp_dir();
        std::fs::write(
            credentials_path_in(dir.path()),
            r#"{"version":1,"entries":{"cred-1":"这不是 base64!!"}}"#,
        )
        .expect("write");

        assert!(load_credential(dir.path(), "cred-1").is_err());
    }

    /// 整个文件是半截 JSON —— 与 `mcp/auth.rs` 的既有策略一致：
    /// 宁可退回「没有凭据」，也不要拿半截文件推导出状态。
    #[test]
    fn a_truncated_json_file_is_treated_as_an_empty_vault() {
        let dir = temp_dir();
        std::fs::write(
            credentials_path_in(dir.path()),
            r#"{"version":1,"entries":{"cred-1":"QUJD"#,
        )
        .expect("write");

        assert_eq!(load_credential(dir.path(), "cred-1").expect("load"), None);
    }

    #[test]
    fn an_unknown_file_version_is_treated_as_an_empty_vault() {
        let dir = temp_dir();
        std::fs::write(
            credentials_path_in(dir.path()),
            r#"{"version":9999,"entries":{"cred-1":"QUJD"}}"#,
        )
        .expect("write");

        assert_eq!(load_credential(dir.path(), "cred-1").expect("load"), None);
    }

    /// 把存档里某个 entry 的 base64 原文取出来，供篡改测试替换。
    fn extract_cipher_text(raw: &str) -> String {
        raw.split("\"cred-1\":")
            .nth(1)
            .and_then(|rest| rest.split('"').nth(1))
            .expect("存档里应当有 cred-1 这一条")
            .to_string()
    }

    /// 子串查找。`windows::core` 那套 slice API 在这个位置是多余的。
    fn contains_subslice(haystack: &[u8], needle: &[u8]) -> bool {
        if needle.is_empty() {
            return true;
        }
        haystack.windows(needle.len()).any(|w| w == needle)
    }
}
