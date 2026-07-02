// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;

use reqwest::Method;

use super::http::{read_response_bytes_with_limit, HttpRetryError, HTTP_USER_AGENT};
use super::security::{authorize_extension_caller, validate_extension_http_url};
use super::types::{
    ExtensionHttpResponsePayload, MAX_EXTENSION_HTTP_RESPONSE_BYTES,
};

const DEFAULT_EXTENSION_HTTP_TIMEOUT_MS: u64 = 30_000;
const MAX_EXTENSION_HTTP_TIMEOUT_MS: u64 = 120_000;

const BLOCKED_REQUEST_HEADERS: &[&str] = &["cookie", "host", "content-length"];

static EXTENSION_HTTP_CLIENT: OnceLock<Result<reqwest::Client, String>> = OnceLock::new();

fn extension_http_client() -> Result<&'static reqwest::Client, String> {
    EXTENSION_HTTP_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .connect_timeout(Duration::from_secs(15))
                .redirect(reqwest::redirect::Policy::limited(5))
                .user_agent(HTTP_USER_AGENT)
                .build()
                .map_err(|error| format!("Failed to create HTTP client: {}", error))
        })
        .as_ref()
        .map_err(|error| error.clone())
}

fn parse_http_method(method: Option<&str>) -> Result<Method, String> {
    match method.unwrap_or("GET").trim().to_ascii_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        "HEAD" => Ok(Method::HEAD),
        unsupported_method => Err(format!("Unsupported HTTP method: {}", unsupported_method)),
    }
}

fn is_blocked_request_header(header_name: &str) -> bool {
    let normalized_name = header_name.trim().to_ascii_lowercase();
    BLOCKED_REQUEST_HEADERS
        .iter()
        .any(|blocked_header| *blocked_header == normalized_name)
}

fn collect_response_headers(response: &reqwest::Response) -> HashMap<String, String> {
    response
        .headers()
        .iter()
        .filter_map(|(header_name, header_value)| {
            header_value
                .to_str()
                .ok()
                .map(|value| (header_name.as_str().to_string(), value.to_string()))
        })
        .collect()
}

fn map_http_retry_error(error: HttpRetryError) -> String {
    error.into_message()
}

pub async fn extension_http_request(
    extension_id: String,
    url: String,
    method: Option<String>,
    headers: Option<HashMap<String, String>>,
    body: Option<Vec<u8>>,
    timeout_ms: Option<u64>,
    allowed_hosts: Option<Vec<String>>,
    caller_extension_id: Option<String>,
) -> Result<ExtensionHttpResponsePayload, String> {
    authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)?;

    let allowed_hosts_ref = allowed_hosts.as_deref();
    let validated_url = validate_extension_http_url(&url, allowed_hosts_ref)?;
    let request_method = parse_http_method(method.as_deref())?;
    let timeout = timeout_ms
        .unwrap_or(DEFAULT_EXTENSION_HTTP_TIMEOUT_MS)
        .clamp(1, MAX_EXTENSION_HTTP_TIMEOUT_MS);

    let client = extension_http_client()?;
    let mut request_builder = client
        .request(request_method, validated_url)
        .timeout(Duration::from_millis(timeout));

    if let Some(request_headers) = headers {
        for (header_name, header_value) in request_headers {
            if is_blocked_request_header(&header_name) {
                return Err(format!("Request header '{}' is not allowed", header_name));
            }

            request_builder = request_builder.header(header_name, header_value);
        }
    }

    if let Some(request_body) = body {
        request_builder = request_builder.body(request_body);
    }

    let response = request_builder
        .send()
        .await
        .map_err(|error| format!("HTTP request failed: {}", error))?;

    validate_extension_http_url(response.url().as_str(), allowed_hosts_ref)?;

    let status = response.status().as_u16();
    let response_headers = collect_response_headers(&response);
    let response_body = read_response_bytes_with_limit(
        response,
        MAX_EXTENSION_HTTP_RESPONSE_BYTES,
        "HTTP response body",
    )
    .await
    .map_err(map_http_retry_error)?;

    Ok(ExtensionHttpResponsePayload {
        ok: (200..300).contains(&status),
        status,
        headers: response_headers,
        body: response_body,
    })
}
