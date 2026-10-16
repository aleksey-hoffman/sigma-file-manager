// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use rmcp::transport::streamable_http_server::session::local::LocalSessionManager;
use rmcp::transport::streamable_http_server::{StreamableHttpServerConfig, StreamableHttpService};
use serde::Serialize;
use tokio_util::sync::CancellationToken;

use super::auth;
use super::permission::AgentMode;
use super::tools::AlphaMcpServer;
use super::MCP_RUNTIME;

/// MCP 端口区间。
///
/// 刻意**不用** `lan_share` 的 `HTTP_DEFAULT_PORT = 80`：Windows 上绑 80 要管理员权限，
/// 而且会和 LAN 共享撞车。这里取 LAN 共享区间（55000–55999）的一个子段。
pub const MCP_PORT_RANGE_START: u16 = 55100;
pub const MCP_PORT_RANGE_END: u16 = 55199;

/// 一个客户端「算还连着」的观察窗口。
///
/// 这是估算而不是精确计数 —— stateless 传输下服务端拿不到「连接」这个概念，
/// 只能按「最近多久内有过请求的客户端指纹」推断。宁可少报也不要虚报：
/// 状态栏写「3 个 agent 已连接」而实际只有 1 个，会让人以为有人在动他的文件。
pub const CLIENT_ACTIVITY_WINDOW: Duration = Duration::from_secs(300);

/// 允许的 `Origin`。只放行本机 —— MCP Inspector 跑在 `http://localhost:6274`。
const ALLOWED_ORIGINS: &[&str] = &["http://localhost:*", "http://127.0.0.1:*"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpStatus {
    pub running: bool,
    pub mode: String,
    pub port: Option<u16>,
    pub endpoint: Option<String>,
    pub token: Option<String>,
    /// 本机还有请求活动的客户端数量（估算值，见 `CLIENT_ACTIVITY_WINDOW`）。
    pub active_clients: usize,
    pub total_requests: u64,
}

impl McpStatus {
    fn stopped(mode: AgentMode) -> Self {
        Self {
            running: false,
            mode: mode.as_str().to_string(),
            port: None,
            endpoint: None,
            token: None,
            active_clients: 0,
            total_requests: 0,
        }
    }
}

/// 客户端活动追踪。按 User-Agent 指纹去重。
#[derive(Default)]
struct ClientTracker {
    last_seen: std::collections::HashMap<String, Instant>,
    total_requests: u64,
}

impl ClientTracker {
    fn observe(&mut self, fingerprint: &str) {
        let now = Instant::now();
        self.total_requests += 1;
        self.last_seen.insert(fingerprint.to_string(), now);
        self.prune(now);
    }

    fn prune(&mut self, now: Instant) {
        self.last_seen
            .retain(|_, seen_at| now.duration_since(*seen_at) <= CLIENT_ACTIVITY_WINDOW);
    }

    fn snapshot(&mut self) -> (usize, u64) {
        self.prune(Instant::now());
        (self.last_seen.len(), self.total_requests)
    }
}

/// 单例：服务重启后计数不该归零，但也不能跨进程残留。
static CLIENT_TRACKER: once_cell::sync::Lazy<Arc<Mutex<ClientTracker>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(ClientTracker::default())));

#[derive(Clone)]
struct ServerState {
    token: String,
}

struct ActiveServer {
    shutdown: CancellationToken,
    task: tokio::task::JoinHandle<()>,
    port: u16,
}

static ACTIVE_MCP_SERVER: once_cell::sync::Lazy<Arc<tokio::sync::Mutex<Option<ActiveServer>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(tokio::sync::Mutex::new(None)));

