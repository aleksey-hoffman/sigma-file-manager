// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! 一键把本服务写进各 AI 客户端的 MCP 配置。
//!
//! # 为什么这里刻意「先探测、再写、且一定备份」
//!
//! 我们改的是**别的软件的配置文件** —— `~/.claude.json` 里还有用户的 projects、
//! machineID、迁移标记；`~/.codex/config.toml` 里还有 provider 配置。
//! 写坏一份，用户丢掉的是那个客户端的全部状态，而且很难查是谁弄坏的。
//! 所以这里的每一条路径都遵守同样的规矩：
//!
//! 1. **只做合并，不做整体重写。** JSON 走「解析 → 改一个键 → 序列化」，
//!    别的键原样保留；TOML 走「文本层面摘掉旧表块 → 追加新表块」，
//!    不引入 TOML 解析器，免得 round-trip 把用户的排版和注释全洗掉。
//! 2. **解析失败就拒绝写。** 宁可报错让用户自己看一眼，也不拿一份解析不了的
//!    文件去覆盖它 —— 那等于用空文件换掉用户的真配置。
//! 3. **写之前一定备份。** 落到 `<原路径>.alpha-mcp.bak`，覆盖前先留一份。
//!
//! # 本模块刻意不碰 Tauri
//!
//! 同目录其它模块的约束在这里同样适用：`src-tauri/src/mcp/` 下的代码会被
//! `cargo test --lib` 链接到，一旦碰到 `tauri::AppHandle` 或
//! `tauri::async_runtime::*`，Wry 运行时会被单态化进来，拖进 tao 的
//! `TaskDialogIndirect`（comctl32 v6），测试二进制在加载阶段就
//! `STATUS_ENTRYPOINT_NOT_FOUND`，一个测试都跑不了。
//! 所以家目录走 `std::env`，路径解析做成接收 `home: &Path` 的纯函数 ——
//! 这样连单测都能在任意临时目录上跑真实读写。

use std::fs;
use std::path::{Path, PathBuf};

/// 我们写入配置时使用的服务名。刻意固定，客户端侧改名等于换了个服务。
pub const SERVER_NAME: &str = "alpha-file-manager";

/// 备份文件后缀。用户想回退就把 `.bak` 改回原名。
pub const BACKUP_SUFFIX: &str = ".alpha-mcp.bak";

/// 支持一键部署的客户端。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum McpClientKind {
    Codex,
    Cursor,
    ClaudeCode,
    ClaudeDesktop,
    OpenClaw,
    MinimaxCode,
}

impl McpClientKind {
    pub const ALL: [McpClientKind; 6] = [
        McpClientKind::Codex,
        McpClientKind::Cursor,
        McpClientKind::ClaudeCode,
        McpClientKind::ClaudeDesktop,
        McpClientKind::OpenClaw,
        McpClientKind::MinimaxCode,
    ];

