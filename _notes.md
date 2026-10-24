## 3.6.0:删不掉的文件,现在有专门的一条路

Windows 删文件失败时只给你一句话:「操作无法完成,因为文件已在另一程序中打开。」
然后你就卡在那儿了 —— 不知道是谁占着它,也不知道除了关掉那个程序还能怎么办。
这一版把这条路的两个环节都补上了,而且**不用额外装任何东西**。

---

### 第一件:解除文件锁定 —— 先问清楚是谁占着它

新加的「解除文件锁定」会问 Windows **到底哪些程序开着这个文件**,把它们连
进程号一起列出来 —— 是编辑器、是备份软件、还是一个卡住的服务,一眼能认出来。
同一个对话框里可以结束其中任何一个,结束完应用会重新探一次,告诉你这个文件
现在删得掉删不掉。

**它自己从不删任何东西。** 它只把挡路的清掉 —— 只读位、占着文件的程序 ——
然后把「空出来了」这件事告诉你。真正要删文件,那是「彻底删除」的事。

查占用者用的是 Windows 自带的 Restart Manager(`rstrtmgr.dll`),**不需要额外
装任何东西**。

### 第二件:彻底删除 —— 三步递进,每步都如实回报

有些文件怎么试都删不掉:它本身是只读的,或者有个程序开着它、又不允许别人删。
「彻底删除」按代价从低到高试三步:

1. **清只读位。** 只读文件用普通删除会报「操作无法完成」,去掉只读位往往就删了。
2. **标记删除。** 文件还被占着的话,把它标记成「等最后一个句柄关掉就删」——
   占用程序一放手,文件当场消失,**不用重启**。
3. **登记为重启后删除。** 连标记删除都被拒绝(内核态驱动占着、或者文件系统
   不认这个操作),就登记给 Windows,让它下次启动时删掉。**这一步需要管理员权限。**

三步都失败时会**如实报错**,不会假装文件已经没了。

清只读位时只清只读位,**隐藏位与系统位原样保留** —— 清掉隐藏位会让文件在
资源管理器里凭空冒出来,那是副作用,不是本意。

---

### 为什么一个外部依赖都没加

调研了 GitHub 上的同类方案:`P4suta/restart-manager`(Rust 包装,MIT/Apache-2.0,
但只有 2 star、零 fork)、`sjp/Sherlock`(C#)、`mantvmass/file-lock-checker`(Rust)、
Process Hacker / System Informer(内核驱动路线)、NirSoft Unlocker 与
Sysinternals handle.exe(闭源,不可嵌入)。

结论是**一个都不需要引**:

- 本仓已经依赖 `windows` crate 0.58,而它的 `Win32_System_RestartManager` 模块
  **已经把 Restart Manager 整套 API 编译进本地 registry 了**(`RmStartSession` /
  `RmRegisterResources` / `RmGetList` / `RmShutdown` / `RmEndSession`),只是
  Cargo feature 没开;
- `Win32_Storage_FileSystem` 里已有 `SetFileInformationByHandle` +
  `FILE_DISPOSITION_INFO_EX` + `FILE_DISPOSITION_FLAG_DELETE`,这是「标记删除」
  的正规做法;
- `Win32_System_Threading` 里已有 `OpenProcess` / `TerminateProcess`。

所以这一版只是**调用已经躺在依赖树里的 API**,Cargo.toml 只多一行 feature。
对比之下 `restart-manager` 那个 crate 自己也承认它包的就是同一套 API,而它只有
2 star —— 引进来反而多一份要维护的依赖与 MSRV 风险。内核驱动路线则要处理驱动
签名与安全评审,成本与本项目的体量不匹配。

---

### 顺带修掉的:仓库在 HEAD 上打包不出来

有一个测试文件用错了 Node 的类型(`ReturnType<typeof readdirSync>` 取到的是
Buffer 重载),于是 `vue-tsc` 报 5 条类型错误,`tauri build` 的
`beforeBuildCommand` 直接失败 —— **仓库在 main 分支上根本构建不出安装包**。
改好之后 `vue-tsc --build` 完全干净。

### 这一版是怎么验的

- **算法层与命令层分成两个文件。** `file_lock.rs`(算法本体)刻意不引用
  `tauri::AppHandle` 与 `tauri::async_runtime::*` —— 那是 `cargo test --lib` 的
  隐形红线(会把 tao 的窗口链拖进测试二进制,进程在加载期以
  `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉)。所以有 7 条用例是真的建文件、真的开
  句柄、真的调 Win32 API:Restart Manager 真的能查出占用进程、空闲文件查不出
  占用者、被独占占用时如实报错不假装成功、解锁成功后**文件仍在**、只读文件
  清位后可删。
- **真实机器上用打包产物验**(`tauri build` 的产物,不是 `tauri dev` —— 本项目
  的 dev 构建路由页内容区全空白,界面结论一律作废):右键菜单里两项都在;弹框
  列出的占用者与注入的持锁进程 PID 一致;仍被占用时点解锁会如实报「文件仍被
  其他程序占用」;结束占用进程后解锁成功且**文件仍在**;彻底删除能删掉空闲
  文件、只读文件与已解锁的文件;对仍被占用的文件会退到「已登记为重启后删除」。
- **门禁**:`cargo test --lib` 809 例全过;`vitest` 243 文件 / 2201 用例全过;
  `eslint .` 188 errors 与基线逐条相同(零新增);`vue-tsc --build` 0 错误。

### 这个版本不是什么

- **不处理远程文件。** 服务器上的文件锁不在本机,本地手段对它没有意义,
  所以远程条目上根本不出现这两项。
- **不是内核级的解锁器。** 占着文件的是内核态驱动时,只能退到「重启后删除」。
- **不支持一次解锁一整棵树。** 递归枚举占用者的收益与复杂度不成比例。
- **不新增任何外部依赖。**
