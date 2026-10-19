# check-single-instance.ps1
#
# Decides whether THIS installer process is the one that should go ahead and
# install, or whether it is a duplicate that must get out of the way.
#
# WHY THIS EXISTS (2026-10-19 real-machine report)
# ------------------------------------------------
# A single user-initiated install turned into SIX concurrent installers. The
# kill log (alpha-file-manager-kill.log) shows three setup.exe processes alive
# at the same time, each of them running the PREINSTALL hook. Every one of
# them killed the freshly installed app and started it again, so the user saw
# "the app keeps restarting" and "an installer keeps popping up".
#
# Nothing inside this repository launches the installer. The self-updater only
# downloads an installer and offers it behind a button (see
# src/modules/app-updater/composables/use-app-updater.ts); the app never spawns
# a setup.exe; NSIS never re-launches itself. The duplicates come from outside
# the app. Whatever their origin, the product still has to survive them: a
# duplicate installer must not kill the app that the primary installer just
# started, and must not run a second install on top of the first one.
#
# THE RULE
# ---------
# Sibling installers = other live processes running the SAME setup executable.
# Among them plus ourselves, the one with the LOWEST process id wins and goes
# ahead; every other one exits immediately.
#
# Why "lowest pid wins" and not "the first one to ask wins":
#   - A lock/mutex would need to be held for the whole install, and there is no
#     hook before the wizard pages in the Tauri NSIS template, so the lock
#     could only be taken in PREINSTALL -- same place as this check.
#   - "Whoever asks first" is a race: two installers reaching PREINSTALL at
#     the same moment could both see "no other installer" and both proceed.
#     "Lowest pid wins" is deterministic: exactly ONE of them proceeds, no
#     matter how the two interleave. No livelock, no double install.
#   - Windows hands out process ids roughly in increasing order, so the lowest
#     pid is also (almost always) the installer that started first, i.e. the
#     one the user is actually looking at.
#
# HOW THE INSTALLER PID IS FOUND
# -------------------------------
# nsExec spawns powershell.exe directly, so our PARENT process is the
# installer. This is the same trick kill-app-tree.ps1 uses. Do not pass the pid
# from NSIS: NSIS has no reliable "$0 = my own pid" (the Tauri template
# overwrites $0 long before PREINSTALL).
#
# EXIT CODES
# ----------
#   0  -> primary, go ahead and install
#   10 -> duplicate, the caller must abort this installer
#   2  -> the check itself failed (cannot enumerate processes); treated by the
#         caller as "primary" so a broken guard never blocks every install.
#
# ASCII ONLY, ON PURPOSE.
# The file is materialised verbatim into $PLUGINSDIR at install time. Windows
# PowerShell 5.1 reads a BOM-less .ps1 using the system ANSI code page, so any
# non-ASCII character would arrive as mojibake. Comments here are English on
# purpose; the user-facing text lives in hooks.nsh.

[CmdletBinding()]
param(
  # Test-only override for the installer pid. Production never passes it and
  # keeps deriving the installer from the parent process.
  [int]$InstallerPid = 0,

  # Test-only override for the sibling list. When it is supplied the script
  # does NOT enumerate the machine, it just runs the election over the given
  # process ids. Production never passes it.
  #
  # It is a STRING, not an int[], on purpose: `powershell -File script.ps1
  # -SiblingPids 100,300` hands the argument over as one literal token, and
  # an [int[]] parameter would swallow "100,300" as the single number
  # 100300 instead of two ids. A comma separated string is parsed here.
  [string]$SiblingPids = '',

  # Where to drop the "you are a duplicate" marker file. The installer passes
  # a path under $PLUGINSDIR; tests pass a scratch path.
  [string]$VerdictFile = '',

  # Test-only override for the log destination. Production never passes it and
  # keeps using %TEMP%\alpha-file-manager-installer-guard.log.
  [string]$LogFileOverride = ''
)

$ErrorActionPreference = 'Continue'

$ScriptLogFile = if ($LogFileOverride) { $LogFileOverride } else {
  Join-Path $env:TEMP 'alpha-file-manager-installer-guard.log'
}

function Write-Log {
  param([string]$Message)

  # nsExec::ExecToLog pipes stdout into the installer's DetailPrint log, so
  # the same line shows up in the install log and in the durable file.
  Write-Output $Message

  try {
    Add-Content -LiteralPath $ScriptLogFile -Encoding ASCII `
      -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'), $Message) `
      -ErrorAction Stop
  }
  catch {
    # Never let logging itself break the install.
  }
}

function Remove-VerdictFile {
  param([string]$Path)

  if (-not $Path) { return }

  try {
    if (Test-Path -LiteralPath $Path) {
      Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
    }
  }
  catch {
    Write-Log "    [single-instance] WARN: cannot clear verdict file ($($_.Exception.Message))"
  }
}