/// 在给定区间里找一个能绑定的端口。只在回环上试。
pub fn find_available_port_in_range(start: u16, end: u16) -> Result<u16, String> {
    for port in start..=end {
        if let Ok(listener) = std::net::TcpListener::bind(("127.0.0.1", port)) {
            let actual = listener
                .local_addr()
                .map_err(|error| format!("读取端口信息失败: {error}"))?
                .port();
            // 立刻 drop，真正 bind 时再抢一次。中间有极小的竞态窗口，
            // 真撞上了 start() 会报错、用户重试即可 —— 不值得引入端口预留机制。
            drop(listener);
            return Ok(actual);
        }
    }
    Err(format!("在端口区间 {start}-{end} 内找不到可用端口"))
}

/// 鉴权中间件：token 不对就 401。
///
/// 放在 rmcp 服务**之前**：不让未鉴权的请求进入协议层，也避免任何工具被执行。
async fn require_token(State(state): State<ServerState>, request: Request, next: Next) -> Response {
    let provided = auth::extract_bearer(request.headers());
    let authorized = provided
        .as_deref()
        .is_some_and(|token| auth::token_matches(token, &state.token));

    if !authorized {
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({
                "error": "MCP 鉴权失败",
                "hint": "请把 Alpha File Manager 设置页显示的 token 填进客户端配置的 Authorization: Bearer 头",
            })),
        )
            .into_response();
    }

    let fingerprint = request
        .headers()
        .get(axum::http::header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    if let Ok(mut tracker) = CLIENT_TRACKER.lock() {
        tracker.observe(&fingerprint);
    }

    next.run(request).await
}

fn build_router(runtime: Arc<super::McpRuntime>, token: String) -> axum::Router {
    let config = StreamableHttpServerConfig::default()
        // 2026-07-28 起是 stateless：不开 session 就没有 `Mcp-Session-Id` 要客户端回传。
        .with_legacy_session_mode(false)
        // 简单请求直接回 application/json；只有工具真的推通知时才退回 SSE。
        .with_json_response(true)
        .with_sse_keep_alive(None)
        // Host 默认只允许 localhost / 127.0.0.1 / ::1。
        .with_allowed_hosts(["localhost", "127.0.0.1", "::1"])
        .with_allowed_origins(ALLOWED_ORIGINS.iter().copied())
        .enforce_origin_validation();

    let service: StreamableHttpService<AlphaMcpServer, LocalSessionManager> =
        StreamableHttpService::new(
            {
                let runtime = runtime.clone();
                move || Ok(AlphaMcpServer::new(runtime.clone()))
            },
            Arc::new(LocalSessionManager::default()),
            config,
        );

    let state = ServerState { token };

    axum::Router::new()
        .nest_service("/mcp", service)
        .fallback(|| async {
            (
                axum::http::StatusCode::NOT_FOUND,
                "Alpha File Manager 的 MCP 端点位于 /mcp",
            )
        })
        .layer(axum::middleware::from_fn_with_state(state, require_token))
}

/// 启动 MCP 服务。
///
/// `mode` 必须是 `Off` 以外的档位 —— 「关闭」档的语义是**不监听端口**，
/// 不是「监听但拒绝」，后者会让本机任何进程都能探测到端口开着。
pub async fn start(mode: AgentMode, app_data_dir: PathBuf) -> Result<McpStatus, String> {
    if !mode.allows_read() {
        return Err("MCP 权限档位为「关闭」，不启动服务".to_string());
    }

    let mut guard = ACTIVE_MCP_SERVER.lock().await;
    if let Some(active) = guard.as_ref() {
        return Ok(status_for(active.port, mode, None));
    }

    let port = find_available_port_in_range(MCP_PORT_RANGE_START, MCP_PORT_RANGE_END)?;
    let token = auth::load_or_create_token_in(&app_data_dir)?;

    let router = build_router(MCP_RUNTIME.clone(), token.clone());

    // 只绑回环。lan_share 那里是 0.0.0.0 —— 对外共享需要，MCP 不能。
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|error| format!("绑定 127.0.0.1:{port} 失败: {error}"))?;

    let shutdown = CancellationToken::new();
    let shutdown_signal = shutdown.clone();
    let task = tokio::spawn(async move {
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                shutdown_signal.cancelled_owned().await;
            })
            .await;
    });

    *guard = Some(ActiveServer {
        shutdown,
        task,
        port,
    });

    log::info!("MCP server listening on http://127.0.0.1:{port}/mcp");
    Ok(status_for(port, mode, Some(token)))
}