    /// 稳定的机器可读标识，前端按它发命令。
    pub fn id(self) -> &'static str {
        match self {
            McpClientKind::Codex => "codex",
            McpClientKind::Cursor => "cursor",
            McpClientKind::ClaudeCode => "claudeCode",
            McpClientKind::ClaudeDesktop => "claudeDesktop",
            McpClientKind::OpenClaw => "openclaw",
            McpClientKind::MinimaxCode => "minimaxCode",
        }
    }

    pub fn parse(value: &str) -> Result<Self, String> {
        Self::ALL
            .into_iter()
            .find(|kind| kind.id() == value)
            .ok_or_else(|| format!("未知的客户端: {value}"))
    }

    /// 配置文件的落点。传 `home` 而不是自己读环境变量，
    /// 是为了让这段路径解析能被单测直接断言。
    pub fn config_path(self, home: &Path) -> PathBuf {
        match self {
            // Codex 用 TOML，且认 CODEX_HOME 覆盖整个目录。
            // 优先读环境变量，因为用户显式设过的优先级一定高于默认值。
            McpClientKind::Codex => env_path("CODEX_HOME")
                .map(|dir| dir.join("config.toml"))
                .unwrap_or_else(|| home.join(".codex").join("config.toml")),
            McpClientKind::Cursor => home.join(".cursor").join("mcp.json"),
            McpClientKind::ClaudeCode => home.join(".claude.json"),
            // Windows 与 macOS 的 Claude Desktop 配置目录不一样，
            // Linux 跟 macOS 同构。APPDATA 读不到就退回 macOS 那套。
            McpClientKind::ClaudeDesktop => env_path("APPDATA")
                .map(|dir| dir.join("Claude").join("claude_desktop_config.json"))
                .unwrap_or_else(|| {
                    home.join("Library")
                        .join("Application Support")
                        .join("Claude")
                        .join("claude_desktop_config.json")
                }),
            McpClientKind::OpenClaw => home.join(".openclaw").join("config.json"),
            // Minimax Code 的数据目录名里有个同名子目录（`~/.minimax/.minimax/`），
            // 且允许用 MINIMAX_HOME / MINIMAX_DATA_DIR 搬家，所以按候选顺序探测，
            // 取第一个**已经存在**的；都不存在时退回默认那套，由安装动作去创建。
            McpClientKind::MinimaxCode => {
                let candidates = [
                    env_path("MINIMAX_DATA_DIR").map(|dir| dir.join("mcp.json")),
                    env_path("MINIMAX_HOME").map(|dir| dir.join(".minimax").join("mcp.json")),
                    Some(home.join(".minimax").join(".minimax").join("mcp.json")),
                    Some(home.join(".minimax").join("mcp.json")),
                ];
                candidates
                    .into_iter()
                    .flatten()
                    .find(|candidate| candidate.exists())
                    .unwrap_or_else(|| {
                        home.join(".minimax").join(".minimax").join("mcp.json")
                    })
            }
        }
    }

    /// 「这台机器上装了没」。
    ///
    /// 判据是**配置目录或配置文件存在**，不是去找可执行文件 —— 后者会漏掉所有
    /// 以 GUI 方式安装、不进 PATH 的客户端。
    ///
    /// 但这会带来一个已知误报：卸载干净的客户端会留下空的配置目录。本机实测
    /// `%APPDATA%\Claude\` 只有两个配置文件、Claude Desktop 本体根本没装，
    /// 只按目录判会显示成「已装」。所以额外要求配置目录里**有实质内容**
    /// （至少一个文件），空目录不算。
    pub fn is_detected(self, home: &Path) -> bool {
        let path = self.config_path(home);

        if path.exists() {
            return true;
        }

        let Some(parent) = path.parent() else {
            return false;
        };
        if !parent.exists() {
            return false;
        }

        // 目录在但里面空空如也 -> 卸载残留，不算装了。
        fs::read_dir(parent)
            .map(|mut entries| entries.next().is_some())
            .unwrap_or(false)
    }
}

fn env_path(key: &str) -> Option<PathBuf> {
    std::env::var_os(key)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// 取家目录。读不到就返回错误而不是猜 `C:\Users\<用户名>` 之类的路径 ——
/// 猜错会把配置写到别的用户目录里去。
pub fn home_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    let key = "USERPROFILE";
    #[cfg(not(windows))]
    let key = "HOME";

    std::env::var_os(key)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| format!("读取环境变量 {key} 失败，无法定位用户家目录"))
}

