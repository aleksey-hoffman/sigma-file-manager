// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// 用户为接入的 AI agent 开放的权限档位。
///
/// 默认必须是 [`AgentMode::Off`]：MCP 端点默认不监听，
/// 这是「用户没主动同意就什么都不发生」的底线。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub enum AgentMode {
    #[default]
    Off,
    ReadOnly,
    Writable,
    AskEachTime,
}

impl AgentMode {
    pub fn as_str(self) -> &'static str {
        match self {
            AgentMode::Off => "off",
            AgentMode::ReadOnly => "readOnly",
            AgentMode::Writable => "writable",
            AgentMode::AskEachTime => "askEachTime",
        }
    }

    /// 是否允许只读工具。`Off` 档连读都不给。
    pub fn allows_read(self) -> bool {
        !matches!(self, AgentMode::Off)
    }

    /// 是否允许写工具。本批（Phase 1）只交付只读工具，
    /// 但门控先行落地 —— 写工具进 Phase 2 时不必再回头改权限模型。
    #[allow(dead_code)]
    pub fn allows_write(self) -> bool {
        matches!(self, AgentMode::Writable | AgentMode::AskEachTime)
    }

    /// 写操作是否需要逐条人工确认。
    #[allow(dead_code)]
    pub fn requires_write_approval(self) -> bool {
        matches!(self, AgentMode::AskEachTime)
    }
}

impl fmt::Display for AgentMode {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for AgentMode {
    type Err = String;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "off" | "关闭" => Ok(AgentMode::Off),
            "readOnly" | "read_only" | "只读" => Ok(AgentMode::ReadOnly),
            "writable" | "可写" => Ok(AgentMode::Writable),
            "askEachTime" | "ask_each_time" | "每次审批" => Ok(AgentMode::AskEachTime),
            other => Err(format!("未知的 MCP 权限档位: {other}")),
        }
    }
}

/// 拒绝时返回给 agent 的结构化错误体。
///
/// 刻意不是字符串：agent 需要知道「当前是什么档、要用户切到哪一档」
/// 才知道能给出对症的求助，而不是只回一句 permission denied。
pub fn denial_payload(tool_name: &str, required: &str, current: AgentMode) -> serde_json::Value {
    serde_json::json!({
        "error": format!("MCP 权限不足：工具 {tool_name} 需要 {required} 档"),
        "currentMode": current.as_str(),
        "requiredMode": required,
        "hint": "请在 Alpha File Manager 的设置里把 MCP 权限档位调高后重试",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_mode_is_off_and_denies_reads() {
        assert_eq!(AgentMode::default(), AgentMode::Off);
        assert!(!AgentMode::default().allows_read());
        assert!(!AgentMode::default().allows_write());
    }

    #[test]
    fn only_read_only_and_above_allow_reads() {
        assert!(!AgentMode::Off.allows_read());
        assert!(AgentMode::ReadOnly.allows_read());
        assert!(AgentMode::Writable.allows_read());
        assert!(AgentMode::AskEachTime.allows_read());
    }

    #[test]
    fn read_only_never_allows_writes() {
        assert!(!AgentMode::ReadOnly.allows_write());
        assert!(AgentMode::Writable.allows_write());
        assert!(AgentMode::AskEachTime.allows_write());
        assert!(AgentMode::AskEachTime.requires_write_approval());
        assert!(!AgentMode::Writable.requires_write_approval());
    }

    /// 档位要能从设置文件里往返 —— 前端存的是字符串。
    /// 这里逐个断言 `as_str` 的输出能被 `from_str` 读回同一个档，
    /// 否则「界面显示只读、实际按关闭处理」这类偏差不会被任何测试抓到。
    #[test]
    fn mode_round_trips_through_its_stored_string() {
        for mode in [
            AgentMode::Off,
            AgentMode::ReadOnly,
            AgentMode::Writable,
            AgentMode::AskEachTime,
        ] {
            assert_eq!(AgentMode::from_str(mode.as_str()).unwrap(), mode);
        }
    }

    #[test]
    fn unknown_mode_string_is_rejected_rather_than_defaulted() {
        // 静默回落成 Off 会让人以为「刚调好的档位没生效」；
        // 静默回落成可写则直接是安全事故。
        assert!(AgentMode::from_str("writable_typo").is_err());
    }

    #[test]
    fn denial_payload_names_the_tool_and_the_mode_to_switch_to() {
        let payload = denial_payload("search_files", "writable", AgentMode::ReadOnly);
        assert_eq!(payload["currentMode"], "readOnly");
        assert_eq!(payload["requiredMode"], "writable");
        assert!(payload["error"].as_str().unwrap().contains("search_files"));
        assert!(payload["hint"].as_str().unwrap().contains("权限档位"));
    }
}