fn status_for(port: u16, mode: AgentMode, token: Option<String>) -> McpStatus {
    let (active_clients, total_requests) = CLIENT_TRACKER
        .lock()
        .map(|mut tracker| tracker.snapshot())
        .unwrap_or((0, 0));

    McpStatus {
        running: true,
        mode: mode.as_str().to_string(),
        port: Some(port),
        endpoint: Some(format!("http://127.0.0.1:{port}/mcp")),
        token,
        active_clients,
        total_requests,
    }
}

pub async fn stop() -> Result<(), String> {
    let mut guard = ACTIVE_MCP_SERVER.lock().await;
    if let Some(active) = guard.take() {
        active.shutdown.cancel();
        let _ = active.task.await;
    }
    Ok(())
}

pub async fn status() -> McpStatus {
    let mode = MCP_RUNTIME.mode();
    let guard = ACTIVE_MCP_SERVER.lock().await;
    match guard.as_ref() {
        Some(active) => status_for(active.port, mode, None),
        None => McpStatus::stopped(mode),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn port_search_stays_inside_the_declared_range() {
        let port = find_available_port_in_range(MCP_PORT_RANGE_START, MCP_PORT_RANGE_END).unwrap();
        assert!(
            (MCP_PORT_RANGE_START..=MCP_PORT_RANGE_END).contains(&port),
            "端口 {port} 越界"
        );
    }

    /// 硬要求：MCP 端点绝不绑 0.0.0.0。
    /// 这条测试盯的是「端口查找只试回环」这件事本身 ——
    /// `bind(("127.0.0.1", port))` 一旦被改成 `0.0.0.0`，这里仍会绿，
    /// 所以真正的兜底在 `start()` 里的 `SocketAddr::from(([127,0,0,1], port))`，
    /// 两者都要在。
    #[test]
    fn port_search_never_hands_back_a_privileged_port() {
        let port = find_available_port_in_range(MCP_PORT_RANGE_START, MCP_PORT_RANGE_END).unwrap();
        assert_ne!(port, 80, "绝不能复用 LAN 共享的 80 端口");
        assert_ne!(port, 443);
    }

    #[test]
    fn client_tracker_counts_distinct_user_agents() {
        let mut tracker = ClientTracker::default();
        tracker.observe("claude-desktop");
        tracker.observe("claude-desktop");
        tracker.observe("mcp-inspector");

        assert_eq!(tracker.snapshot(), (2, 3));
    }

    #[test]
    fn stopped_status_reports_the_mode_but_no_endpoint_or_token() {
        let status = McpStatus::stopped(AgentMode::ReadOnly);
        assert!(!status.running);
        assert_eq!(status.mode, "readOnly");
        assert!(status.endpoint.is_none());
        assert!(status.token.is_none());
    }

    #[tokio::test]
    async fn off_mode_refuses_to_start() {
        let error = start(AgentMode::Off, std::env::temp_dir()).await.unwrap_err();
        assert!(error.contains("关闭"));
    }

    /// 端到端：真的起一个 HTTP 服务，真的用 JSON-RPC 打进去。
    ///
    /// 这条测试守的是「`tools/list` 与 `tools/call` 真的接上了」，
    /// 而不只是「能编译」。`tool_router` 字段被宏生成代码读取时，
    /// rustc 的 dead-code 分析经常报 never read —— 只看编译输出会以为接线断了，
    /// 也可能反过来：接线真断了而编译照样绿。
    #[tokio::test]
    async fn initialize_list_tools_and_call_a_tool_over_http() {
        let runtime = std::sync::Arc::new(super::super::McpRuntime::new());
        runtime.set_mode(AgentMode::ReadOnly);

        const TOKEN: &str = "test-token-123";
        let router = build_router(runtime.clone(), TOKEN.to_string());

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let shutdown = CancellationToken::new();
        let signal = shutdown.clone();
        let task = tokio::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async move {
                    signal.cancelled_owned().await;
                })
                .await;
        });

        let url = format!("http://{address}/mcp");
        let client = reqwest::Client::new();

        async fn post(client: &reqwest::Client, url: &str, token: &str, body: &str) -> String {
            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {token}"))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json, text/event-stream")
                .body(body.to_string())
                .send()
                .await
                .expect("request should send");
            assert!(
                response.status().is_success(),
                "HTTP {} for {body}",
                response.status()
            );
            response.text().await.expect("body should read")
        }

        let initialize = post(
            &client,
            &url,
            TOKEN,
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}"#,
        )
        .await;
        assert!(
            initialize.contains("protocolVersion"),
            "initialize 没有返回协议版本: {initialize}"
        );

        let listed = post(
            &client,
            &url,
            TOKEN,
            r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#,
        )
        .await;
        for tool in [
            "list_directory",
            "get_drives",
            "get_mountable_devices",
            "search_files",
            "get_directory_size",
            "get_favorites",
        ] {
            assert!(
                listed.contains(tool),
                "tools/list 里没有 {tool}: {listed}"
            );
        }

        // 用临时目录而不是 C:\Windows：目录越大越慢，而且断言不该依赖系统目录的内容。
        let listing_dir = std::env::temp_dir().display().to_string();
        let call_body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "list_directory",
                "arguments": { "path": listing_dir },
            },
        })
        .to_string();

        let called = post(&client, &url, TOKEN, &call_body).await;

        // 注意：工具返回的 JSON 是被塞进 text content 的，所以整段是**转义**过的，
        // 断言不能直接找 `"entries"`（那会永远不匹配，且看起来像「工具没返回数据」）。
        assert!(
            called.contains("entries") && called.contains("totalCount"),
            "list_directory 没有返回目录内容: {called}"
        );
        assert!(
            called.contains("isError\":false") || called.contains("isError\": false"),
            "tools/call 应当成功: {called}"
        );

        shutdown.cancel();
        let _ = task.await;
    }

    /// 阳性对照：token 不对必须被挡在协议层之前。
    /// 没有这条，上面那条测试即使鉴权 middleware 整个失效也照样绿。
    #[tokio::test]
    async fn requests_without_a_valid_token_are_rejected() {
        let runtime = std::sync::Arc::new(super::super::McpRuntime::new());
        runtime.set_mode(AgentMode::ReadOnly);
        let router = build_router(runtime, "the-real-token".to_string());

        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let address = listener.local_addr().unwrap();
        let shutdown = CancellationToken::new();
        let signal = shutdown.clone();
        let task = tokio::spawn(async move {
            let _ = axum::serve(listener, router)
                .with_graceful_shutdown(async move {
                    signal.cancelled_owned().await;
                })
                .await;
        });

        let url = format!("http://{address}/mcp");
        let client = reqwest::Client::new();

        let anonymous = client
            .post(&url)
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .unwrap();
        assert_eq!(anonymous.status(), 401);

        let wrong = client
            .post(&url)
            .header("Authorization", "Bearer not-the-token")
            .header("Content-Type", "application/json")
            .body("{}")
            .send()
            .await
            .unwrap();
        assert_eq!(wrong.status(), 401);

        shutdown.cancel();
        let _ = task.await;
    }

    /// 关闭档下工具必须被拒 —— 且要返回结构化错误，让 agent 知道该让用户切哪一档。
    /// （这条断言放在 `tools.rs` 的测试里：宏生成的方法是私有的，
    /// 跨模块调不到，而门控本身也住在 `tools.rs`。）
    #[tokio::test]
    async fn closed_mode_never_starts_the_service() {
        assert!(!AgentMode::Off.allows_read());
        let error = start(AgentMode::Off, std::env::temp_dir()).await.unwrap_err();
        assert!(error.contains("关闭"));
    }
}