function Write-VerdictFile {
  param([string]$Path)

  if (-not $Path) { return }

  try {
    Set-Content -LiteralPath $Path -Value 'duplicate' -Encoding ASCII -Force -ErrorAction Stop
  }
  catch {
    Write-Log "    [single-instance] ERROR: cannot write verdict file ($($_.Exception.Message))"
  }
}

# --- 1. who is the installer -------------------------------------------------
$resolvedInstallerPid = if ($InstallerPid -gt 0) { $InstallerPid } else {
  try {
    $parent = Get-CimInstance Win32_Process -Filter "ProcessId=$PID" -ErrorAction Stop
    [int]$parent.ParentProcessId
  }
  catch {
    Write-Log "    [single-instance] ERROR: cannot resolve parent pid ($($_.Exception.Message))"
    0
  }
}

if ($resolvedInstallerPid -le 0) {
  Write-Log "    [single-instance] OUTCOME=unknown-installer exit=2 (guard cannot decide; install proceeds)"
  exit 2
}

$installerProcess = $null

try {
  $installerProcess = Get-CimInstance Win32_Process `
    -Filter "ProcessId=$resolvedInstallerPid" -ErrorAction Stop
}
catch {
  Write-Log "    [single-instance] ERROR: cannot query installer process ($($_.Exception.Message))"
}

$installerImage = if ($installerProcess) { [string]$installerProcess.Name } else { '' }
$installerPath = if ($installerProcess) { [string]$installerProcess.ExecutablePath } else { '' }

Write-Log "    [single-instance] installer pid=$resolvedInstallerPid image='$installerImage' path='$installerPath'"

# --- 2. find the siblings ----------------------------------------------------
#
# A sibling is another live process running the SAME setup executable. The
# executable path is the discriminator because the file name carries the
# version ("Alpha File Manager_3.2.11-beta_x64-setup.exe"), so two different
# versions never block each other. When the path is not readable (a process
# owned by another user), fall back to the image name.
$siblingPidList = @()

$suppliedSiblings = @()

if ($SiblingPids) {
  $suppliedSiblings = @(
    $SiblingPids -split ',' |
      ForEach-Object { $_.Trim() } |
      Where-Object { $_ -ne '' } |
      ForEach-Object { [int]$_ }
  )
}

if ($suppliedSiblings.Count -gt 0) {
  # Test-only path: use the supplied list verbatim.
  $siblingPidList = @($suppliedSiblings | Where-Object { $_ -gt 0 -and $_ -ne $resolvedInstallerPid })
  Write-Log "    [single-instance] siblings (supplied): $($siblingPidList -join ',')"
}
else {
  $procs = @{}

  try {
    Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
      $procs[[int]$_.ProcessId] = [pscustomobject]@{
        Pid  = [int]$_.ProcessId
        Name = [string]$_.Name
        Path = [string]$_.ExecutablePath
      }
    }
  }
  catch {
    Write-Log "    [single-instance] ERROR: cannot enumerate processes ($($_.Exception.Message))"
    Write-Log "    [single-instance] OUTCOME=enum-failed exit=2 (install proceeds)"
    exit 2
  }

  Write-Log "    [single-instance] snapshot: $($procs.Count) processes"

  foreach ($p in $procs.Values) {
    if ($p.Pid -eq $resolvedInstallerPid) { continue }

    # The uninstaller is a different executable and must never be counted:
    # the Tauri "uninstall then install" flow starts it on purpose.
    if ($p.Name -match '(?i)uninstall\.exe$') { continue }

    $samePath = $false
    $sameName = $false

    if ($installerPath -and $p.Path) {
      $samePath = ($p.Path -ieq $installerPath)
    }
    elseif ($installerImage) {
      $sameName = ($p.Name -ieq $installerImage)
    }

    if ($samePath -or $sameName) {
      $siblingPidList += $p.Pid
      Write-Log "    [single-instance] sibling PID=$($p.Pid) image='$($p.Name)' path='$($p.Path)'"
    }
  }
}

# --- 3. the election ---------------------------------------------------------
#
# Lowest pid wins. If any sibling has a lower pid than us, we are the
# duplicate and must not install.
$older = @($siblingPidList | Where-Object { $_ -lt $resolvedInstallerPid })

if ($older.Count -gt 0) {
  Remove-VerdictFile -Path $VerdictFile
  Write-Log "    [single-instance] OUTCOME=duplicate exit=10 (older installer(s) still running: $($older -join ','))"
  Write-VerdictFile -Path $VerdictFile
  exit 10
}

Remove-VerdictFile -Path $VerdictFile

if ($siblingPidList.Count -gt 0) {
  Write-Log "    [single-instance] OUTCOME=primary exit=0 (younger duplicate(s) will step aside: $($siblingPidList -join ','))"
}
else {
  Write-Log "    [single-instance] OUTCOME=primary exit=0 (no other installer running)"
}

exit 0
