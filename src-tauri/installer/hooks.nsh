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
; 2026-10-19 单实例守卫用的变量。
;
; AlphaSingleInstanceDuplicate = 1 表示「本安装器是重复实例，应当退出」。
; AlphaSilentMode              = 1 表示安装器以 /S 静默模式运行（没有界面，
;                               弹模态框会永远卡住）。
; AlphaTempOption              是 GetOptions 的临时落点。
; -----------------------------------------------------------------------
Var AlphaSingleInstanceDuplicate
Var AlphaSilentMode
Var AlphaTempOption

; -----------------------------------------------------------------------
; 2026-10-22 安装日志用的变量。
;
; AlphaDetectedVersion   = 既有安装的版本号（没检测到就是空）
; AlphaDetectedLocation  = 既有安装的位置（没检测到就是空）
; AlphaLogPhase          = 写日志时标注的阶段
; AlphaLogInstDir        = 本次安装最终选定的目录
;
; 为什么要有这份日志：安装器此前**只**有两个持久日志（单实例守卫日志、
; 杀进程日志），**安装器自己的决定一个都没落盘** —— 装了哪个目录、检测到
; 既有安装没有、既有版本是几、这次是不是同版本重装、最后有没有装完，
; 全都只能靠猜。于是「我装完又装了一次，怎么像是激活了在线更新」这类
; 问题无法从产物上回答：日志能证明「没有并发安装器」，却答不出版本。
; -----------------------------------------------------------------------
Var AlphaDetectedVersion
Var AlphaDetectedLocation
Var AlphaLogPhase
Var AlphaLogInstDir

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

; -----------------------------------------------------------------------
; AlphaTerminateAppProcesses — 终止 Alpha/Sigma FM 及其整棵子进程树，
; 但绝不碰调用者（安装器或卸载器）自己的子树。
;
; 存在的理由：旧的实现是一长串 taskkill /F /IM <image> /T。/T 会连整棵
; 子进程树一起杀，而用户在 Alpha 里双击安装包时，安装器本身就是 Alpha 的
; 子进程（alpha-file-manager.exe -> 安装器 -> taskkill.exe），于是安装器在
; PREINSTALL 阶段把自己杀了，中途夭折且不报错。卸载器同理。
;
; PREINSTALL 与 PREUNINSTALL 共用这一个函数，所以内嵌脚本只有一份文本，
; 不存在两处不同步的可能。用 installer/embed-kill-script.mjs --check 校验。
;
; 函数结束后 $0 是 PowerShell 的退出码，调用方据此打日志。
; 函数体放进 !macro，底下包两个薄函数：
;   AlphaTerminateAppProcesses      —— 给 Section Install（PREINSTALL）用
;   un.AlphaTerminateAppProcesses   —— 给 Section Uninstall（PREUNINSTALL）用
; NSIS 规定「从 Uninstall 段调用的函数名必须以 un. 开头」，直接共用一个函数名
; 会报 "Call must be used with function names starting with "un." in the
; uninstall section."。用 !macro 承载函数体是为了内嵌脚本仍然只有一份文本。
; -----------------------------------------------------------------------
!macro AlphaTerminateAppProcessesBody
  ; >>> BEGIN EMBEDDED kill-app-tree.ps1 (generated by installer/embed-kill-script.mjs — DO NOT EDIT BY HAND)
  ; kill-app-tree.ps1 由 makensis 在编译期内嵌，运行期原样解包到
  ; $PLUGINSDIR。File 不经 ANSI 代码页转换，也不做任何转义，
  ; 因此 269 行脚本能逐字节落盘 —— 这正是 FileWrite 方案做不到的。
  File /oname=$PLUGINSDIR\kill-app-tree.ps1 "${__FILEDIR__}\kill-app-tree.ps1"
  ; <<< END EMBEDDED kill-app-tree.ps1

  ; v0.5.11: 不再传 -SelfPid。
  ;
  ; 原来这里写的是 -SelfPid $$0，那是错的：Tauri 模板在 installer.nsi:196 用
  ; `StrCpy $0 0` 把 $0 初始化为 wix_detect 的 EnumRegKey 循环下标，到 PREINSTALL
  ; 时它装的是「本机装了多少个程序」（这台机器是 76），跟安装器自己的 PID 毫无
  ; 关系。于是要么 mandatory 参数绑定失败、脚本在动手之前就退出，要么碰巧命中
  ; 某个目标进程的祖先、把它划进受保护集合 —— 两种情况的可见症状都是
  ; 「Alpha 和 sidecar 全都没被杀掉，安装照常跑完」。
  ;
  ; 现在脚本自己取父进程 PID：nsExec 直接 spawn powershell.exe，所以它的父进程
  ; 就是安装器。这条链路是结构性的，不会再漂。
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\kill-app-tree.ps1"'
  Pop $0
