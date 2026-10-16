// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

//! MCP 只读工具集（第一批）。
//!
//! **每个工具都是既有 command 的薄封装**，不重写业务逻辑：
//! 列目录走 `dir_reader::read_dir`，搜索走 `global_search`，大小走 `dir_size`。
//! 这样 agent 看到的语义与人在界面上看到的一致，
//! 批 5 修的递归搜索、拼写容错、忽略规则全部自动继承。
//!
//! 每一次调用都会（1）重查权限档位、（2）写一条审计。
//! 这两件事刻意写在工具体内而不是连接建立时 —— 用户随时可能改档，
//! 「连接时查一次」意味着改档对已经连着的 agent 不生效。

use std::sync::Arc;

use rmcp::handler::server::{router::tool::ToolRouter, wrapper::Parameters};
use rmcp::model::{ServerCapabilities, ServerConfig};
use rmcp::{schemars, tool, tool_handler, tool_router, ErrorData, ServerHandler};
use serde::{Deserialize, Serialize};

use super::audit::AuditOutcome;
use super::permission::{denial_payload, AgentMode};
use super::McpRuntime;

/// 单次列目录最多返回多少条。超出会显式告诉 agent 被截断了 ——
/// 静默截断会让 agent 误以为那就是全部。
pub const LIST_DIRECTORY_MAX_ENTRIES: usize = 2000;

/// 目录内递归搜索的默认深度，与 `src/stores/schemas/user-settings.ts`
/// 的 `DEFAULT_SCAN_DEPTH` 保持一致（该常量目前只在前端有）。
pub const SEARCH_DEFAULT_DEPTH: u32 = 9;

