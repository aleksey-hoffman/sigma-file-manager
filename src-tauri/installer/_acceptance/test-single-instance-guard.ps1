# Acceptance test for the installer single-instance guard.
#
# WHAT IT PROVES
# --------------
# The guard is the answer to the 2026-10-19 report: one user-initiated install
# turned into six concurrent installers, each of them killing the app the
# previous one had just started. The rule is "lowest process id wins", so that
# exactly ONE of the concurrent installers goes ahead no matter how they
# interleave.
#
# This script exercises the DECISION, not the Win32 plumbing: it feeds the
# guard a synthetic sibling list and asserts the exit code and the verdict
# file. The wiring into hooks.nsh is asserted by
# src-tauri/installer/__tests__/single-instance-guard.test.ts.
#
# EXIT CODES OF THIS HARNESS
#   0 -> all cases behaved as specified
#   1 -> at least one case failed (details printed to stdout)
#
# ASCII ONLY: same reason as check-single-instance.ps1.

[CmdletBinding()]
param(
  # Which guard script to exercise. Production callers leave it empty; the
  # automated test points it at a deliberately broken copy to prove that this
  # harness actually has discriminating power (a harness that cannot fail is
  # worse than no harness at all).
  [string]$GuardScript = ''
)

$ErrorActionPreference = 'Continue'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Script = if ($GuardScript) { $GuardScript } else {
  Join-Path (Split-Path -Parent $Here) 'check-single-instance.ps1'
}

if (-not (Test-Path -LiteralPath $Script)) {
  Write-Output "FAIL: guard script not found at $Script"
  exit 1
}

$Scratch = Join-Path $env:TEMP ('afm-single-instance-acceptance-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $Scratch | Out-Null

$LogFile = Join-Path $Scratch 'guard.log'

# NOTE: $failures is bumped from inside Assert-Case, and a PowerShell function
# body runs in a CHILD scope -- a plain `$failures++` there would update a
# copy and the harness would report "OK" with failing cases. $script: reaches
# the script scope. Getting this wrong is exactly the false-green failure
# mode this project keeps running into.
$script:failures = 0

function Invoke-Guard {
  param([int]$SelfPid, [string]$SiblingPids, [string]$VerdictFile, [bool]$NoSiblings = $false)

  # NOT $args: that is an automatic variable, and assigning to it inside a
  # function is at best confusing and at worst silently drops arguments.
  $psArgs = @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', $Script,
    '-InstallerPid', $SelfPid,
    '-VerdictFile', $VerdictFile,
    '-LogFileOverride', $LogFile
  )

  if ($SiblingPids) {
    $psArgs += @('-SiblingPids', $SiblingPids)
  }

  if ($NoSiblings) {
    $psArgs += '-NoSiblings'
  }

  $output = & powershell @psArgs 2>&1
  $code = $LASTEXITCODE

  return [pscustomobject]@{
    ExitCode = $code
    Output = ($output -join "`n")
  }
}

function Assert-Case {
  param(
    [string]$Name,
    [int]$SelfPid,
    [string]$SiblingPids,
    [int]$ExpectedExit,
    [bool]$ExpectVerdictFile,
    [bool]$NoSiblings = $false
  )

  $verdict = Join-Path $Scratch ([guid]::NewGuid().ToString('N') + '.flag')
  $result = Invoke-Guard -SelfPid $SelfPid -SiblingPids $SiblingPids -VerdictFile $verdict -NoSiblings $NoSiblings
  $verdictExists = Test-Path -LiteralPath $verdict

  $ok = ($result.ExitCode -eq $ExpectedExit) -and ($verdictExists -eq $ExpectVerdictFile)

  if ($ok) {
    Write-Output ("  PASS  {0} (exit={1}, verdict={2})" -f $Name, $result.ExitCode, $verdictExists)
  }
  else {
    $script:failures++
    Write-Output ("  FAIL  {0} (exit={1}, expected={2}, verdict={3}, expected={4})" -f `
      $Name, $result.ExitCode, $ExpectedExit, $verdictExists, $ExpectVerdictFile)
    Write-Output ("        output: {0}" -f $result.Output)
  }
}

Write-Output '== single-instance guard: decision table =='

# The newcomer (higher pid) must step aside for the installer that started first.
Assert-Case -Name 'newer instance with an older one running steps aside' `
  -SelfPid 200 -SiblingPids '100' -ExpectedExit 10 -ExpectVerdictFile $true

# The oldest instance goes ahead even though a younger one is around.
Assert-Case -Name 'oldest instance proceeds despite a younger sibling' `
  -SelfPid 100 -SiblingPids '200' -ExpectedExit 0 -ExpectVerdictFile $false

# Several younger siblings: still exactly one winner.
Assert-Case -Name 'oldest instance proceeds with several younger siblings' `
  -SelfPid 100 -SiblingPids '200,300' -ExpectedExit 0 -ExpectVerdictFile $false

# Several older siblings: the newest of them still steps aside.
Assert-Case -Name 'newest instance steps aside for several older ones' `
  -SelfPid 300 -SiblingPids '100,200' -ExpectedExit 10 -ExpectVerdictFile $true

# Nobody else around: ordinary install, nothing changes.
#
# -NoSiblings instead of an empty -SiblingPids: an empty list made the guard
# enumerate every live process, so the verdict depended on what happened to be
# running (WMI failures under load -> exit 2; a shared image name -> phantom
# siblings). That is a flaky gate, and a flaky gate is worse than no gate.
Assert-Case -Name 'single instance is allowed to install' `
  -SelfPid 100 -SiblingPids '' -ExpectedExit 0 -ExpectVerdictFile $false -NoSiblings $true

Write-Output ''

if ($failures -gt 0) {
  Write-Output "FAILED: $failures case(s) behaved unexpectedly"
  exit 1
}

Write-Output 'OK: all single-instance guard cases passed'
exit 0
