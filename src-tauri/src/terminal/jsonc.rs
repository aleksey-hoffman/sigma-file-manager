// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

pub(super) fn parse_jsonc(input: &str) -> Option<serde_json::Value> {
    if let Ok(value) = serde_json::from_str(input) {
        return Some(value);
    }

    let cleaned = strip_jsonc(input);
    serde_json::from_str(&cleaned).ok()
}

fn strip_jsonc(input: &str) -> String {
    let chars: Vec<char> = input.chars().collect();
    let len = chars.len();
    let mut result = String::with_capacity(len);
    let mut idx = 0;
    let mut in_string = false;

    while idx < len {
        if in_string {
            result.push(chars[idx]);
            if chars[idx] == '\\' && idx + 1 < len {
                result.push(chars[idx + 1]);
                idx += 2;
                continue;
            }
            if chars[idx] == '"' {
                in_string = false;
            }
            idx += 1;
        } else if chars[idx] == '"' {
            in_string = true;
            result.push(chars[idx]);
            idx += 1;
        } else if chars[idx] == '/' && idx + 1 < len && chars[idx + 1] == '/' {
            idx += 2;
            while idx < len && chars[idx] != '\n' {
                idx += 1;
            }
        } else if chars[idx] == '/' && idx + 1 < len && chars[idx + 1] == '*' {
            idx += 2;
            while idx + 1 < len && !(chars[idx] == '*' && chars[idx + 1] == '/') {
                idx += 1;
            }
            if idx + 1 < len {
                idx += 2;
            }
        } else if chars[idx] == ',' {
            let mut lookahead = idx + 1;
            while lookahead < len && chars[lookahead].is_whitespace() {
                lookahead += 1;
            }
            if lookahead < len && (chars[lookahead] == ']' || chars[lookahead] == '}') {
                idx += 1;
            } else {
                result.push(chars[idx]);
                idx += 1;
            }
        } else {
            result.push(chars[idx]);
            idx += 1;
        }
    }

    result
}
