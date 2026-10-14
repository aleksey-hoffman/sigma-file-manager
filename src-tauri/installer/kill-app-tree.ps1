<#
.SYNOPSIS
  Terminate Alpha/Sigma File Manager process trees WITHOUT touching the caller's own subtree.

.DESCRIPTION
  WHY NOT taskkill /F /IM <image> /T

  The old PREINSTALL hook used `taskkill /F /IM alpha-file-manager.exe /T`.
  /T means "kill the whole descendant tree". But when the user double-clicks the
  installer from inside Alpha, the process tree is:

      alpha-file-manager.exe
        +- Alpha File Manager_3.0.3_x64-setup.exe   <- the installer itself
             +- taskkill.exe

  The installer is a CHILD of Alpha, so that single command killed the installer
  mid-install, with no readable error.

  This script reproduces taskkill /T semantics safely:

    1. Snapshot every process (pid / image name / parent pid) BEFORE touching
       anything, because all tree maths is derived from this one snapshot.
    2. protected = caller pid + every descendant of the caller.
       This covers the installer, plus taskkill / powershell / msiexec that the
       installer itself spawns.
    3. targets = processes whose image name matches the kill list.
    4. Every descendant of a target joins the victim set -- that is exactly what
       /T would have done (WebView2 / crashpad children that mmap the exe).
    5. Subtract the protected set, then terminate deepest-first.

  Ordering matters: descendants MUST be collected before the parent is killed.
  Once a parent dies Windows reparents its orphans, and the tree link is gone.

  When the caller is NOT a descendant of a target -- the normal case, user
  started the installer from Explorer -- the protected and victim sets are
  disjoint, so behaviour is identical to the old `taskkill /T`, including the
  WebView2 cleanup that Tauri's CheckIfAppIsRunning depends on.

  v3.1.1 (2026-10-14): the "caller + descendants" rule ALONE was not enough,
  and it killed the installer during an upgrade. Real-machine log:

      08:33:30.529  caller pid resolved to 121796
      08:33:30.563  SKIP protected PID=121796 uninstall.exe
      08:33:30.667  terminated PID=83836 Alpha File Manager_3.1.0_x64-setup.exe
      08:33:30.708  OUTCOME=ok exit=0

  Why: during an upgrade hooks.nsh:667 runs the SAME macro through
  `un.AlphaTerminateAppProcesses`, so the caller is `uninstall.exe`, not the
  setup process. Its protected subtree is only itself + nsExec + conhost. The
  setup process is an ANCESTOR of the uninstaller (setup launched it), and
  Get-Descendants only walks downward, so setup was never protected. When the
  user had launched the setup from inside the app, setup was additionally a
  descendant of alpha-file-manager.exe, so it landed in the VICTIM set and was
  terminated mid-install. The install then failed with no readable error.

  The fix is NOT "protect the whole ancestor chain". That would also protect
  alpha-file-manager.exe itself, the app would survive, keep its exe locked, and
  Tauri CheckIfAppIsRunning would abort the install with "Failed to kill". The
  test in _acceptance/test-kill-protects-installer.ps1 asserts BOTH halves for
  exactly this reason.

  The fix is an image-name invariant that does not care about tree position:
  any process whose image ends in `setup.exe` or `uninstall.exe` is an installer
  or uninstaller and is never a victim. It covers the upgrade case above, the
  mirror case (a parallel uninstaller during a plain install), and a user who
  double-clicks the setup twice.

  ASCII ONLY, ON PURPOSE.
  This file is embedded verbatim into installer/hooks.nsh and materialised at
  run time with NSIS FileWrite, which converts strings through the system ANSI
  code page. Non-ASCII characters in this body would be written to disk as
  mojibake and the script would fail to parse. The Chinese rationale lives in
  hooks.nsh instead, where makensis handles UTF-8 source fine.

.PARAMETER SelfPid
  Optional. Caller's process id, protected along with its whole subtree.

  v0.5.11 (2026-10-13): this parameter is NO LONGER PASSED BY THE INSTALLER, and
  passing it was the bug that made this whole hook a no-op.

  The installer used to run:

      powershell ... -File "$PLUGINSDIR/kill-app-tree.ps1" -SelfPid $0

  but NSIS `$0` at that point is NOT the installer's PID. Tauri seeds it at
  `installer.nsi:196` with `StrCpy $0 0` and then uses it as the index of the
  wix_detect EnumRegKey loop over the HKLM Uninstall hive, so by PREINSTALL it
  holds "however many installed programs this machine has" (76 on this box).
  Whatever PID that happens to be, it is an accident: if it ever lands on an
  ancestor of a target process, `protected` swallows the victim and nothing
  gets killed; if it is absent the mandatory-parameter binding fails and the
  script dies before it does anything at all. Both produce the same visible
  symptom - the app and the sidecar survive the install.

  So the script now derives the caller itself: nsExec spawns powershell.exe as
  a direct child of the installer, so the installer's PID is simply this
  process's parent. That is correct by construction and cannot drift.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File kill-app-tree.ps1
