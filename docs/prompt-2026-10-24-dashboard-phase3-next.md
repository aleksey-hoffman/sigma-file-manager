# 接力 prompt · AFM 仪表盘改版阶段 3（2026-10-24）

新开会话时，把下面「主 prompt」整段发过去即可。

---

## 主 prompt（推荐）

先读这 4 份文档建立背景——`F:\soft\00selfmade\filemanager\AGENTS.md`（本项目全部硬约束）、`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-dashboard-phase3-handoff.md`（阶段 3 起点，含全局地图、当前状态、下阶段计划与必读清单）、`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-23-dashboard-card-enrichment.md`（阶段 1/2 的实现与真机验收细节）、`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-23-upstream-sync-and-dashboard-review.md`（upstream 改版评估与 12 条冲突清单）；读完用 10 行以内复述你掌握的项目背景、已锁定原则、当前进度与下阶段待办，**不要开始任何改动、命令或执行动作**，等我下指令。

---

## 短版 prompt（上下文紧张时用）

先读 `F:\soft\00selfmade\filemanager\AGENTS.md` 与 `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-24-dashboard-phase3-handoff.md`（后者已列出其余必读文档的完整路径），读完复述你掌握的背景、进度与下阶段计划后停下等我指令，**不要动手**。

---

## 两版的设计说明

| 要求 | 怎么落实 |
|---|---|
| 引导阅读必要文档 | 主 prompt 点名 4 份；短版只点 2 份，其余靠 handoff 第 6 节的「必读文档清单」引导 |
| 充分掌握背景/目标/进度/下阶段计划 | 全部指向 `handoff-2026-10-24-dashboard-phase3-handoff.md`（该文档第 0/1/2 节是背景与原则，第 4 节是进度快照，第 5 节是下阶段计划） |
| **不重复 handoff 的具体内容** | prompt 只给**路径 + 该读什么**，具体结论一律在文档里，读完由新会话自己复述 |
| 文档提供完整路径 | 全部用绝对路径 |
| 读完不要执行动作、等指令 | 两版都显式写了「不要动手 / 不要开始任何改动、命令或执行动作，等我下指令」 |

---

## 提醒新会话注意的 3 个点

1. **代码在内层仓** `F:\soft\00selfmade\filemanager\sigma-file-manager`（remote `kizemo/alpha-file-manager`）；
   外层 `F:\soft\00selfmade\filemanager` 的 remote 是 `kizemo/focus-sync`，只放 `AGENTS.md` 与历史档，
   **不跟踪内层代码**（`.gitignore` 里明确忽略 `sigma-file-manager/`）。
2. **有两件事必须等用户拍板**（标记页签整体骨架、收藏页签分类侧栏）——
   handoff 第 5.3 节列了，别自己拍。
3. **真机验收只能用 `tauri build` 产物**，`tauri dev` 的路由页内容区全空白，在它上面的界面结论一律作废。
