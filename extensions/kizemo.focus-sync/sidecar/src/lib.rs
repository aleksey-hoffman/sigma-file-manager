//! Spike library — re-exports for unit testing.
//!
//! See `main.rs` for the binary entry point and
//! `docs/superpowers/specs/2026-09-27-listary-focus-sync-design.md` for full design.
//!
//! **Source attribution** (see `README.md` for full licenses):
//! - `uia_inject.rs` — ported from `inaku-Gyan/PathWrap/src/os/dialog.rs` (MIT)
//! - `uia_event.rs`  — ported from `inaku-Gyan/PathWrap/src/os/monitor.rs` (MIT)
//!
//! `fg_bypass.rs` was removed in round 18 (QwenLM Apache-2.0 attribution
//! preserved in git history via `git log -- sigma-listary-spike/src/fg_bypass.rs`).
//! The wrapper was a Chromium foreground-steal shield that toggled
//! `EnableWindow(FALSE)` around the UIA Invoke — it cost top-level focus on
//! the foreground Sigma FM window, defeating the feature it was meant to
//! protect. PathWrap upstream does not use it; the round-18 spike follows.
//!
//! focus-18 (2026-10-01): re-imported. The wrapper is gated on Chromium host
//! detection (`is_chromium_target_window`), so native IFileDialog / WinUI dialogs
//! fall through unmodified. The wrapper is required to Invoke the Save button
//! on Chromium Save As without Chromium stealing foreground focus.

pub mod config;
pub mod detector;
pub mod events;
pub mod fg_bypass;
pub mod http_server;
pub mod logger;
pub mod reader;
pub mod state;
pub mod uia_event;
pub mod uia_inject;
pub mod writer;