/// 把服务条目写进一份 JSON 配置，返回合并后的完整文本。
///
/// 纯函数：只吃字符串、只吐字符串，单测可以在内存里跑。
/// `existing` 为空串表示「文件还不存在」。
pub fn merge_json_entry(existing: &str, entry: &serde_json::Value) -> Result<String, String> {
    let mut root: serde_json::Value = if existing.trim().is_empty() {
        serde_json::json!({})
    } else {
        // 解析不了就报错。绝不能拿一个空对象去覆盖用户的真配置 ——
        // 那等于用「配置没了」换掉「配置里多了我们一项」。
        serde_json::from_str(existing).map_err(|error| {
            format!("配置文件不是合法 JSON，已拒绝写入以免损坏原文件: {error}")
        })?
    };

    if !root.is_object() {
        return Err("配置根节点不是对象，已拒绝写入".to_string());
    }

    let servers = root
        .as_object_mut()
        .expect("上面已确认是对象")
        .entry("mcpServers")
        .or_insert_with(|| serde_json::json!({}));

    if !servers.is_object() {
        // 已有 mcpServers 但形状不对（数组/字符串），覆盖会毁掉用户原有内容。
        return Err("配置里已有 mcpServers 但不是对象，已拒绝写入".to_string());
    }

    servers
        .as_object_mut()
        .expect("上面已确认是对象")
        .insert(SERVER_NAME.to_string(), entry.clone());

    serde_json::to_string_pretty(&root).map_err(|error| format!("序列化失败: {error}"))
}

/// 从一份 JSON 配置里摘掉我们的条目。文件不存在或没有这一项都算成功。
pub fn remove_json_entry(existing: &str) -> Result<String, String> {
    let mut root: serde_json::Value = if existing.trim().is_empty() {
        serde_json::json!({})
    } else {
        serde_json::from_str(existing)
            .map_err(|error| format!("配置文件不是合法 JSON，未做任何改动: {error}"))?
    };

    if let Some(servers) = root.get_mut("mcpServers").and_then(|value| value.as_object_mut()) {
        servers.remove(SERVER_NAME);
    }

    serde_json::to_string_pretty(&root).map_err(|error| format!("序列化失败: {error}"))
}

/// 把 `[mcp_servers.<name>]` 表块追加进一份 TOML 文本，已存在则原地替换。
///
/// 刻意不做「解析成值再序列化回去」：那会把用户的排版、注释、字段顺序全洗掉，
/// 而 `config.toml` 往往是被手工维护、还可能进版本库的。这里只在**文本层面**
/// 摘掉同名表块再追加，其余字节一个不动。
pub fn merge_toml_entry(existing: &str, table_block: &str) -> String {
    let stripped = strip_toml_table(existing, &format!("mcp_servers.{SERVER_NAME}"));
    let mut out = stripped.trim_end().to_string();

    if !out.is_empty() {
        out.push_str("\n\n");
    }
    out.push_str(table_block.trim_end());
    out.push('\n');
    out
}

/// 摘掉 `[<name>]` 及其后所有 `key = value` 行，直到遇到下一个顶层表头。
/// 没有这个表就原样返回。
fn strip_toml_table(text: &str, name: &str) -> String {
    let header = format!("[{name}]");
    let lines: Vec<&str> = text.lines().collect();

    let Some(start) = lines.iter().position(|line| line.trim() == header) else {
        return text.trim_end().to_string();
    };

    // 从表头下一行开始，找到下一个以 '[' 开头的行 —— 那就是下一张表的边界。
    let mut end = lines.len();
    for offset in start + 1..lines.len() {
        if lines[offset].trim_start().starts_with('[') {
            end = offset;
            break;
        }
    }

    let mut kept: Vec<&str> = Vec::with_capacity(lines.len());
    kept.extend_from_slice(&lines[..start]);
    kept.extend_from_slice(&lines[end.min(lines.len())..]);
    kept.join("\n").trim_end().to_string()
}

/// 写盘前的备份。返回备份路径；原文件不存在时返回 `None`（没东西可备份）。
fn backup(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let mut backup_name = path.as_os_str().to_os_string();
    backup_name.push(BACKUP_SUFFIX);
    let backup_path = PathBuf::from(backup_name);

    fs::copy(path, &backup_path)
        .map_err(|error| format!("备份 {} 失败: {error}", path.display()))?;
    Ok(Some(backup_path))
}

fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("创建目录 {} 失败: {error}", parent.display()))?;
    }
    fs::write(path, contents).map_err(|error| format!("写入 {} 失败: {error}", path.display()))
}

/// 一次部署的结果，回给前端展示「到底改了哪个文件」。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeployOutcome {
    pub config_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
    /// 这次写入是否真的动了文件内容（重复点同一个按钮会是 false）。
    pub changed: bool,
}