#>
[CmdletBinding()]
param(
  [int]$SelfPid = 0,

  # Test-only override for the log destination. Production calls never pass it
  # and keep using %TEMP%\alpha-file-manager-kill.log. It exists so the
  # regression harness in _acceptance/ can assert on its own log without
  # interleaving entries into the production log that real installs rely on.
  [string]$LogFileOverride = '',

  [string[]]$AppImages = @(
    'alpha-file-manager.exe',
    'SigmaFileManager.exe',
    'Sigma File Manager.exe',
    'SigmaFileManagerHelper.exe',
    'SigmaFileManagerRenderer.exe',
    'Sigma File Manager Renderer.exe',
    'Alpha File Manager.exe',
    'AlphaFileManager.exe',
    'AlphaFileManagerHelper.exe',
    'AlphaFileManagerRenderer.exe',
    'Alpha File Manager Renderer.exe'
  ),

  [string[]]$HelperImages = @(
    'spike.exe',
    'focus-sync-sidecar.exe'
  )
)

$ErrorActionPreference = 'Continue'

# v0.5.11: persist every line to a file as well as to stdout.
#
# WHY: the installer's only log is the MUI progress pane, which vanishes when the
# window closes. NSIS was not writing a log file at all, so "did the kill script
# run, what caller pid did it resolve, which pids did it skip" was unanswerable
# after the fact -- which is exactly the question 2026-10-13 needed answered.
#
# ASCII + no backslashes is still mandatory (see embed-kill-script.mjs), so the
# path is built with Join-Path rather than written literally.
$ScriptLogFile = if ($LogFileOverride) { $LogFileOverride } else {
  Join-Path $env:TEMP 'alpha-file-manager-kill.log'
}

function Write-Log {
  param([string]$Message)
  # nsExec::ExecToLog pipes stdout into the installer's DetailPrint log.
  Write-Output $Message
  try {
    Add-Content -LiteralPath $ScriptLogFile -Encoding ASCII `
      -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'), $Message) `
      -ErrorAction Stop
  }
  catch {
    # Never let logging itself break the kill.
  }
}

# --- 1. snapshot ------------------------------------------------------------
$procs = @{}

try {
  Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
    $procs[[int]$_.ProcessId] = [pscustomobject]@{
      Pid  = [int]$_.ProcessId
      Name = [string]$_.Name
      Ppid = [int]$_.ParentProcessId
    }
  }
}
catch {
  Write-Log "    [kill-app-tree] ERROR: cannot enumerate processes ($($_.Exception.Message)); killing nothing."
  Write-Log "    [kill-app-tree] OUTCOME=enum-failed exit=2 (killed nothing)"
  exit 2
}

Write-Log "    [kill-app-tree] snapshot: $($procs.Count) processes"

function Get-Descendants {
  param([int]$RootPid, [hashtable]$Table)

  $out = New-Object System.Collections.ArrayList
  $seen = @{}
  $frontier = New-Object System.Collections.ArrayList
  [void]$frontier.Add($RootPid)

  while ($frontier.Count -gt 0) {
    $current = $frontier[0]
    $frontier.RemoveAt(0)

    foreach ($p in $Table.Values) {
      if ($p.Ppid -ne $current) { continue }
      if ($seen.ContainsKey($p.Pid)) { continue }
      $seen[$p.Pid] = $true
      [void]$out.Add($p)
      [void]$frontier.Add($p.Pid)
    }
  }

  return $out
}

# --- 2. protected set: caller + all caller descendants ----------------------
# The installer lives here when launched from Alpha, so nothing that belongs to
# the running installation can ever be terminated by mistake.
#
# v0.5.11: derive the caller instead of trusting -SelfPid (see .PARAMETER).
$SelfPid = if ($SelfPid -gt 0) { $SelfPid } else {
  $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop
  [int]$parent.ParentProcessId
}
$SelfPid = if ($SelfPid -le 0) { $PID } else { $SelfPid }

$protected = @{}

if ($procs.ContainsKey($SelfPid)) {
  $protected[$SelfPid] = $true
}
foreach ($d in (Get-Descendants -RootPid $SelfPid -Table $procs)) {
  $protected[$d.Pid] = $true
}

