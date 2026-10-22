# write-install-log.ps1
#
# Appends ONE durable line describing what this installer run did.
#
# WHY THIS EXISTS (2026-10-22)
# ---------------------------
# The installer had two durable logs -- the single-instance guard log and the
# kill-app-tree log -- but **nothing recorded the installer's own decisions**:
# which install directory was chosen, whether an existing installation was
# detected, which version was already installed, whether this run was a
# reinstall of the very same version, and whether the run finished.
#
# That gap is why "I installed it again and it seemed to activate the online
# update" could not be answered from artifacts: the two existing logs showed
# that no duplicate installer ran, but they said nothing about versions or
# about what the installer did with the installation directory.
#
# This script writes that missing line, to:
#     %TEMP%\alpha-file-manager-install.log
# (overridable for tests). The log is APPENDED, so a machine that has been
# installed many times keeps the whole history.
#
# ASCII ONLY, ON PURPOSE.
# The file is materialised verbatim into $PLUGINSDIR at install time. Windows
# PowerShell 5.1 reads a BOM-less .ps1 using the system ANSI code page, so any
# non-ASCII character would arrive as mojibake. The same rule applies to
# hooks.nsh, which embeds this script.

[CmdletBinding()]
param(
  # Which hook is reporting: PREINSTALL / POSTINSTALL / PREUNINSTALL / POSTUNINSTALL.
  [string]$Phase = 'UNKNOWN',

  # Full path of the running setup executable. Its ProductVersion resource is
  # the version THIS installer is about to install.
  [string]$InstallerPath = '',

  # The installation directory the installer settled on.
  [string]$InstDir = '',

  # Version of the installation that was already present, when one was found.
  [string]$DetectedVersion = '',

  # Location of the installation that was already present, when one was found.
  [string]$DetectedLocation = '',

  # Test-only override for the log destination.
  [string]$LogFileOverride = ''
)

$ErrorActionPreference = 'Continue'

$ScriptLogFile = if ($LogFileOverride) { $LogFileOverride } else {
  Join-Path $env:TEMP 'alpha-file-manager-install.log'
}

function Get-InstallerVersion {
  param([string]$Path)

  if (-not $Path) { return '' }

  try {
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $version = (Get-Item -LiteralPath $Path).VersionInfo.ProductVersion
    if ($version) { return ([string]$version).Trim() }
  }
  catch {
  }

  return ''
}

<#
  Builds the log line. Kept separate from the writing so the exact text can be
  asserted in a unit test without touching the filesystem.
#>
function Format-InstallLogLine {
  param(
    [string]$PhaseName,
    [string]$InstallerVersion,
    [string]$InstallerPathValue,
    [string]$InstallDir,
    [string]$ExistingVersion,
    [string]$ExistingLocation
  )

  $sameVersion = 'unknown'

  if ($InstallerVersion -and $ExistingVersion) {
    if ($InstallerVersion -eq $ExistingVersion) {
      $sameVersion = 'yes'
    }
    else {
      $sameVersion = 'no'
    }
  }

  $existingText = $ExistingVersion
  if (-not $existingText) { $existingText = 'none' }

  $locationText = $ExistingLocation
  if (-not $locationText) { $locationText = 'none' }

  $instDirText = $InstallDir
  if (-not $instDirText) { $instDirText = 'none' }

  $installerPathText = $InstallerPathValue
  if (-not $installerPathText) { $installerPathText = 'none' }

  return ("[install] phase={0} installerVersion={1} sameVersionReinstall={2} " +
    "detectedVersion={3} detectedLocation='{4}' instDir='{5}' installer='{6}'") -f
    $PhaseName,
    $(if ($InstallerVersion) { $InstallerVersion } else { 'unknown' }),
    $sameVersion,
    $existingText,
    $locationText,
    $instDirText,
    $installerPathText
}

$installerVersion = Get-InstallerVersion -Path $InstallerPath

$line = Format-InstallLogLine `
  -PhaseName $Phase `
  -InstallerVersion $installerVersion `
  -InstallerPathValue $InstallerPath `
  -InstallDir $InstDir `
  -ExistingVersion $DetectedVersion `
  -ExistingLocation $DetectedLocation

# nsExec::ExecToLog pipes stdout into the installer's DetailPrint log, so the
# same line shows up in the installer's own log and in the durable file.
Write-Output $line

try {
  Add-Content -LiteralPath $ScriptLogFile -Encoding ASCII `
    -Value ("{0} {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'), $line) `
    -ErrorAction Stop
}
catch {
  # Never let logging itself break the install.
}

exit 0