/// 写入单个客户端的配置。
pub fn install(kind: McpClientKind, endpoint: &str, token: &str) -> Result<DeployOutcome, String> {
    let home = home_dir()?;
    let path = kind.config_path(&home);
    let existing = fs::read_to_string(&path).unwrap_or_default();
    let next = match kind {
        McpClientKind::Codex => {
            let block = format!(
                "[mcp_servers.{SERVER_NAME}]\n\
                 url = \"{endpoint}\"\n\
                 http_headers = {{ Authorization = \"Bearer {token}\" }}\n"
            );
            merge_toml_entry(&existing, &block)
        }
        _ => {
            let entry = json_entry(endpoint, token, kind);
            merge_json_entry(&existing, &entry)?
        }
    };

    if existing == next {
        return Ok(DeployOutcome {
            config_path: path.display().to_string(),
            backup_path: None,
            changed: false,
        });
    }

    let backup_path = backup(&path)?;
    write_atomic(&path, &next)?;

    Ok(DeployOutcome {
        config_path: path.display().to_string(),
        backup_path: backup_path.map(|p| p.display().to_string()),
        changed: true,
    })
}

/// 摘掉单个客户端配置里的我们的条目。
pub fn uninstall(kind: McpClientKind) -> Result<DeployOutcome, String> {
    let home = home_dir()?;
    let path = kind.config_path(&home);
    let existing = fs::read_to_string(&path).unwrap_or_default();
    let next = match kind {
        McpClientKind::Codex => merge_toml_entry(&existing, ""),
        _ => remove_json_entry(&existing)?,
    };

    if existing == next {
        return Ok(DeployOutcome {
            config_path: path.display().to_string(),
            backup_path: None,
            changed: false,
        });
    }

    let backup_path = backup(&path)?;
    write_atomic(&path, &next)?;

    Ok(DeployOutcome {
        config_path: path.display().to_string(),
        backup_path: backup_path.map(|p| p.display().to_string()),
        changed: true,
    })
}

/// 读一份配置，判断里面有没有我们的条目。
pub fn is_installed(kind: McpClientKind) -> Result<bool, String> {
    let home = home_dir()?;
    let path = kind.config_path(&home);

    let Ok(existing) = fs::read_to_string(&path) else {
        return Ok(false);
    };

    Ok(match kind {
        McpClientKind::Codex => {
            existing.lines().any(|line| line.trim() == format!("[mcp_servers.{SERVER_NAME}]"))
        }
        _ => serde_json::from_str::<serde_json::Value>(&existing)
            .ok()
            .and_then(|root| {
                root.get("mcpServers")
                    .and_then(|servers| servers.get(SERVER_NAME))
                    .cloned()
            })
            .is_some(),
    })
}