Write-Log "    [kill-app-tree] caller pid resolved to $SelfPid (this script pid=$PID)"

if ($protected.Count -gt 1) {
  Write-Log "    [kill-app-tree] protected subtree: $($protected.Count) processes (installer itself + descendants)"
}

# --- 2b. installer / uninstaller images are never victims --------------------
# v3.1.1 (2026-10-14). See .DESCRIPTION for the 08:33:30 log this fixes.
#
# The subtree rule above is caller-relative, and during an upgrade the caller
# is uninstall.exe while the process that must survive is its ANCESTOR. Walking
# ancestors instead would over-protect: alpha-file-manager.exe sits on that same
# ancestor chain and must still die, or the install cannot overwrite its exe.
#
# So the invariant is stated on the image name, which is position-independent:
# nothing named *setup.exe or *uninstall.exe is ever terminated by this script.
$InstallerImagePattern = '(?i)(setup|uninstall)\.exe$'

foreach ($p in $procs.Values) {
  if ($p.Name -notmatch $InstallerImagePattern) { continue }
  if ($protected.ContainsKey($p.Pid)) { continue }
  Write-Log "    [kill-app-tree] SKIP PID=$($p.Pid) $($p.Name) (installer/uninstaller image; never a kill target)"
  $protected[$p.Pid] = $true
}

# --- 3. targets --------------------------------------------------------------
$imageSet = @{}
foreach ($n in (@($AppImages) + @($HelperImages))) { $imageSet[$n.ToLowerInvariant()] = $true }

$targets = @($procs.Values | Where-Object {
  $imageSet.ContainsKey($_.Name.ToLowerInvariant()) -and -not $protected.ContainsKey($_.Pid)
})

if ($targets.Count -eq 0) {
  Write-Log "    [kill-app-tree] no running target process found; nothing to terminate."
  Write-Log "    [kill-app-tree] OUTCOME=no-targets exit=0 (image names not present on this machine)"
  exit 0
}

foreach ($t in $targets) {
  Write-Log "    [kill-app-tree] target found: PID=$($t.Pid) $($t.Name)"
}

# --- 4. victims = targets + every descendant (= taskkill /T) ------------------
$victims = New-Object System.Collections.ArrayList
$depth = @{}

foreach ($t in $targets) {
  [void]$victims.Add($t)
  $depth[$t.Pid] = 0

  $d = 0
  foreach ($child in (Get-Descendants -RootPid $t.Pid -Table $procs)) {
    [void]$victims.Add($child)
    $depth[$child.Pid] = ++$d
  }
}

# Subtracting the protected set is the whole point of this script.
$toKill = @($victims | Where-Object { -not $protected.ContainsKey($_.Pid) })

foreach ($s in @($victims | Where-Object { $protected.ContainsKey($_.Pid) })) {
  Write-Log "    [kill-app-tree] SKIP protected PID=$($s.Pid) $($s.Name) (belongs to the installer subtree)"
}

if ($toKill.Count -eq 0) {
  Write-Log "    [kill-app-tree] target subtree contains nothing outside the installer; nothing to terminate."
  Write-Log "    [kill-app-tree] OUTCOME=all-protected exit=0 (targets WERE found but sat inside the installer subtree)"
  exit 0
}

# --- 5. terminate deepest-first ----------------------------------------------
$ordered = @($toKill | Sort-Object -Property `
  @{ Expression = { $depth[$_.Pid] } }, `
  @{ Expression = { $_.Pid } } -Descending)

$killed = 0
$failed = 0

foreach ($v in $ordered) {
  try {
    Stop-Process -Id $v.Pid -Force -ErrorAction Stop
    Write-Log "    [kill-app-tree] terminated PID=$($v.Pid) $($v.Name)"
    $killed++
  }
  catch {
    if (Get-Process -Id $v.Pid -ErrorAction SilentlyContinue) {
      Write-Log "    [kill-app-tree] FAILED to terminate PID=$($v.Pid) $($v.Name): $($_.Exception.Message)"
      $failed++
    }
    else {
      Write-Log "    [kill-app-tree] PID=$($v.Pid) $($v.Name) already exited on its own."
    }
  }
}

Write-Log "    [kill-app-tree] done: killed=$killed failed=$failed, installer alive."

if ($failed -gt 0) { Write-Log "    [kill-app-tree] OUTCOME=partial exit=1"; exit 1 }
Write-Log "    [kill-app-tree] OUTCOME=ok exit=0 (log file: $ScriptLogFile)"
exit 0