!macroend

Function AlphaTerminateAppProcesses
  !insertmacro AlphaTerminateAppProcessesBody
FunctionEnd

Function un.AlphaTerminateAppProcesses
  !insertmacro AlphaTerminateAppProcessesBody
FunctionEnd

; -----------------------------------------------------------------------
; AlphaCheckSingleInstance — 2026-10-19 单实例守卫。
;
; 真机症状：用户只点了一次安装，同一份安装包却跑起了 6 个安装器进程
; （kill 日志里 15:54:24 同时活着的就有 3 个）。每一个都完整跑一遍 PREINSTALL，
; 每一个都把上一个刚启动的应用杀掉，于是表现为「装完又自动启动一次安装」。
;
; 已逐条排除的仓库内触发源：应用不 spawn setup.exe；自更新只弹 toast、
; 由用户点按钮才运行安装包（且版本比较正确处理预发布号）；NSIS 模板不
; 自重启动；注册表与启动项里没有自启动条目。**触发源在仓库之外**，
; 但产品仍然必须扛得住它 —— 重复的安装器不许杀应用、不许再装一遍。
;
; 规则：**最低 PID 当选**。同一份 setup 可执行文件同时活着多个副本时，
; PID 最小的那个继续安装，其余的立刻退出。
;
; 为什么不用「谁先到谁当选」：那是竞态 —— 两个安装器同时到 PREINSTALL 时
; 可能互相都看不到对方，于是两个都装。最低 PID 当选是确定性的：无论怎么交错，
; **恰好一个**会继续。不死锁、不重装。
;
; 为什么不用互斥体：互斥体要「整个安装期间」持有，而 Tauri 的 NSIS 模板
; 在向导页之前没有任何钩子（只有 PREINSTALL / POSTINSTALL / PREUNINSTALL /
; POSTUNINSTALL 四个，.onInit 是模板自己的、无法覆盖），能拿锁的地方
; 恰好就是现在做检查的地方 —— 锁和选举解决的是同一个问题。
;
; 判定逻辑在 installer/check-single-instance.ps1 里（可单测，见
; installer/_acceptance/test-single-instance-guard.ps1）。本函数只负责
; 把脚本解包出来、跑它、并把「判定为重复」这件事转成一个标记文件。
; 用标记文件而不是读 nsExec 的退出码，是因为 nsExec 的 ExecToLog 不回传
; 退出码，而 ExecToStack 的压栈顺序（先压返回值还是先压输出）不值得赌。
; -----------------------------------------------------------------------
Function AlphaCheckSingleInstance
  StrCpy $AlphaSingleInstanceDuplicate 0

  ; 编译期内嵌原文件、运行期原样解包到 $PLUGINSDIR：字节精确，
  ; 不经 ANSI 代码页转换，也不需要任何转义。
  File /oname=$PLUGINSDIR\check-single-instance.ps1 "${__FILEDIR__}\check-single-instance.ps1"

  ; 先清掉残留的标记文件。这样「脚本根本没跑成」与「判定为重复」两种情况
  ; 彻底分开：跑不成时标记文件不存在，守卫按「放行」处理 ——
  ; 守卫坏了不能变成「谁都装不上」。
  Delete "$PLUGINSDIR\alpha-single-instance-duplicate.flag"
  ClearErrors

  DetailPrint "==> [PREINSTALL HOOK] Checking whether another installer instance is running ..."
  DetailPrint "==> [PREINSTALL HOOK] guard log: $TEMP\alpha-file-manager-installer-guard.log"
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\check-single-instance.ps1" -VerdictFile "$PLUGINSDIR\alpha-single-instance-duplicate.flag"'

  IfFileExists "$PLUGINSDIR\alpha-single-instance-duplicate.flag" 0 alpha_single_instance_done
    StrCpy $AlphaSingleInstanceDuplicate 1
  alpha_single_instance_done:
FunctionEnd

; -----------------------------------------------------------------------
; AlphaLogInstall — 把本次安装的关键事实追加到持久日志。
;
; 日志路径：%TEMP%\alpha-file-manager-install.log（追加，不覆盖）。
;
; 记录的内容：本次安装器自身的版本、检测到的既有安装版本与位置、这次是不是
; 同版本重装、最终选定的安装目录。这几项此前**一个都没有落盘**，于是
; 「装完又装了一次」这类问题无法从产物上回答。
;
; 脚本本体是 write-install-log.ps1（与另外两个助手脚本一样在编译期内嵌、
; 运行期原样解包到 $PLUGINSDIR，不经 ANSI 代码页转换）。
; 时间戳由脚本自己打 —— NSIS 这边拿系统时间不值得赌寄存器。
; -----------------------------------------------------------------------
!macro AlphaLogInstallBody
  File /oname=$PLUGINSDIR\write-install-log.ps1 "${__FILEDIR__}\write-install-log.ps1"
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\write-install-log.ps1" -Phase "$AlphaLogPhase" -InstallerPath "$EXEPATH" -InstDir "$AlphaLogInstDir" -DetectedVersion "$AlphaDetectedVersion" -DetectedLocation "$AlphaDetectedLocation"'
  Pop $2
!macroend

Function AlphaLogInstall
  !insertmacro AlphaLogInstallBody
FunctionEnd