/// 单次搜索最多返回多少条结果。
pub const SEARCH_MAX_RESULTS: usize = 500;

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct ListDirectoryRequest {
    /// 要列出的目录的绝对路径，例如 `D:\photos`。
    pub path: String,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct SearchFilesRequest {
    /// 搜索词。短查询（如 `095`）同样支持子串命中。
    pub query: String,
    /// 限定在某棵子树下搜。不填则走全局索引。
    pub directory: Option<String>,
    /// 是否返回文件（默认 true）。
    #[serde(default = "default_true")]
    pub include_files: bool,
    /// 是否返回目录（默认 true）。
    #[serde(default = "default_true")]
    pub include_directories: bool,
    /// 精确匹配：关闭时开启拼写容错，容错阈值 0.7。
    #[serde(default)]
    pub typo_tolerance: bool,
    /// 精确匹配模式。
    #[serde(default)]
    pub exact_match: bool,
    /// 最多返回多少条，默认 50，上限 500。
    #[serde(default)]
    pub result_limit: Option<u32>,
}

#[derive(Debug, Deserialize, schemars::JsonSchema)]
pub struct GetDirectorySizeRequest {
    /// 要计算大小的目录绝对路径。结果带缓存。
    pub path: String,
}

fn default_true() -> bool {
    true
}

pub fn clamp_result_limit(requested: Option<u32>) -> usize {
    match requested {
        None => 50,
        Some(0) => 1,
        Some(value) => (value as usize).min(SEARCH_MAX_RESULTS),
    }
}

#[derive(Clone)]
pub struct AlphaMcpServer {
    tool_router: ToolRouter<Self>,
    runtime: Arc<McpRuntime>,
}

impl AlphaMcpServer {
    pub fn new(runtime: Arc<McpRuntime>) -> Self {
        Self {
            tool_router: Self::tool_router(),
            runtime,
        }
    }

    /// 每次调用都重查当前档位，而不是连接时查一次。
    fn current_mode(&self) -> AgentMode {
        self.runtime.mode()
    }

    fn require_read(&self, tool_name: &str) -> Result<AgentMode, ErrorData> {
        let mode = self.current_mode();
        if mode.allows_read() {
            return Ok(mode);
        }

        self.runtime
            .audit()
            .record(tool_name, "", AuditOutcome::Denied, None);

        Err(ErrorData::invalid_params(
            serde_json::to_string(&denial_payload(tool_name, "readOnly", mode))
                .unwrap_or_else(|_| "MCP 权限不足".to_string()),
            None,
        ))
    }

    fn record(&self, tool_name: &str, summary: impl Into<String>, outcome: AuditOutcome, detail: Option<String>) {
        self.runtime.audit().record(tool_name, summary, outcome, detail);
    }

    fn ok_json(&self, tool_name: &str, summary: impl Into<String>, payload: serde_json::Value) -> String {
        self.record(tool_name, summary, AuditOutcome::Allowed, None);
        payload.to_string()
    }

    fn fail_json(&self, tool_name: &str, summary: impl Into<String>, message: impl Into<String>) -> ErrorData {
        let message = message.into();
        self.record(
            tool_name,
            summary,
            AuditOutcome::Error,
            Some(message.clone()),
        );
        ErrorData::internal_error(message, None)
    }

    /// 全局搜索的索引目录。没拿到说明应用还没完成启动。
    fn require_index_base_dir(&self) -> Result<std::path::PathBuf, ErrorData> {
        self.runtime.index_base_dir().ok_or_else(|| {
            ErrorData::internal_error(
                "Alpha File Manager 正在启动，MCP 工具暂不可用，请稍后重试".to_string(),
                None,
            )
        })
    }
}

#[tool_router]
impl AlphaMcpServer {
    #[tool(description = "列出目录内容。返回名称、路径、是否目录、字节大小与修改时间。")]
    async fn list_directory(
        &self,
        Parameters(request): Parameters<ListDirectoryRequest>,
    ) -> Result<String, ErrorData> {
        self.require_read("list_directory")?;

        let path = request.path.trim().to_string();
        if path.is_empty() {
            return Err(self.fail_json("list_directory", "", "path 不能为空"));
        }

        let request_path = path.clone();
        let contents = tokio::task::spawn_blocking(move || {
            crate::dir_reader::read_dir_blocking(request_path, None)
        })
        .await
        .map_err(|error| self.fail_json("list_directory", path.clone(), format!("任务失败: {error}")))?
        .map_err(|error| self.fail_json("list_directory", path.clone(), error))?;

        let truncated = contents.entries.len() > LIST_DIRECTORY_MAX_ENTRIES;
        let entries: Vec<serde_json::Value> = contents
            .entries
            .iter()
            .take(LIST_DIRECTORY_MAX_ENTRIES)
            .map(|entry| {
                serde_json::json!({
                    "name": entry.name,
                    "path": entry.path,
                    "isDir": entry.is_dir,
                    "isFile": entry.is_file,
                    "isHidden": entry.is_hidden,
                    "size": entry.size,
                    "modifiedTime": entry.modified_time,
                    "ext": entry.ext,
                    "itemCount": entry.item_count,
                })
            })
            .collect();

        let payload = serde_json::json!({
            "path": contents.path,
            "totalCount": contents.total_count,
            "dirCount": contents.dir_count,
            "fileCount": contents.file_count,
            "truncated": truncated,
            "returnedCount": entries.len(),
            "entries": entries,
        });

        Ok(self.ok_json("list_directory", path, payload))
    }

    #[tool(description = "列出本机盘符，含卷标、文件系统、容量与可用空间。")]
    async fn get_drives(&self) -> Result<String, ErrorData> {
        self.require_read("get_drives")?;

        let drives = tokio::task::spawn_blocking(crate::dir_reader::get_system_drives_blocking)
            .await
            .map_err(|error| self.fail_json("get_drives", "", format!("任务失败: {error}")))?
            .map_err(|error| self.fail_json("get_drives", "", error))?;

        let payload: Vec<serde_json::Value> = drives
            .iter()
            .map(|drive| {
                serde_json::json!({
                    "name": drive.name,
                    "path": drive.path,
                    "mountPoint": drive.mount_point,
                    "fileSystem": drive.file_system,
                    "driveType": drive.drive_type,
                    "totalSpace": drive.total_space,
                    "availableSpace": drive.available_space,
                    "usedSpace": drive.used_space,
                    "percentUsed": drive.percent_used,
                    "isRemovable": drive.is_removable,
                    "isMounted": drive.is_mounted,
                })
            })
            .collect();

        Ok(self.ok_json("get_drives", "", serde_json::json!(payload)))
    }

    #[tool(description = "列出可挂载设备（移动硬盘、光盘、可移动卷）。")]
    async fn get_mountable_devices(&self) -> Result<String, ErrorData> {
        self.require_read("get_mountable_devices")?;

        let devices = crate::dir_reader::get_mountable_devices()
            .map_err(|error| self.fail_json("get_mountable_devices", "", error))?;

        let payload: Vec<serde_json::Value> = devices
            .iter()
            .map(|device| {
                serde_json::json!({
                    "name": device.name,
                    "devicePath": device.device_path,
                    "fileSystem": device.file_system,
                    "size": device.size,
                })
            })
            .collect();

        Ok(self.ok_json("get_mountable_devices", "", serde_json::json!(payload)))
    }

    /// Alpha 的核心差异化工具：已建索引的全局搜索，带拼写容错与排除规则。
    /// 指定 `directory` 时改走目录内递归扫描（深度 9 层）。
    #[tool(
        description = "按文件名搜索文件。默认走已建索引的全局搜索（带拼写容错与排除规则）；\
                       指定 directory 时在该目录子树内递归搜索（默认 9 层）。"
    )]
    async fn search_files(
        &self,
        Parameters(request): Parameters<SearchFilesRequest>,
    ) -> Result<String, ErrorData> {
        self.require_read("search_files")?;

        let query = request.query.trim().to_string();
        if query.is_empty() {
            return Err(self.fail_json("search_files", "", "query 不能为空"));
        }

        let limit = clamp_result_limit(request.result_limit);
        let index_base_dir = self.require_index_base_dir()?;

        // 先把要用到的字段全部取出来：下面的闭包要 move 它们，
        // 而 `request.directory` 的借用还活到 match 结束。
        let directory = request
            .directory
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string);
        let typo_tolerance = request.typo_tolerance;
        let include_files = request.include_files;
        let include_directories = request.include_directories;
        let exact_match = request.exact_match;

        let results = match directory.clone() {
            Some(directory) => {
                let search_query = query.clone();
                tokio::task::spawn_blocking(move || {
                    crate::global_search::search_directory_recursive_blocking(
                        directory,
                        search_query,
                        SEARCH_DEFAULT_DEPTH,
                        limit as u32,
                        typo_tolerance,
                    )
                })
                .await
            }
            None => {
                let options = crate::global_search::GlobalSearchQueryOptions {
                    limit,
                    include_files,
                    include_directories,
                    exact_match,
                    typo_tolerance,
                    min_score_threshold: None,
                };
                let search_query = query.clone();
                tokio::task::spawn_blocking(move || {
                    crate::global_search::global_search_query_blocking(
                        index_base_dir,
                        search_query,
                        options,
                    )
                })
                .await
            }
        }
        .map_err(|error| self.fail_json("search_files", query.clone(), format!("任务失败: {error}")))?
        .map_err(|error| self.fail_json("search_files", query.clone(), error))?;

        let scope = directory.clone().unwrap_or_else(|| "<全局索引>".to_string());
        let payload = serde_json::json!({
            "query": query,
            "scope": scope,
            "count": results.len(),
            "results": results
                .iter()
                .take(limit)
                .map(|entry| serde_json::json!({
                    "name": entry.name,
                    "path": entry.path,
                    "isDir": entry.is_dir,
                    "size": entry.size,
                    "modifiedTime": entry.modified_time,
                    "score": entry.score,
                }))
                .collect::<Vec<_>>(),
        });

        Ok(self.ok_json("search_files", format!("{scope} :: {query}"), payload))
    }

    #[tool(description = "计算目录总大小，返回字节数与文件/子目录数量。结果带缓存。")]
    async fn get_directory_size(
        &self,
        Parameters(request): Parameters<GetDirectorySizeRequest>,
    ) -> Result<String, ErrorData> {
        self.require_read("get_directory_size")?;

        let path = request.path.trim().to_string();
        if path.is_empty() {
            return Err(self.fail_json("get_directory_size", "", "path 不能为空"));
        }

        // 有上限：整盘统计可能跑很久，而 agent 不该无限期挂住一个调用。
        let result = crate::dir_size::get_dir_size(path.clone(), Some(120_000)).await;

        let payload = serde_json::json!({
            "path": result.path,
            "size": result.size,
            "status": result.status,
            "fileCount": result.file_count,
            "dirCount": result.dir_count,
            "error": result.error,
            "timedOut": result.status == crate::dir_size::SizeStatus::Error && result.size == 0,
        });

        Ok(self.ok_json("get_directory_size", path, payload))
    }

    #[tool(description = "读取用户在 Alpha 里建立的收藏分类及其条目。")]
    async fn get_favorites(&self) -> Result<String, ErrorData> {
        self.require_read("get_favorites")?;

        let categories = self.runtime.favorites();
        let summary = format!("{} 个分类", categories.len());

        let payload: Vec<serde_json::Value> = categories
            .iter()
            .map(|category| {
                serde_json::json!({
                    "id": category.id,
                    "name": category.name,
                    "items": category.items,
                    "itemCount": category.items.len(),
                })
            })
            .collect();

        Ok(self.ok_json("get_favorites", summary, serde_json::json!(payload)))
    }
}

