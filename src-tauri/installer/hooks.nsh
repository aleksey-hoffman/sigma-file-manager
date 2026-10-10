; ============================================================================
; Sigma File Manager - Custom NSIS installer hooks
; ============================================================================
; This file is referenced by tauri.conf.json via:
;   bundle.windows.nsis.installerHooks = "installer/hooks.nsh"
;
; It uses Tauri 2.x's installerHooks feature to inject custom NSIS
; installation steps at four hook points:
;   NSIS_HOOK_PREINSTALL    - before main install
;   NSIS_HOOK_POSTINSTALL   - after main install (extension deployment)
;   NSIS_HOOK_PREUNINSTALL  - before main uninstall
;   NSIS_HOOK_POSTUNINSTALL - after main uninstall (extension removal)
;
; The kizemo.focus-sync extension and focus-sync-sidecar binary are
; declared in bundle.resources, which Tauri copies to $INSTDIR\
; (using the destination path from tauri.conf.json as a relative
; subpath, e.g. extensions\kizemo.focus-sync\ and bin\focus-sync-sidecar\).
; The POSTINSTALL hook then copies them to
; %APPDATA%\com.sigma-file-manager.app\, which is where Sigma's
; extension runtime expects them.
; ============================================================================

; Round 19d: Custom var to hold the resolved original user's APPDATA path.
; (We can't use $USERAPPDATA because NSIS 3.x reserves it as a built-in constant.)
Var RESOLVEDAPPDATA

; -----------------------------------------------------------------------
; AlphaNormalizeInstDir — the single gate between "a registry string" and
; "$INSTDIR".
;
; ROOT CAUSE of three shipped bugs (short menu shortcut gone, directory
; page showing "D\Program Files\..." with Next disabled, "Run Alpha File
; Manager" launching nothing): Tauri's NSIS template writes the uninstall
; record's InstallLocation as a QUOTED string
;     WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" "$\"$INSTDIR$\""
; Reading that back and assigning it with
;     StrCpy $INSTDIR "$0"
; produces a doubly-quoted instruction ("$0" expands to itself quoted), and
; NSIS's tokenizer then eats the drive colon: "D:\Program Files\..." becomes
; "D\Program Files\...". With no drive colon, NSIS reads $INSTDIR as a path
; RELATIVE to the system directory and rewrites it to
; "C:\D\Program Files\Alpha File Manager" — a path that does not exist. Every
; "$INSTDIR\..." expansion then resolves under that bogus root, which is why
; the start-menu/desktop shortcuts pointed at C:\D\... and why
; nsis_tauri_utils::RunAsUser "$INSTDIR\alpha-file-manager.exe" silently did
; nothing.
;
; Everything below this function only produces a CANDIDATE. Only a candidate
; that AlphaNormalizeInstDir marks "ok" is ever assigned to $INSTDIR.
;
; in:  $1 = raw candidate, exactly as read from the registry
; out: $1 = normalized path (unchanged if unusable)
;      $0 = "ok"  -> $1 is an absolute drive-letter path, safe to use
;          "bad" -> $1 must NOT be assigned to $INSTDIR
; -----------------------------------------------------------------------
Function AlphaNormalizeInstDir
  StrCpy $0 "bad"

  ; 1. Strip the surrounding double quotes Tauri's template writes.
  ;    Deliberately uses only StrCpy / IntOp / ${StrLoc}. StrFunc's ${StrRep}
  ;    is NOT available here: hooks.nsh is included by both the generated
  ;    installer.nsi and the generated uninstaller script, neither of which
  ;    registers it, and building with `${StrRep}` fails makensis with
  ;    "You forgot ${Using:StrFunc} StrRep". ${StrLoc} IS registered.
  ;
  ;    Locating the trailing quote without knowing the string length: append a
  ;    sentinel that cannot occur in a Windows path ('|'), then ask ${StrLoc}
  ;    where it landed -- its 0-based index from the start IS the length.
  ;    (Direction is ">" = from the start; measured, "<" counts from the end.)
  StrCpy $4 $1 1
  ${If} $4 == '"'
    StrCpy $1 $1 "" 1            ; drop the leading quote
  ${EndIf}
  ; Trailing quote: locate it the same way, and only if a sentinel really
  ; landed (guard, so a StrLoc miss can never feed IntOp a garbage index).
  ${If} $1 != ""
    StrCpy $7 "$1|"
    ${StrLoc} $3 $7 "|" ">"
    ${If} $3 != ""
      IntOp $6 $3 - 1            ; index of the last character
      StrCpy $4 $1 1 $6
      ${If} $4 == '"'
        StrCpy $1 $1 $6          ; truncate: drops the trailing quote
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; 2. Repair a colon that an EARLIER broken round already ate, so machines
  ;    that are corrupted right now self-heal instead of silently relocating
  ;    to C:\Program Files and orphaning the user's real folder.
  ;    Only the unambiguous "<letter>\<rest>" shape is repaired — nothing else
  ;    is guessed at.
  ;    StrFunc argument order: ResultVar, String, StrToSearchFor, Direction.
  ${StrLoc} $3 $1 ":" ">"
  ${If} $3 == ""
    StrCpy $4 $1 1           ; first character (the drive letter)
    StrCpy $5 $1 1 1         ; second character
    ${If} $4 != ""
    ${AndIf} $5 == "\"
      StrCpy $6 $1 "" 1      ; everything from offset 1 onward
      StrCpy $1 "$4:$6"
    ${EndIf}
  ${EndIf}

  ; 3. Accept only an absolute drive-letter path, i.e. colon at index 1.
  ;    Anything else (relative junk, UNC, empty) is rejected and the caller
  ;    keeps the installer's built-in default.
  ;    StrFunc argument order: ResultVar, String, StrToSearchFor, Direction.
  ;    Direction ">" = search forward from the start and return a 0-based index
  ;    from the start. Measured, not assumed: ">" gives 1 for "D:\abc", while
  ;    "<" gives 4 because it counts from the END.
  ${StrLoc} $3 $1 ":" ">"
  ${If} $3 == 1
    StrCpy $0 "ok"
  ${EndIf}
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ; ---------------------------------------------------------------------
  ; Round 19e (2026-09-30): Defensive kill of any running sigma-file-manager.exe
  ; before file writes. POSTINSTALL writes user-extensions.json + extension
  ; files; if Sigma FM is running (in-place upgrade without uninstall), its
  ; in-memory state overwrites our disk writes on the next UI save. Tauri
  ; only kills the app during UNINSTALL, not INSTALL. This is a net for both
  ; scenarios — uninstall-then-install (stuck subprocess) AND in-place upgrade.
  ;
  ; v0.5.1 (2026-10-05): Tauri's `CheckIfAppIsRunning` (uses Windows
  ; Restart Manager) runs AFTER our PREINSTALL (line 637) and aborts
  ; with "Failed to kill Sigma File Manager" if RSTRTMGR::RmShutdown
  ; can't gracefully close the app. We pre-kill with taskkill /F /T,
  ; plus also kill common case variants and Electron helper processes
  ; that Tauri apps spawn.
  ; ---------------------------------------------------------------------
  DetailPrint "==> [PREINSTALL HOOK] Killing Alpha File Manager / Sigma FM and helpers (taskkill /F /T) ..."
  ; Case variants seen in the wild: 'sigma-file-manager.exe' (Tauri),
  ; 'SigmaFileManager.exe' (case variant on some forks), and the
  ; Electron helpers 'SigmaFileManagerHelper.exe' + 'Sigma File Manager.exe'.
  ; v0.5.2: extend kill list to cover Chromium renderers + WebView2 +
  ; crashpad + msedgewebview2 (these can hold the .exe via mmap even after
  ; the main process exits). RSTRTMGR::RmGetList finds ALL of these; taskkill /F /T
  ; must clear them before Tauri's CheckIfAppIsRunning passes.
  nsExec::ExecToLog 'taskkill /F /IM sigma-file-manager.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManager.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "Sigma File Manager.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManagerHelper.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManagerRenderer.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "Sigma File Manager Renderer.exe" /T'
  Pop $0
  ; v2.2.0-alpha (2026-10-09): the main exe is now named from the Cargo
  ; package name (see [package] name in Cargo.toml), NOT from productName.
  ; productName only names the *installer* and the window title. After the
  ; rename that is "alpha-file-manager.exe". This entry is NOT optional: if it
  ; is missing, an in-place reinstall over a RUNNING install fails in Tauri's
  ; CheckIfAppIsRunning -- silently, since Tauri swallows the reason.
  ; The Sigma* entries above are kept deliberately: they are the upgrade path
  ; for users who still have Sigma FM installed
  ; (kill it -> reuse its InstallLocation -> upgrade in place).
  nsExec::ExecToLog 'taskkill /F /IM alpha-file-manager.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "Alpha File Manager.exe" /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM AlphaFileManager.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM AlphaFileManagerHelper.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM AlphaFileManagerRenderer.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "Alpha File Manager Renderer.exe" /T'
  Pop $0
  ; v2.2.0-beta (2026-10-10): REMOVED the image-wide
  ;   taskkill /F /IM msedgewebview2.exe /T
  ;   taskkill /F /IM crashpad_handler.exe /T
  ; They were a guess, not a diagnosis, and they destroy OTHER applications:
  ; a measured probe on this machine found 6 live msedgewebview2.exe processes
  ; owned by unrelated apps while Alpha was running (Edge, widgets, etc.).
  ; They were also unnecessary. Same probe, killing ONLY alpha-file-manager.exe
  ; with /T: all 7 of Alpha's own msedgewebview2.exe descendants (chain
  ; 13888 -> 42144 -> 6 renderers) were terminated, 0 survivors, with no
  ; image-wide kill involved.
  ; Also any msiexec / WerFault / TiWorker that might be holding files.
  nsExec::ExecToLog 'taskkill /F /IM TiWorker.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM WerFault.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM msiexec.exe /T 2>nul'
  Pop $0
  ${If} $0 == "0"
    DetailPrint "==> Alpha FM / Sigma FM was running; terminated (taskkill exit 0)."
  ${ElseIf} $0 == "128"
    DetailPrint "==> No Alpha FM / Sigma FM process found (taskkill exit 128 = no match)."
  ${Else}
    DetailPrint "==> taskkill returned $0 (continuing)."
  ${EndIf}

  ; ---------------------------------------------------------------------
  ; v0.5.1 (2026-10-05): Defensive kill of the focus-sync sidecar
  ; (`spike.exe`, NOT `focus-sync-sidecar.exe`) before any file writes.
  ; The Scheduled Task \KizemoFocusSync launches the binary as `spike.exe`,
  ; so a running Scheduled Task holds focus-sync-sidecar.exe open, which
  ; blocks NSIS's MoveFileEx and Windows's DeleteFileW.
  ;
  ; Without this, every install attempt that runs while the sidecar is
  ; alive fails with "Error opening file for writing", and uninstall
  ; fails with "Operation could not be completed because the file is
  ; open in focus-sync-sidecar.exe".
  ;
  ; Also disable the Scheduled Task so it doesn't immediately respawn
  ; spike.exe before our file writes complete.
  ; ---------------------------------------------------------------------
  DetailPrint "==> [PREINSTALL HOOK] Killing any existing focus-sync sidecar (spike.exe) ..."
  nsExec::ExecToLog 'taskkill /F /IM spike.exe /T'
  Pop $0
  ${If} $0 == "0"
    DetailPrint "==> spike.exe was running; terminated (taskkill exit 0)."
  ${ElseIf} $0 == "128"
    DetailPrint "==> No spike.exe process found (taskkill exit 128 = no match)."
  ${Else}
    DetailPrint "==> taskkill returned $0 (continuing)."
  ${EndIf}
  ; Also try the legacy alias name in case an older sidecar still uses it.
  nsExec::ExecToLog 'taskkill /F /IM focus-sync-sidecar.exe /T'
  Pop $0
  ; Disable the Scheduled Task so it doesn't auto-respawn the sidecar
  ; during the brief window between kill and file overwrite.
  nsExec::ExecToLog 'schtasks /Change /TN "\KizemoFocusSync" /DISABLE 2>nul'
  Pop $0
  ; Brief settle delay so the process can release any open handles.
  Sleep 1500

  ; ---------------------------------------------------------------------
  ; Detect an existing Sigma File Manager installation and reuse its
  ; InstallLocation. Priority:
  ;   1. Tauri-style registry key (this fork's installer)
  ;   2. Legacy makensis registry key (upstream AppName = "Sigma File Manager")
  ;   3. Filesystem probe under %PROGRAMFILES% for nested layout
  ;
  ; This makes the installer "smart-upgrade": it lands in the same folder
  ; the user previously chose, instead of switching to %LOCALAPPDATA%.
  ;
  ; Note: Tauri NSIS template also has its own RestorePreviousInstallLocation
  ; in .onInit reading MANUPRODUCTKEY (HKLM\SOFTWARE\sigma-file-manager\Sigma File
  ; Manager). It typically wins for fork-on-fork upgrades. This hook covers
  ; cases Tauri misses (legacy makensis installs, FS-only installs).
  ; ---------------------------------------------------------------------
  DetailPrint "==> [PREINSTALL HOOK START] $INSTDIR (before detection) = $INSTDIR"
  ; ---------------------------------------------------------------------
  ; v2.2.0-beta (2026-10-10): every branch below only produces a CANDIDATE.
  ; AlphaNormalizeInstDir is the only thing allowed to turn a candidate into
  ; $INSTDIR. The old code assigned the raw registry string directly, which
  ; silently corrupted the drive colon — see the function's comment for the
  ; full chain (broken shortcuts / disabled Next / dead "Run" checkbox).
  ; ---------------------------------------------------------------------
  StrCpy $0 ""

  ; 0a. Tauri-native record. The template writes this UNQUOTED
  ;     ("Save $INSTDIR in registry for future installations") and Tauri's
  ;     own RestorePreviousInstallLocation reads it back, so it is the
  ;     authoritative source for any install made by this or a later version.
  ReadRegStr $0 HKLM "${MANUPRODUCTKEY}" ""
  ${If} $0 == ""
    ReadRegStr $0 HKLM "WOW6432Node\${MANUPRODUCTKEY}" ""
  ${EndIf}

  ; 0b. Uninstall record written by this installer's template — QUOTED, so it
  ;     must go through AlphaNormalizeInstDir.
  ;     v2.2.0-alpha: the P4 rename also changed the NSIS uninstall-record key
  ;     from the identifier-based "com.sigma-file-manager.app_is1" to the
  ;     productName-based "Alpha File Manager". Detection then only read the
  ;     OLD name, so it missed a live install and let a reinstall fall through
  ;     to the default C:\Program Files — leaving the user's previous folder
  ;     (e.g. D:\) behind as an orphan directory nothing ever cleans up.
  ;     Check the current name FIRST, then fall back to the legacy ones.
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}_is1" "InstallLocation"
  ${EndIf}

  ; 1. Identifier-based record left by pre-rename builds of this fork
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}_is1" "InstallLocation"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${BUNDLEID}_is1" "InstallLocation"
  ${EndIf}

  ; 2. Legacy makensis registry key (upstream AppName)
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Sigma File Manager_is1" "InstallLocation"
  ${EndIf}

  ; 3. Filesystem probe — covers cases where the previous installer didn't
  ;    write the registry (e.g. portable extract, or wiped uninstall key).
  ${If} $0 == ""
    ${If} ${FileExists} "$PROGRAMFILES\Sigma File Manager\Sigma File Manager\Sigma File Manager.exe"
      StrCpy $0 "$PROGRAMFILES\Sigma File Manager\Sigma File Manager"
    ${ElseIf} ${FileExists} "$PROGRAMFILES\Sigma File Manager\Sigma File Manager.exe"
      StrCpy $0 "$PROGRAMFILES\Sigma File Manager"
    ${ElseIf} ${FileExists} "$PROGRAMFILES\Sigma File Manager.exe"
      StrCpy $0 "$PROGRAMFILES"
    ${EndIf}
  ${EndIf}

  ${If} $0 != ""
    ; Move the raw candidate into $1 (unquoted on purpose: $0 still carries
    ; Tauri's literal quote characters, and StrCpy strips one quote layer,
    ; which is exactly what we want before normalize() sees it).
    StrCpy $1 $0
    DetailPrint "==> [PREINSTALL HOOK] Existing-install candidate: $1"
    Call AlphaNormalizeInstDir
    ${If} $0 == "ok"
      DetailPrint "==> [PREINSTALL HOOK] Reusing InstallDir (smart-upgrade): $1"
      ; Safe to quote here: AlphaNormalizeInstDir guarantees $1 contains no
      ; quote characters, so this cannot re-create the nested-quote bug.
      StrCpy $INSTDIR "$1"
      ; ---------------------------------------------------------------
      ; Re-issue SetOutPath. The generated installer.nsi does
      ;     Section Install
      ;       SetOutPath $INSTDIR
      ;       !insertmacro NSIS_HOOK_PREINSTALL     <-- we change $INSTDIR HERE
      ;       ...
      ;       File "${MAINBINARYSRCPATH}"           <-- writes to $OUTDIR
      ; so $OUTDIR was frozen from the PRE-hook value. On a machine whose
      ; record was still corrupted, that value is a drive-relative path
      ; ("D\Program Files\..."), NSIS resolves it against the drive's current
      ; directory, and the main executable is written somewhere else (or not
      ; at all) while registry keys and shortcuts -- which use $INSTDIR
      ; explicitly -- all look perfectly correct.
      ; Measured on this machine: the very first install after this fix ran
      ; left the 2.2.0 exe in place (silent no-op), and the next run, by which
      ; time the registry had been repaired, wrote 2.2.1 correctly. Without
      ; this line the failure only affects the FIRST upgrade on a corrupted
      ; install -- i.e. exactly the users who need the upgrade most.
      ; ---------------------------------------------------------------
      SetOutPath "$INSTDIR"
    ${Else}
      DetailPrint "==> [PREINSTALL HOOK] Candidate is not an absolute drive path after normalize; ignored."
      DetailPrint "==> [PREINSTALL HOOK] Keeping built-in default: $INSTDIR"
    ${EndIf}
  ${Else}
    DetailPrint "==> [PREINSTALL HOOK] No existing Alpha FM / Sigma FM install detected; using default path ($INSTDIR)."
  ${EndIf}
  DetailPrint "==> [PREINSTALL HOOK END] $INSTDIR (after detection) = $INSTDIR"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "==> [POSTINSTALL HOOK START] Deploying kizemo.focus-sync v0.3.0 (Scheduled Task mode) ..."

  ; ---------------------------------------------------------------------
  ; v2.2.0-beta (2026-10-10): repair the uninstall record's InstallLocation.
  ; Tauri's template writes it as a QUOTED string
  ;     WriteRegStr SHCTX "${UNINSTKEY}" "InstallLocation" "$\"$INSTDIR$\""
  ; Our PREINSTALL used to read that back raw, and the quotes silently ate
  ; the drive colon (see AlphaNormalizeInstDir). Rewriting it unquoted:
  ;   * makes Add/Remove Programs display a real path instead of a quoted one
  ;   * removes the trap for every future reader, including Tauri's own
  ;     template on the next upgrade
  ; NSIS uninstallers do NOT read this value (they embed $INSTDIR in the
  ; uninstaller itself), so this is safe to rewrite.
  ; ---------------------------------------------------------------------
  WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation" "$INSTDIR"
  DetailPrint "==> [POSTINSTALL HOOK] Rewrote InstallLocation unquoted: $INSTDIR"

  ; ---------------------------------------------------------------------
  ; STAGE 0 (round 19d): Resolve the ORIGINAL USER's %APPDATA% before any
  ; file writes or registration. A perMachine installer runs in admin
  ; context, so NSIS's $APPDATA resolves to admin's profile, NOT the
  ; original user's. If we wrote to $APPDATA and the original user is
  ; different, Sigma FM (running as user) would never see the files.
  ;
  ; resolve_user_appdata.ps1 queries WMI for the active console session
  ; user (explorer.exe owner) and writes USER_APPDATA=<path>\AppData\Roaming
  ; to a temp file. Falls back to $env:USERPROFILE\AppData\Roaming if WMI is
  ; unavailable.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 0: Resolving original user's %APPDATA% (round 19d fix)..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\tools\resolve_user_appdata.ps1" -OutFile "$INSTDIR\tools\user_appdata.txt"'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "==> WARNING: resolve_user_appdata.ps1 exited with code $0"
    DetailPrint "    Falling back to PowerShell $$env:USERPROFILE\AppData\Roaming"
    ; "$$env:..." is required: NSIS parses "$env:USERPROFILE\AppData\Roaming"
    ; as ONE variable name (it allows ':' and '\' in names), swallows the whole
    ; thing and emits nothing. The command then resolved APPDATA to the empty
    ; string "\AppData\Roaming" and wrote the extension to a bogus path --
    ; installed, registered nowhere, i.e. "installed but no functionality".
    nsExec::ExecToLog 'powershell -NoProfile -Command "Write-Output USER_APPDATA=$$env:USERPROFILE\AppData\Roaming | Out-File -FilePath $INSTDIR\tools\user_appdata.txt -Encoding ASCII -Force"'
    Pop $0
    FileOpen $R0 "$INSTDIR\tools\user_appdata.txt" r
    ${If} $R0 == ""
      DetailPrint "==> FATAL: Could not resolve APPDATA via fallback PowerShell"
      StrCpy $RESOLVEDAPPDATA "$PROFILE\AppData\Roaming"
    ${Else}
      FileRead $R0 $R1
      FileClose $R0
      StrCpy $RESOLVEDAPPDATA $R1 "" 13
      DetailPrint "==> Fallback resolved: $RESOLVEDAPPDATA"
    ${EndIf}
  ${Else}
    FileOpen $R0 "$INSTDIR\tools\user_appdata.txt" r
    ${If} $R0 == ""
      DetailPrint "==> WARNING: Could not open user_appdata.txt; using $PROFILE\AppData\Roaming"
      StrCpy $RESOLVEDAPPDATA "$PROFILE\AppData\Roaming"
    ${Else}
      FileRead $R0 $R1
      FileClose $R0
      ; $R1 should be "USER_APPDATA=C:\Users\..." — strip the 13-char prefix
      StrCpy $RESOLVEDAPPDATA $R1 "" 13
      ${If} ${FileExists} "$RESOLVEDAPPDATA"
        DetailPrint "==> Resolved RESOLVEDAPPDATA=$RESOLVEDAPPDATA (verified directory)"
      ${Else}
        DetailPrint "==> WARNING: Resolved RESOLVEDAPPDATA=$RESOLVEDAPPDATA does NOT exist on disk"
        DetailPrint "    Falling back to $PROFILE\AppData\Roaming"
        StrCpy $RESOLVEDAPPDATA "$PROFILE\AppData\Roaming"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; ---------------------------------------------------------------------
  ; STAGE 0.5 (v0.3.0 focus-sync): Kill any legacy v0.2.0 spawn-mode sidecar
  ; process. v2 review V3.5: precise PowerShell path filter (NOT wildcard
  ; "*kizemo*") to avoid killing unrelated processes. Without this, the
  ; 37421 port would be held by the old binary, and the new Scheduled Task
  ; would fail-fast exit 0 at startup (see T1.1 config.rs).
  ;
  ; The /IM filter requires the exact exe name; the PS Where-Object filters
  ; by Path to confirm it's our binary before killing.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 0.5: Killing legacy v0.2.0 spawn-mode sidecar (precise path filter)..."
  ; "$$_" is required: NSIS expands a bare "$_" as an (empty) variable, which
  ; turns this filter into the invalid "Where-Object { .Path -like ... }". The
  ; command then failed to parse and this stage silently did nothing -- the old
  ; sidecar survived, kept port 37421, and the new Scheduled Task failed fast.
  ; makensis reported this as "warning 6000", but the Tauri bundler swallows
  ; makensis warnings, so it was invisible in the build log.
  nsExec::ExecToLog 'powershell -NoProfile -Command "Get-Process focus-sync-sidecar,spike -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like ''*\Alpha File Manager\tools\focus-sync-sidecar.exe'' -or $$_.Path -like ''*\Sigma File Manager\tools\focus-sync-sidecar.exe'' -or $$_.Path -like ''*\kizemo.focus-sync\bin\focus-sync-sidecar.exe'' } | Stop-Process -Force"'
  Pop $0
  ; Non-zero exit is fine (no process to kill is success-equivalent)

  ; v0.5.1 (2026-10-05): Also kill any Scheduled-Task-launched sidecar. The
  ; binary at $INSTDIR\tools\focus-sync-sidecar.exe is launched by the
  ; task as `spike.exe` (Cargo.toml [[bin]] name = "spike"). PREINSTALL
  ; above also kills it; this is belt-and-suspenders for the install case.
  nsExec::ExecToLog 'taskkill /F /IM spike.exe /T 2>nul'
  Pop $0

  ; ---------------------------------------------------------------------
  ; STAGE 1-3 (unchanged from v0.2.0): Copy extension files to APPDATA.
  ; These files are still read by Sigma FM's extension runtime at startup.
  ; The binaries[] segment is now EMPTY in package.json (v0.3.0), so Sigma FM
  ; will NOT try to spawn the sidecar — that's now done by Task Scheduler.
  ; ---------------------------------------------------------------------

  ; 1. Extension package.json (parent dir auto-created by SetOutPath)
  SetOutPath "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync"
  CopyFiles /SILENT "$INSTDIR\extensions\kizemo.focus-sync\package.json" \
                    "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\package.json"

  ; 2. Extension dist/* (index.js + .map)
  SetOutPath "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\dist"
  CopyFiles /SILENT "$INSTDIR\extensions\kizemo.focus-sync\dist\index.js" \
                    "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\dist\index.js"
  CopyFiles /SILENT "$INSTDIR\extensions\kizemo.focus-sync\dist\index.js.map" \
                    "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\dist\index.js.map"

  ; 3. Extension locales/*
  SetOutPath "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\locales"
  CopyFiles /SILENT "$INSTDIR\extensions\kizemo.focus-sync\locales\en.json" \
                    "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\locales\en.json"
  CopyFiles /SILENT "$INSTDIR\extensions\kizemo.focus-sync\locales\zh-CN.json" \
                    "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\locales\zh-CN.json"

  ; ---------------------------------------------------------------------
  ; STAGE 4 (v0.3.0 focus-sync): STAGES 4 AND 5 (APPDA TA binary copy) REMOVED.
  ; Sigma FM no longer needs the sidecar binary in APPDATA — Scheduled Task
  ; launches it from $INSTDIR\tools\ directly.
  ;
  ; Old v0.2.0 binaries in APPDATA are stale; if user later downgrades to
  ; v0.2.0 they would resurrect — but that's outside our supported scope.
  ; ---------------------------------------------------------------------

  ; ---------------------------------------------------------------------
  ; STAGE 6 (unchanged): Register extension in user-extensions.json
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 6: Registering extension in user-extensions.json..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\tools\register.ps1" -UserAppData "$RESOLVEDAPPDATA"'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "==> WARNING: register.ps1 exited with code $0."
    DetailPrint "    Files were copied, but the extension may not appear in Sigma FM's Installed tab."
  ${Else}
    DetailPrint "==> Registration successful."
  ${EndIf}

  ; ---------------------------------------------------------------------
  ; STAGE 7 (v0.3.0 focus-sync): deploy the sidecar to the CANONICAL path.
  ;
  ; 2026-10-08: this used to keep the sidecar at $INSTDIR\tools\ and point the
  ; Scheduled Task there. That created a SECOND canonical path -- the standalone
  ; installer, manual-install.ps1, register.ps1's canonical probe and the sha
  ; gate all use the per-user extension bin\ dir. Two paths meant installing A
  ; then B silently repointed the task, left an orphan binary, and made the
  ; acceptance gate unsatisfiable. Tauri extracts bundle.resources into $INSTDIR
  ; anyway, so copy FROM there TO the canonical path, then drop the duplicate.
  ; The canonical path is per-user, so no admin rights are required.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 7: Deploying sidecar to the canonical per-user path..."
  ${IfNot} ${FileExists} "$INSTDIR\tools\focus-sync-sidecar.exe"
    DetailPrint "==> WARNING: sidecar binary missing from installer resources."
    DetailPrint "    Sigma FM Focus Sync extension will not function (Task Scheduler creation skipped)."
    Goto stage9_skip
  ${EndIf}

  CreateDirectory "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar"
  CopyFiles "$INSTDIR\tools\focus-sync-sidecar.exe" "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
  ${IfNot} ${FileExists} "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
    DetailPrint "==> ERROR: failed to copy sidecar to the canonical path."
    Goto stage9_skip
  ${EndIf}
  DetailPrint "    Sidecar deployed to canonical path."

  ; ---------------------------------------------------------------------
  ; STAGE 8 (v0.3.0 focus-sync): Write registry key SidecarPath.
  ; v2 review §V-Q2: use HKLM\SOFTWARE\kizemo\focus-sync\ (NOT
  ; "Sigma FM\FocusSync\") for cross-installer consistency.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 8: Writing SidecarPath registry key..."
  WriteRegStr HKLM "SOFTWARE\kizemo\focus-sync" "SidecarPath" "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"

  ; ---------------------------------------------------------------------
  ; STAGE 9 (v0.3.0 focus-sync): Register Scheduled Task via PS helper.
  ; The PS helper handles idempotent create, cross-installer path-change
  ; detection (v2 M2), and --service flag injection (v3 V3.22).
  ;
  ; We invoke the PS via $INSTDIR\tools\register-scheduled-task.ps1 which
  ; is bundled into the installer by tauri.conf.json bundle.resources.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 9: Registering Scheduled Task 'KizemoFocusSync'..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\tools\register-scheduled-task.ps1" -SidecarPath "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "==> WARNING: register-scheduled-task.ps1 exited with code $0"
    DetailPrint "    Scheduled Task may not be created. Run manually: schtasks /Create ..."
  ${EndIf}

  ; Drop the duplicate now that the task points at the canonical copy, so a
  ; later install cannot silently fall back to a stale binary.
  Delete "$INSTDIR\tools\focus-sync-sidecar.exe"
  DetailPrint "    Removed the duplicate copy from $INSTDIR\tools\."

  stage9_skip:

  ; ---------------------------------------------------------------------
  ; v2.2.0-alpha (2026-10-09): remove the legacy main binary.
  ; The exe is named from the Cargo package name, which was renamed
  ; sigma-file-manager.exe -> alpha-file-manager.exe. NSIS only manages the
  ; files it wrote, so an in-place upgrade would otherwise leave a ~44 MB
  ; orphan "sigma-file-manager.exe" next to the new one -- two launchers,
  ; and the stale one would keep resurrecting on any old shortcut.
  ; Placed AFTER stage9_skip so the Goto above cannot bypass it.
  ; ---------------------------------------------------------------------
  ${If} ${FileExists} "$INSTDIR\alpha-file-manager.exe"
    ${If} ${FileExists} "$INSTDIR\sigma-file-manager.exe"
      Delete "$INSTDIR\sigma-file-manager.exe"
      ${If} ${FileExists} "$INSTDIR\sigma-file-manager.exe"
        DetailPrint "==> WARNING: legacy sigma-file-manager.exe could not be removed."
      ${Else}
        DetailPrint "==> Removed legacy sigma-file-manager.exe from $INSTDIR."
      ${EndIf}
    ${EndIf}
  ${EndIf}

  DetailPrint "==> [POSTINSTALL HOOK END] Deployed kizemo.focus-sync v0.3.0"
  DetailPrint "    Extension files: $RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\"
  DetailPrint "    Sidecar binary:  $RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe (canonical, per-user)"
  DetailPrint "    Registry:        HKLM\SOFTWARE\kizemo\focus-sync\SidecarPath"
  DetailPrint "    Scheduled Task:  KizemoFocusSync (AtLogOn, --service mode)"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Tauri already kills the app. We additionally need to kill the focus-sync
  ; sidecar (`spike.exe`) and disable its Scheduled Task so NSIS can
  ; delete the sidecar binary and remove the Scheduled Task without
  ; "file in use" errors.
  DetailPrint "==> [PREUNINSTALL HOOK] Killing focus-sync sidecar (spike.exe) ..."
  nsExec::ExecToLog 'taskkill /F /IM spike.exe /T'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM focus-sync-sidecar.exe /T'
  Pop $0
  ; Disable so it doesn't respawn during file deletion.
  nsExec::ExecToLog 'schtasks /Change /TN "\KizemoFocusSync" /DISABLE 2>nul'
  Pop $0
  ; v0.5.2: also kill any residual app processes (if user is uninstalling
  ; only the extension, the app might still be running with WebView2 children
  ; holding extension files). Belt-and-suspenders.
  nsExec::ExecToLog 'taskkill /F /IM alpha-file-manager.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM sigma-file-manager.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManager.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM "Sigma File Manager.exe" /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManagerHelper.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM SigmaFileManagerRenderer.exe /T 2>nul'
  Pop $0
  nsExec::ExecToLog 'taskkill /F /IM msedgewebview2.exe /T 2>nul'
  Pop $0
  ; Brief settle delay so the process can release any open handles.
  Sleep 1000
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "==> [POSTUNINSTALL HOOK START] Removing kizemo.focus-sync v0.3.0 ..."

  ; Round 19d: resolve the original user's APPDATA before cleanup. Uninstall
  ; also runs in admin context, so we need the same WMI-based path resolution
  ; to delete from the correct user profile (where POSTINSTALL actually wrote).
  DetailPrint "==> Stage 0: Resolving original user's %APPDATA% for cleanup..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\tools\resolve_user_appdata.ps1" -OutFile "$INSTDIR\tools\user_appdata_uninst.txt"'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "==> WARNING: resolve_user_appdata.ps1 failed during uninstall (code $0)"
    DetailPrint "    Falling back to PowerShell $$env:USERPROFILE\AppData\Roaming"
    nsExec::ExecToLog 'powershell -NoProfile -Command "Write-Output USER_APPDATA=$$env:USERPROFILE\AppData\Roaming | Out-File -FilePath $INSTDIR\tools\user_appdata_uninst.txt -Encoding ASCII -Force"'
    Pop $0
    FileOpen $R0 "$INSTDIR\tools\user_appdata_uninst.txt" r
    ${If} $R0 == ""
      StrCpy $RESOLVEDAPPDATA "$PROFILE\AppData\Roaming"
    ${Else}
      FileRead $R0 $R1
      FileClose $R0
      StrCpy $RESOLVEDAPPDATA $R1 "" 13
      DetailPrint "==> Fallback resolved for cleanup: $RESOLVEDAPPDATA"
    ${EndIf}
  ${Else}
    FileOpen $R0 "$INSTDIR\tools\user_appdata_uninst.txt" r
    ${If} $R0 == ""
      StrCpy $RESOLVEDAPPDATA "$PROFILE\AppData\Roaming"
    ${Else}
      FileRead $R0 $R1
      FileClose $R0
      StrCpy $RESOLVEDAPPDATA $R1 "" 13
      DetailPrint "==> Resolved RESOLVEDAPPDATA for cleanup=$RESOLVEDAPPDATA"
    ${EndIf}
  ${EndIf}

  RMDir /r "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync"
  RMDir /r "$RESOLVEDAPPDATA\com.sigma-file-manager.app\binaries\focus-sync-sidecar"

  ; ---------------------------------------------------------------------
  ; STAGE 1 (v0.3.0 focus-sync): Unregister Scheduled Task + kill orphan.
  ; The PS helper handles idempotent delete, kill orphan sidecar process
  ; (v2 review S4 fix), and precise path filter (v3 review V3.5).
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 1: Unregistering Scheduled Task and killing orphan sidecar..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\tools\unregister-scheduled-task.ps1"'
  Pop $0
  ${If} $0 != "0"
    DetailPrint "==> WARNING: unregister-scheduled-task.ps1 exited with code $0"
  ${EndIf}

  ; ---------------------------------------------------------------------
  ; STAGE 2 (v0.3.0 focus-sync): Delete registry key SidecarPath.
  ; Note: HKLM keys are deleted here even if the original user is different
  ; (the key is perMachine).
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 2: Deleting SidecarPath registry key..."
  DeleteRegKey HKLM "SOFTWARE\kizemo\focus-sync"

  ; ---------------------------------------------------------------------
  ; STAGE 3 (v2.2.0-alpha): remove runtime-generated leftovers under $INSTDIR.
  ;
  ; NSIS only deletes files recorded in its own install manifest. The
  ; resolve_user_appdata.ps1 outputs (user_appdata.txt, user_appdata_uninst.txt)
  ; are produced by PowerShell at install/uninstall time and are never in that
  ; manifest, so neither they nor the tools\ directory holding them survive an
  ; uninstall -- the user is left with an orphaned folder and has to remove it
  ; by hand.
  ;
  ; Delete first, then RMDir, and re-probe afterwards: a silent leftover is
  ; exactly the failure mode this stage exists to prevent, so a still-present
  ; directory is reported rather than passed over in silence.
  ; ---------------------------------------------------------------------
  DetailPrint "==> Stage 3: Removing runtime-generated files under $INSTDIR..."
  Delete "$INSTDIR\tools\user_appdata.txt"
  Delete "$INSTDIR\tools\user_appdata_uninst.txt"
  RMDir /r "$INSTDIR\tools"
  RMDir "$INSTDIR"

  ${If} ${FileExists} "$INSTDIR\tools\user_appdata.txt"
    DetailPrint "==> WARNING: $INSTDIR\tools\user_appdata.txt survived (file locked?)."
  ${ElseIf} ${FileExists} "$INSTDIR\tools"
    DetailPrint "==> WARNING: $INSTDIR\tools survived (directory locked?)."
  ${ElseIf} ${FileExists} "$INSTDIR"
    DetailPrint "==> WARNING: $INSTDIR survived (locked?)."
  ${Else}
    DetailPrint "==> $INSTDIR fully removed."
  ${EndIf}

  DetailPrint "==> [POSTUNINSTALL HOOK END] Cleanup complete (extension, sidecar binary, task, registry, install dir)."
!macroend