Function un.AlphaLogInstall
  !insertmacro AlphaLogInstallBody
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  ; ---------------------------------------------------------------------
  ; 2026-10-19: 单实例守卫。**必须排在最前面** ——
  ; 后面的 AlphaTerminateAppProcesses 会杀掉当前正在运行的应用，
  ; 而重复的安装器正是「装完又启动一次安装」的元凶：它杀掉了上一个
  ; 安装器刚启动的应用，于是用户看到应用反复重启。
  ; 先判定、先退出，就不会有第二次杀应用。
  ; ---------------------------------------------------------------------
  Call AlphaCheckSingleInstance
  ${If} $AlphaSingleInstanceDuplicate == "1"
    DetailPrint "==> [PREINSTALL HOOK] Another installer instance is already running; this one exits without touching the installation."
    ; 静默模式（/S）下没有界面，弹模态框会把安装永远卡住 —— 没人点它。
    ; 所以只在有界面的情况下才提示。
    StrCpy $AlphaSilentMode 0
    ${GetOptions} $CMDLINE "/S" $AlphaTempOption
    ${IfNot} ${Errors}
      StrCpy $AlphaSilentMode 1
    ${EndIf}
    ${GetOptions} $CMDLINE "/s" $AlphaTempOption
    ${IfNot} ${Errors}
      StrCpy $AlphaSilentMode 1
    ${EndIf}
    ${If} $AlphaSilentMode == "0"
      MessageBox MB_ICONINFORMATION|MB_OK "Another installation of Alpha File Manager is already running.$\n$\nThis installer will close now. The installation that is already running will finish normally."
    ${EndIf}
    Quit
  ${EndIf}
  ; ---------------------------------------------------------------------
  ; ---------------------------------------------------------------------
  ; v0.5.11: 把关键事实落盘。
  ;
  ; 之前唯一的日志是 MUI 进度面板，关掉窗口就没了。想回答「kill 脚本到底跑没跑、
  ; 解析出的调用者 PID 是多少、跳过了哪些 PID」时产物上什么都查不到 —— 只能靠猜，
  ; 而猜出来的原因已经错过两次了。日志没落盘，等于这个环节没有诊断能力。
  ;
  ; 这里**不用** NSIS 的 LogSet：它只接受 on|off，且要求编译期就定义
  ; NSIS_CONFIG_LOG，而那个开关只能通过 makensis 命令行传，Tauri 的 bundler 不给，
  ; 实测报 "LogSet specified, NSIS_CONFIG_LOG not defined." 并中止打包。
  ; 与其为这个去改 Tauri 的构建调用，不如用本文件里已经在用的 FileOpen/FileWrite
  ; 自己写一份 —— 那套写法不依赖任何编译期开关。
  ;
  ; 真正的过程日志（解析出的调用者 PID、目标清单、跳过清单、退出分支）由
  ; kill-app-tree.ps1 写到 %TEMP%\alpha-file-manager-kill.log，那份更详细。
  DetailPrint "==> [PREINSTALL HOOK] kill log: $TEMP\alpha-file-manager-kill.log"
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
  ; ---------------------------------------------------------------------
  ; FORK-MODIFICATION 2026-10-13: 原来这里是一长串
  ;   taskkill /F /IM <image> /T
  ; 全部删掉，换成下面这个按 PID 精确终止的脚本。原因是一个真实故障：
  ;
  ;   /T 的语义是「连同整棵子进程树一起杀」。用户在 Alpha 里双击安装包时，
  ;   进程树是 alpha-file-manager.exe -> 安装器 -> taskkill.exe，
  ;   安装器是 Alpha 的**子进程**，于是这条命令把安装器自己一起杀了，
  ;   安装在 PREINSTALL 阶段当场中断，且不留下任何可读的错误。
  ;
  ; kill-app-tree.ps1 的做法：先给全部进程拍快照，算出
  ; 「受保护集合 = 调用者自己 + 调用者的全部后代」，算出「受害者集合 =
  ; 目标进程 + 目标进程的所有后代」（等价于 /T），把受保护集合扣掉，
  ; 再按「子进程先于父进程」的顺序逐个强杀。
  ;
  ; 两个性质：
  ;   * 从资源管理器启动安装器时（常见情况），受保护集合与受害者集合没有
  ;     交集，行为与原来的 taskkill /T 完全一致 —— WebView2 / crashpad
  ;     那些持有 mmap 的孙进程照样清掉，Tauri 的 CheckIfAppIsRunning 能过；
  ;   * 从 Alpha 里启动时，安装器与它派生的 taskkill / powershell 都在
  ;     受保护集合里，一个都不会被误杀。
  ;
  ; 已用模拟进程树验证：新脚本 4 项断言全过；把同一套用例换回旧的
  ; taskkill /T 跑，安装器（harness）在跑到一半时被杀、连结果文件都没
  ; 写出来 —— 也就是本 bug 的原始形态。
  DetailPrint "==> [PREINSTALL HOOK] Terminating Alpha/Sigma FM and helpers (PID-targeted; installer subtree protected) ..."
  Call AlphaTerminateAppProcesses
  ${If} $0 == "0"
    DetailPrint "==> kill-app-tree.ps1 completed; installer survived."
  ${Else}
    DetailPrint "==> kill-app-tree.ps1 returned $0 (continuing)."
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
  ; spike.exe / focus-sync-sidecar.exe 已经在上面那次调用里一并处理了：
  ; kill-app-tree.ps1 的 HelperImages 默认就包含这两个名字，而且同样受
  ; 「保护安装器自身子树」的约束保护 —— 它们若恰好是安装器的后代，也不会
  ; 被误杀。原来这里是两条 taskkill /T，同样有杀到安装器的风险。
  ; Disable the Scheduled Task so it doesn't auto-respawn the sidecar
  ; during the brief window between kill and file overwrite.
  ;
  ; v0.5.11: 原来这里是 `schtasks /Change /TN "\KizemoFocusSync" /DISABLE 2>nul`，
  ; 2026-10-13 真机安装时报错：
  ;     错误: 无效参数/选项 "-2>null。
  ;     键入 "SCHTASKS /CHANGE /?" 以了解用法。
  ; 原因是 nsExec 直接走 CreateProcess，**中间没有 cmd.exe**，`2>nul` 于是被当成
  ; 一个字面参数递给 schtasks，重定向压根没发生，计划任务也没有被禁用。
  ;
  ; 改用 PowerShell cmdlet：Disable-ScheduledTask 本身就是干这件事的，
  ; 而且 -ErrorAction SilentlyContinue 天然表达「任务不存在就算了」。
  nsExec::ExecToLog 'powershell -NoProfile -Command "Disable-ScheduledTask -TaskName ''KizemoFocusSync'' -ErrorAction SilentlyContinue"'
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

  ; ---------------------------------------------------------------------
  ; 2026-10-22: 记录「既有安装」的版本与位置。
  ;
  ; 有了这两项，安装日志才能回答「这次是不是同版本重装」——
  ; 也就是「我明明装的就是同一个版本，为什么像是又装了一遍」这个问题。
  ; 读的是同一个 Uninstall 键的 DisplayVersion / InstallLocation。
  ; ---------------------------------------------------------------------
  StrCpy $AlphaDetectedVersion ""
  StrCpy $AlphaDetectedLocation ""

  ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayVersion"
  ${If} $2 == ""
    ReadRegStr $2 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "DisplayVersion"
  ${EndIf}

  ${If} $2 != ""
    StrCpy $AlphaDetectedVersion $2
    ReadRegStr $2 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation"
    ${If} $2 == ""
      ReadRegStr $2 HKLM "SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCTNAME}" "InstallLocation"
    ${EndIf}
    StrCpy $AlphaDetectedLocation $2
    DetailPrint "==> [PREINSTALL HOOK] Existing installation detected: version=$AlphaDetectedVersion location=$AlphaDetectedLocation"
  ${Else}
    DetailPrint "==> [PREINSTALL HOOK] No existing installation record found."
  ${EndIf}

  ; 落盘本次安装的第一条记录（此时 $INSTDIR 已定，既有版本也已知）。
  StrCpy $AlphaLogPhase "PREINSTALL"
  StrCpy $AlphaLogInstDir "$INSTDIR"
  Call AlphaLogInstall
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

  ; v0.5.1 (2026-10-05) 在这里还有一条 `taskkill /F /IM spike.exe /T 2>nul`，
  ; v0.5.11 删掉，两个原因：
  ;   1. 镜像名是错的。计划任务启动的是 focus-sync-sidecar.exe（注册时写死了这个
  ;      路径），spike.exe 只是 Cargo 的 bin 名，装完之后根本不存在这个名字。
  ;   2. `2>nul` 在 nsExec 里不成立 —— nsExec 直接走 CreateProcess，中间没有
  ;      cmd.exe，重定向会被当字面参数递给 taskkill。同样的错误在 PREINSTALL 的
  ;      `schtasks ... 2>nul` 上已经被真机抓到过一次。
  ; 现在 PREINSTALL 的 kill-app-tree.ps1（HelperImages 含 focus-sync-sidecar.exe
  ; 与 spike.exe）已经覆盖了这个场景，并且计划任务已在 PREINSTALL 被真正禁用，
  ; 不会在这 30 秒里被拉回来 —— 所以这行既无效又多余。

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
  ;
  ; v0.5.11: 拷贝之前先把目标删掉，并且**确认真的删掉了**。
  ;
  ; 原来这里是直接 CopyFiles，然后只用一个 ${FileExists} 判断成功。但 FileExists
  ; 只回答「这个路径下有没有文件」，不回答「刚才那次拷贝成没成」。目标位置上一版
  ; 的旧二进制还在，拷贝又因为 sidecar 进程占着文件而失败时，FileExists 照样返回
  ; true，于是打印 "Sidecar deployed to canonical path." —— 一次完美的假成功。
  ;
  ; 2026-10-13 真机就是这个结果：安装显示成功、钩子打印部署成功、新二进制还在
  ; $INSTDIR\tools 里等着被 :770 那行 Delete 删掉、用户机器上留下的是 0.5.8，
  ; 而 0.5.10 从这个世界上消失了。静默保留陈旧二进制，正是要消灭的失败模式。
  ;
  ; 删不掉就是真问题（sidecar 还活着且计划任务会拉起它），必须喊出来。
  ClearErrors
  Delete "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
  ${If} ${FileExists} "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
    DetailPrint "==> ERROR: stale sidecar binary is still locked and could not be removed."
    DetailPrint "    The running focus-sync sidecar process is holding it open. Close the"
    DetailPrint "    Scheduled Task \KizemoFocusSync (and the sidecar) and run this"
    DetailPrint "    installer again; otherwise the OLD sidecar would keep being used."
    Goto stage9_skip
  ${EndIf}
  CopyFiles "$INSTDIR\tools\focus-sync-sidecar.exe" "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
  ${IfNot} ${FileExists} "$RESOLVEDAPPDATA\com.sigma-file-manager.app\extensions\kizemo.focus-sync\bin\focus-sync-sidecar\focus-sync-sidecar.exe"
    DetailPrint "==> ERROR: failed to copy sidecar to the canonical path."
    Goto stage9_skip
  ${EndIf}
  DetailPrint "    Sidecar deployed to canonical path (stale copy removed first)."

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

  ; v0.5.11: 显式把 sidecar 拉起来，不要依赖 Register-ScheduledTask 的副作用。
  ;
  ; 实测时间线（2026-10-13 15:10 一轮安装）：PREINSTALL 杀掉 sidecar 并禁用计划
  ; 任务之后，它直到 15:11:33 才重新出现，中间约 45 秒端口 37421 是关的。这 45 秒
  ; 里启动的 Alpha 会在 30 秒启动宽限期到期后弹红色 "Sidecar not reachable" ——
  ; 用户看到的就是「装完自己在报故障」。
  ;
  ; 显式 Start 把恢复动作从「注册任务顺带拉起来的副作用」变成「我们自己负责的动作」。
  nsExec::ExecToLog 'powershell -NoProfile -Command "Start-ScheduledTask -TaskName ''KizemoFocusSync'' -ErrorAction SilentlyContinue"'
  Pop $0
  DetailPrint "==> Stage 9b: requested the sidecar task to start."

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

  ; ---------------------------------------------------------------------
  ; 落盘本次安装的第二条记录（安装已完成）。
  ;
  ; 注意 AlphaDetectedVersion 仍然是 PREINSTALL 阶段读到的**旧**版本 ——
  ; 到这一步模板已经把注册表里的 DisplayVersion 改成新版本了，再读就会变成
  ; 「3.4.0 vs 3.4.0」，同版本重装这个事实就永远看不出来了。
  ; ---------------------------------------------------------------------
  StrCpy $AlphaLogPhase "POSTINSTALL"
  StrCpy $AlphaLogInstDir "$INSTDIR"
  Call AlphaLogInstall
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Tauri already kills the app. We additionally need to kill the focus-sync
  ; sidecar (`spike.exe`) and disable its Scheduled Task so NSIS can
  ; delete the sidecar binary and remove the Scheduled Task without
  ; "file in use" errors.
  DetailPrint "==> [PREUNINSTALL HOOK] Terminating Alpha/Sigma FM, helpers and sidecar (PID-targeted; uninstaller subtree protected) ..."
  Call un.AlphaTerminateAppProcesses
  ${If} $0 != "0"
    DetailPrint "==> WARNING: kill-app-tree.ps1 returned $0 during uninstall"
  ${EndIf}

  ; NOTE: 这里原本还有一条
  ;   taskkill /F /IM msedgewebview2.exe /T 2>nul
  ; 它被删掉了，理由与 PREINSTALL 里删掉同一条一样 —— /IM 按镜像名全盘杀，
  ; 会连带干掉本机其他应用（Edge、桌面组件等）持有的 msedgewebview2.exe。
  ; PREINSTALL 早在 v2.2.0-beta 就因为实测「本机有 6 个别的应用的
  ; msedgewebview2.exe」把它删了，这里却一直留着，属于两处不一致。
  ; kill-app-tree.ps1 只清理「目标进程的子树」，其中自然包含它自己的
  ; WebView2 子进程，既能解锁文件，又不会波及其他应用。
  ; Brief settle delay so the process can release any open handles.
  Sleep 1000

  ; 卸载也要留痕：否则「装了几次、卸了几次」永远说不清。
  StrCpy $AlphaLogPhase "PREUNINSTALL"
  StrCpy $AlphaLogInstDir "$INSTDIR"
  Call un.AlphaLogInstall
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

  StrCpy $AlphaLogPhase "POSTUNINSTALL"
  StrCpy $AlphaLogInstDir "$INSTDIR"
  Call un.AlphaLogInstall
!macroend