/// 构造某个客户端要的条目形状。
///
/// 绝大多数客户端都是标准 `mcpServers[name] = {url, headers}`；
/// Minimax Code 多要几个运行时自己会补的字段，这里一并写上省得它再去改一遍。
fn json_entry(endpoint: &str, token: &str, kind: McpClientKind) -> serde_json::Value {
    let base = serde_json::json!({
        "url": endpoint,
        "headers": { "Authorization": format!("Bearer {token}") },
    });

    if kind != McpClientKind::MinimaxCode {
        return base;
    }

    let mut entry = base.as_object().expect("上面构造的就是对象").clone();
    entry.insert("type".into(), serde_json::json!("http"));
    entry.insert("enabled".into(), serde_json::json!(true));
    serde_json::Value::Object(entry)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_kind_round_trips_through_its_id() {
        for kind in McpClientKind::ALL {
            assert_eq!(McpClientKind::parse(kind.id()), Ok(kind));
        }
    }

    #[test]
    fn unknown_client_id_is_rejected() {
        assert!(McpClientKind::parse("vscode").is_err());
    }

    #[test]
    fn json_merge_creates_the_file_shape_when_absent() {
        let entry = json_entry("http://127.0.0.1:55100/mcp", "tok", McpClientKind::Cursor);
        let out = merge_json_entry("", &entry).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(parsed["mcpServers"]["alpha-file-manager"]["url"], "http://127.0.0.1:55100/mcp");
    }

    #[test]
    fn json_merge_keeps_unrelated_keys() {
        // 用户自己的 server 与其他顶层键都必须原样留下 ——
        // 这是「只合并不重写」承诺的判别性用例。
        let existing = r#"{
  "theme": "dark",
  "mcpServers": {
    "their-server": { "command": "npx" }
  }
}"#;
        let entry = json_entry("http://127.0.0.1:55100/mcp", "tok", McpClientKind::Cursor);
        let parsed: serde_json::Value =
            serde_json::from_str(&merge_json_entry(existing, &entry).unwrap()).unwrap();

        assert_eq!(parsed["theme"], "dark");
        assert_eq!(parsed["mcpServers"]["their-server"]["command"], "npx");
        assert!(parsed["mcpServers"]["alpha-file-manager"].is_object());
    }

    #[test]
    fn json_merge_refuses_to_clobber_unparsable_config() {
        let broken = "{ this is not json";
        let entry = json_entry("u", "t", McpClientKind::Cursor);
        assert!(merge_json_entry(broken, &entry).is_err());
    }

    #[test]
    fn json_merge_refuses_when_mcp_servers_has_the_wrong_shape() {
        let existing = r#"{ "mcpServers": ["not-an-object"] }"#;
        let entry = json_entry("u", "t", McpClientKind::Cursor);
        assert!(merge_json_entry(existing, &entry).is_err());
    }

    #[test]
    fn json_remove_takes_only_our_entry() {
        let existing = r#"{"mcpServers":{"theirs":{"command":"npx"},"alpha-file-manager":{"url":"x"}}}"#;
        let parsed: serde_json::Value =
            serde_json::from_str(&remove_json_entry(existing).unwrap()).unwrap();
        assert!(parsed["mcpServers"].get("alpha-file-manager").is_none());
        assert_eq!(parsed["mcpServers"]["theirs"]["command"], "npx");
    }

    #[test]
    fn toml_merge_appends_without_touching_existing_tables() {
        let existing = "model = \"gpt-5\"\n\n[model_providers.x]\nbase_url = \"https://x\"\n";
        let block = "[mcp_servers.alpha-file-manager]\nurl = \"http://127.0.0.1:55100/mcp\"\n";
        let out = merge_toml_entry(existing, block);

        assert!(out.contains("model = \"gpt-5\""));
        assert!(out.contains("[model_providers.x]"));
        assert!(out.contains("[mcp_servers.alpha-file-manager]"));
    }

    #[test]
    fn toml_merge_replaces_our_table_instead_of_duplicating_it() {
        let existing = "a = 1\n\n[mcp_servers.alpha-file-manager]\nurl = \"http://old\"\n";
        let block = "[mcp_servers.alpha-file-manager]\nurl = \"http://new\"\n";
        let out = merge_toml_entry(existing, block);

        assert_eq!(out.matches("[mcp_servers.alpha-file-manager]").count(), 1);
        assert!(out.contains("http://new"));
        assert!(!out.contains("http://old"));
        assert!(out.contains("a = 1"));
    }

    #[test]
    fn toml_merge_keeps_the_table_that_follows_ours() {
        let existing = concat!(
            "[mcp_servers.alpha-file-manager]\n",
            "url = \"http://old\"\n\n",
            "[mcp_servers.other]\n",
            "url = \"http://keep\"\n"
        );
        let out = merge_toml_entry(existing, "[mcp_servers.alpha-file-manager]\nurl = \"http://new\"\n");

        assert!(out.contains("[mcp_servers.other]"));
        assert!(out.contains("http://keep"));
        assert!(!out.contains("http://old"));
    }

    #[test]
    fn toml_merge_with_empty_block_removes_the_table() {
        let existing = "a = 1\n\n[mcp_servers.alpha-file-manager]\nurl = \"x\"\n";
        let out = merge_toml_entry(existing, "");
        assert!(!out.contains("mcp_servers.alpha-file-manager"));
        assert!(out.contains("a = 1"));
    }

    #[test]
    fn codex_entry_uses_the_static_header_form() {
        // Codex 没有「Bearer 字面量」这一档的稳定文档，http_headers 是
        // 多份来源都给出过的写法。锁死它，防止以后被改回 bearer_token_env_var
        // ——那个字段要求环境里有对应变量，本应用设置不了。
        let entry = merge_toml_entry(
            "",
            &format!(
                "[mcp_servers.{SERVER_NAME}]\nurl = \"http://u\"\nhttp_headers = {{ Authorization = \"Bearer t\" }}\n"
            ),
        );
        assert!(entry.contains("http_headers"));
        assert!(entry.contains("Bearer t"));
        assert!(!entry.contains("bearer_token_env_var"));
    }

    #[test]
    fn minimax_entry_carries_the_extra_runtime_fields() {
        let entry = json_entry("http://u", "t", McpClientKind::MinimaxCode);
        assert_eq!(entry["type"], "http");
        assert_eq!(entry["enabled"], true);
        assert_eq!(entry["headers"]["Authorization"], "Bearer t");
    }

    #[test]
    fn other_clients_do_not_get_minimax_only_fields() {
        let entry = json_entry("http://u", "t", McpClientKind::Cursor);
        assert!(entry.get("type").is_none());
        assert!(entry.get("enabled").is_none());
    }

    #[test]
    fn config_paths_land_where_the_clients_actually_read() {
        let home = PathBuf::from("/fake/home");
        assert_eq!(
            McpClientKind::Codex.config_path(&home),
            PathBuf::from("/fake/home/.codex/config.toml")
        );
        assert_eq!(
            McpClientKind::Cursor.config_path(&home),
            PathBuf::from("/fake/home/.cursor/mcp.json")
        );
        assert_eq!(
            McpClientKind::ClaudeCode.config_path(&home),
            PathBuf::from("/fake/home/.claude.json")
        );
        assert_eq!(
            McpClientKind::OpenClaw.config_path(&home),
            PathBuf::from("/fake/home/.openclaw/config.json")
        );
    }

    #[test]
    fn detection_falls_back_to_the_parent_directory() {
        // 装了但还没写过配置的客户端，配置文件不存在，目录存在 —— 仍应算「已装」。
        let dir = tempdir();
        let home = dir.join("home");
        fs::create_dir_all(home.join(".cursor")).unwrap();
        fs::write(home.join(".cursor").join("state.db"), "x").unwrap();
        assert!(McpClientKind::Cursor.is_detected(&home));
        assert!(!McpClientKind::OpenClaw.is_detected(&home));
    }

    #[test]
    fn an_empty_config_directory_does_not_count_as_installed() {
        // 卸载残留：目录在、里面什么都没有。此前只判目录存在，
        // 会把一个根本没装的 Claude Desktop 显示成「已装」。
        let dir = tempdir();
        let home = dir.join("home");
        fs::create_dir_all(home.join(".openclaw")).unwrap();
        assert!(!McpClientKind::OpenClaw.is_detected(&home));

        // 目录里放进任意一个文件后就算装了 —— 不猜是哪个文件，各客户端都不一样。
        fs::write(home.join(".openclaw").join("config.json"), "{}").unwrap();
        assert!(McpClientKind::OpenClaw.is_detected(&home));
    }

    fn tempdir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "alpha-mcp-clients-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn backup_snapshots_the_original_before_any_write() {
        let dir = tempdir();
        let path = dir.join("mcp.json");
        fs::write(&path, "original").unwrap();

        let backup_path = backup(&path).unwrap().expect("文件存在就该有备份");
        assert_eq!(fs::read_to_string(&backup_path).unwrap(), "original");
    }

    #[test]
    fn backup_is_a_noop_when_there_is_nothing_to_back_up() {
        let dir = tempdir();
        assert!(backup(&dir.join("absent.json")).unwrap().is_none());
    }
}