/// `#[tool_handler]` 是必须的：它把上面 `#[tool_router]` 收集到的工具挂进
/// `list_tools` / `call_tool`。少了它，编译照过、单测照跑，
/// 只有 `tools/list` 会返回 `{"tools":[]}` —— 一个工具都调不到。
#[tool_handler]
impl ServerHandler for AlphaMcpServer {
    fn get_info(&self) -> ServerConfig {
        ServerConfig::new(ServerCapabilities::builder().enable_tools().build()).with_instructions(
            "Alpha File Manager 的本地只读工具集。列目录、盘符、可挂载设备、\
             已建索引的全局搜索（带拼写容错与排除规则）、目录大小、收藏分类。\
             所有工具均为只读，不会修改任何文件。",
        )
    }
}

/// 收藏分类。数据由前端在 user-stats 载入后推给 Rust ——
/// 用户可以自定义数据目录，Rust 侧自己拼路径会读错文件。
///
/// `items` 是「归到该分类下的收藏路径」，由前端从扁平的 `favorites` +
/// `categoryId` 拼出来。Rust 侧不还原这套结构：MCP 工具只需要一份
/// 「分类 → 路径列表」的只读视图，重建归属关系没有意义。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FavoriteCategory {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub items: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn result_limit_is_clamped_into_a_sane_range() {
        assert_eq!(clamp_result_limit(None), 50);
        assert_eq!(clamp_result_limit(Some(0)), 1);
        assert_eq!(clamp_result_limit(Some(20)), 20);
        assert_eq!(clamp_result_limit(Some(10_000)), SEARCH_MAX_RESULTS);
    }

    #[test]
    fn search_request_defaults_include_both_files_and_directories() {
        let request: SearchFilesRequest = serde_json::from_str(r#"{"query":"095"}"#).unwrap();
        assert!(request.include_files);
        assert!(request.include_directories);
        assert!(!request.typo_tolerance);
        assert!(!request.exact_match);
        assert!(request.directory.is_none());
    }

    #[test]
    fn list_directory_request_parses_a_windows_path() {
        let request: ListDirectoryRequest =
            serde_json::from_str(r#"{"path":"D:\\photos"}"#).unwrap();
        assert_eq!(request.path, r"D:\photos");
    }

    fn server_in_mode(mode: AgentMode) -> AlphaMcpServer {
        let runtime = Arc::new(super::McpRuntime::new());
        runtime.set_mode(mode);
        AlphaMcpServer::new(runtime)
    }

    /// 关闭档下工具必须被拒，且拒绝信息必须是结构化的 ——
    /// agent 要能据此让用户去切档，而不是只拿到一句 permission denied。
    #[tokio::test]
    async fn closed_mode_denies_tool_calls_with_a_structured_error() {
        let server = server_in_mode(AgentMode::Off);

        let error = server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "C:\\Windows".to_string(),
            }))
            .await
            .expect_err("关闭档必须拒绝工具调用");

        let message = error.message.to_string();
        assert!(
            message.contains("currentMode") && message.contains("\"off\""),
            "拒绝信息必须带出当前档位: {message}"
        );
        assert!(
            message.contains("list_directory") && message.contains("readOnly"),
            "拒绝信息必须带出是哪个工具、要切到哪一档: {message}"
        );
    }

    /// 阳性对照：只读档放行。少了这条，上面那条可能只是「工具压根不通」，
    /// 而不是「门控起作用」。
    #[tokio::test]
    async fn read_only_mode_lets_a_real_listing_through() {
        let server = server_in_mode(AgentMode::ReadOnly);

        let listed = server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "C:\\Windows".to_string(),
            }))
            .await
            .expect("只读档应放行列目录");

        assert!(listed.contains("\"entries\""));
        assert!(listed.contains("totalCount"));
    }

    /// 每次调用都重查档位：同一个 server 实例，中途关档后必须立刻被拒。
    /// 「连接时查一次」的实现方式在这里会红。
    #[tokio::test]
    async fn turning_the_mode_off_takes_effect_on_the_next_call() {
        let runtime = Arc::new(super::McpRuntime::new());
        runtime.set_mode(AgentMode::ReadOnly);
        let server = AlphaMcpServer::new(runtime.clone());

        server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "C:\\Windows".to_string(),
            }))
            .await
            .expect("第一次应当放行");

        runtime.set_mode(AgentMode::Off);

        server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "C:\\Windows".to_string(),
            }))
            .await
            .expect_err("关档后下一次调用必须被拒");
    }

    /// 大目录必须显式告诉调用方「被截断了」。
    /// 静默截断会让 agent 以为那就是全部，然后得出「目录里只有这几个文件」的结论。
    #[tokio::test]
    async fn large_directory_listings_are_marked_as_truncated() {
        let server = server_in_mode(AgentMode::ReadOnly);

        let listed = server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "C:\\Windows".to_string(),
            }))
            .await
            .expect("只读档应放行列目录");

        let payload: serde_json::Value = serde_json::from_str(&listed).unwrap();
        assert!(payload.get("truncated").is_some());
        assert!(payload.get("returnedCount").is_some());
        assert!(payload["returnedCount"].as_u64().unwrap() as usize <= LIST_DIRECTORY_MAX_ENTRIES);
    }

    #[tokio::test]
    async fn empty_path_is_rejected_before_touching_the_filesystem() {
        let server = server_in_mode(AgentMode::ReadOnly);

        let error = server
            .list_directory(Parameters(ListDirectoryRequest {
                path: "   ".to_string(),
            }))
            .await
            .expect_err("空路径必须被拒");

        assert!(error.message.to_string().contains("path"));
    }

    #[tokio::test]
    async fn favorites_are_served_from_the_synced_snapshot() {
        let runtime = Arc::new(super::McpRuntime::new());
        runtime.set_mode(AgentMode::ReadOnly);
        runtime.set_favorites(vec![FavoriteCategory {
            id: "photos".into(),
            name: "照片".into(),
            
            items: vec!["D:\\photos\\a.jpg".into()],
        }]);
        let server = AlphaMcpServer::new(runtime);

        let favorites = server.get_favorites().await.unwrap();

        assert!(favorites.contains("照片"));
        assert!(favorites.contains("a.jpg"));
    }

    #[tokio::test]
    async fn drives_are_listed_without_an_app_handle() {
        let server = server_in_mode(AgentMode::ReadOnly);

        let drives = server.get_drives().await.unwrap();

        // 内容随机器而变，只断言它是合法 JSON 且是个数组。
        let parsed: serde_json::Value = serde_json::from_str(&drives).unwrap();
        assert!(parsed.is_array(), "盘符列表应是数组: {drives}");
    }

    /// 搜索工具在 spike（无 AppHandle）下必须给出明确报错，
    /// 而不是 panic 或返回一个空数组冒充「没搜到」。
    #[tokio::test]
    async fn search_without_an_app_handle_fails_loudly() {
        let server = server_in_mode(AgentMode::ReadOnly);

        let error = server
            .search_files(Parameters(SearchFilesRequest {
                query: "095".into(),
                directory: None,
                include_files: true,
                include_directories: true,
                typo_tolerance: false,
                exact_match: false,
                result_limit: None,
            }))
            .await
            .expect_err("没有 AppHandle 时搜索必须失败");

        assert!(error.message.to_string().contains("启动"));
    }
}
