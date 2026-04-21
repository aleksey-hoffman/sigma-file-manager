// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::process::{Command, ExitStatus, Stdio};
use std::time::{Duration, Instant};

#[derive(Debug)]
#[allow(dead_code)]
pub enum ProcessRunError {
    SpawnFailed(std::io::Error),
    WaitFailed(std::io::Error),
    TimedOut(Duration),
}

pub struct ProcessRunOutput {
    pub stdout: Vec<u8>,
    pub status: ExitStatus,
}

impl ProcessRunOutput {
    pub fn is_success(&self) -> bool {
        self.status.success()
    }
}

const POLL_INTERVAL: Duration = Duration::from_millis(20);

pub fn run_command_blocking(
    program: &str,
    args: &[&str],
    timeout: Duration,
) -> Result<ProcessRunOutput, ProcessRunError> {
    let mut command = Command::new(program);
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn().map_err(ProcessRunError::SpawnFailed)?;
    let deadline = Instant::now() + timeout;

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => break,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(ProcessRunError::TimedOut(timeout));
                }
                std::thread::sleep(POLL_INTERVAL);
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ProcessRunError::WaitFailed(error));
            }
        }
    }

    let output = child
        .wait_with_output()
        .map_err(ProcessRunError::WaitFailed)?;
    Ok(ProcessRunOutput {
        stdout: output.stdout,
        status: output.status,
    })
}

pub fn command_succeeds(program: &str, args: &[&str], timeout: Duration) -> bool {
    matches!(run_command_blocking(program, args, timeout), Ok(output) if output.is_success())
}
