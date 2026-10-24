## 3.5.1: the installer stops claiming someone else's name, and the repository page gets fixed

**Summary:** The installer now records this project's own publisher instead of the name of the project it was forked from, which is what lets the program be listed in the Windows Package Manager and be upgraded in place. The repository page itself is repaired too: the comparison table between the three file managers is a table again, the licence is the actual GPL-3.0 text so the repository is labelled GPL-3.0 rather than "NOASSERTION", and the automatic winget submission points at this repository's own package id instead of the upstream one.

---

### 第一件:安装器里挂的是别人的名字

Windows 的"应用和功能"、以及 Windows 包管理器,认的是安装器写进注册表的那个
`Publisher` 字段。这个字段是从上游继承下来的 —— 也就是说,你在"应用和功能"里
看到的发布者是上游项目的名字,不是 Alpha File Manager 自己的。

这不只是好不好看的问题。包管理器靠 `发布者 + 程序名 + 版本号` 三样对上号,才
知道自己装的这份和清单里那一份是同一个程序;对不上,它就认为你机器上装的是
一个"没见过的软件",升级也不会把它认出来。

现在这个字段写的是本项目自己的发布者 `kizemo`,与 winget 清单里的 `Publisher`
完全一致。顺带修好的还有一处隐患:源码里有一行注释中间夹了一个裸的换行符
(CR),平时看不出来,但任何编辑器在保存时规范化行尾,都会把那一行劈成两半,
后半句变成裸代码,整个工程直接编译不过 —— 注释被切断这件事,本来就该修。

### 第二件:仓库页面的表格根本不是表格

README 里那张"三款文件管理器对比"表,表头是五列,下面那行分隔线却只有四段。
GitHub 的 Markdown 解析器遇到这种情况,会把整块当成普通段落 —— 于是页面上
看到的不是表格,是一堆竖线。

原因是当时重写 README 时只按内容写了表头,没按列数对齐分隔行。现在补齐了,
并且加了一条常驻门禁:它会解析仓库里所有 Markdown 文件的表格,逐表核对表头、
分隔行和数据行的列数,不一致就红。门禁自带"故意喂坏输入"的负向用例,保证它
自己还能变红 —— 一道永远绿的检查等于没有检查。

### 第三件:许可证 GitHub 认不出来

`LICENSE.md` 之前是一份手写的摘要,不是许可证原文。GitHub 靠匹配许可证原文
来识别协议,匹配不上就在侧栏写 `NOASSERTION`。现在是 GPL-3.0 的规范原文
(35,149 字节 / 675 行),版权与致谢声明移到新的 `NOTICE.md`,仓库侧栏显示
GPL-3.0。

### 第四件:仓库门面重写

README 之前接近 50 KB,大半是一面更新日志墙,把项目本身的介绍挤到了第二屏。
现在它是一份能看完的页面:门面图、徽章、Highlights、五组功能表、下载矩阵,
以及"从源码构建"和社区入口。中文版同步重写。

### 第五件:自动发布到 winget 的工作流指错了地方

`.github/workflows/winget.yml` 里还留着上游的包 ID 和上游的安装包文件名规则。
真跑起来,我们的二进制会以"更新上游包"的名义提交上去。现在包 ID 是
`kizemo.AlphaFileManager`,资产名规则也换成本仓库实际产出的名字。

### 第六件:包元数据还指向上游

`Cargo.toml` 的 `authors` 与 `repository`、HTTP User-Agent 里写的仓库地址、
Flatpak 的主页与问题反馈链接,全都还是上游项目的。现在都指向本仓库。
