# 控件图集与换肤

## 1. 需求与情况

**需求**：扩充控件库（现在控件太少），并让控件和物品用统一风格的素材。控件和物品各用一张 2048×2048 图集，方便合批、换肤。提示语、生成过程、每个版本、最终采用的素材都要记录下来，换电脑能接着做。

**当时的情况**：
- 游戏里 `bundles/Skin/` 是 27 张独立的 48 像素小图，是从 v3（奶油底色）切出来再用脚本重画的版本。
- 控件母版 `ui-sheet-v7` 的提示词写明"same pixel craft as the zoo map"，和动物园母图风格一致。
- 素材原来分散在几处，有的不在 git 里：
  - `FFrame/del/`（ui-style 图和提示词、脚本、build）→ 已复制到 `FFrame-asset-line/legacy/FFrame-del/`，已推送。
  - `FFrame-zoo/del/`（506 个文件）→ 已复制到 `FFrame-asset-line/legacy/FFrame-zoo-del/`，已推送。
  - `FFrame-zoo/资源生成/`（523 个文件，其中 357 个 PNG，共 202MB，动物园原始生成素材）→ 不入 GitHub。移到 `FFrame-asset-line/scenes/动物园/资源生成/` 并被 `.gitignore` 忽略，只在本机，换电脑靠 U 盘同步（见第 4 节）。

**已定决策摘要**（完整版和理由见 `docs/specs/控件图集与换肤/共识.md`，共 17 条）：
- 大路径：grilling → 共识 → spec → 逐条 `/implement`。
- 母版风格：`ui-sheet-v7`，对齐动物园母图。
- 分两步、两张图：先控件图，后物品图，各 2048×2048，不共用。
- 换肤：每套主题一个文件夹，运行时按主题名加载。主题目录名 `ZooV7`（当前）、`LegacyV3`（旧版，留着回退）。
- 素材仓库：`FFrame-asset-line`，按 `style/<主题>/` 组织。每个主题下分 `控件/`、`物品/`，各有 `prompt.md`、`history/`、最终图和清单。
- 风格提示语：共用的风格块写在 `style.md`，两步都引用它。
- 尺寸：按设计分辨率 720×1280 的 2 倍出图，运行时显示 1/2。
- 控件 20 件（5 个按钮底板、标题、面板、2 个 tab、滑条轨道和滑块、进度条、经验条、步进底板、格子、选中框、X、问号、加号、减号），另预留约 10 个空槽。
- 物品图标：金币、钻石、能量、广告、音乐、喇叭、齿轮、播放（未用），统一 128×128 源图格子。
- 游戏里旧的 `Skin` 整体移入 `LegacyV3/` 保留。
- **已被用户覆盖的两条**（共识文件暂未改）：
  - 原决定"动物园 `资源生成/` 用 Git LFS 入库"，改为：不入库，放 `FFrame-asset-line/scenes/<场景>/资源生成/`，被忽略，U 盘同步。原因是 GitHub 的 LFS 额度用完了。
  - 原决定"`del/build/` 不迁移"，改为：归档到 `legacy/FFrame-del/build/`，原目录保留未删。

## 2. 尝试

- 对比 `ui-sheet-v3` 和 `ui-sheet-v7`，确认 v7 更接近动物园风格，游戏现在的 `Skin` 是 v3 的重画版。
- 查 `.gitignore`：确认 `del/` 和 `资源生成/` 都被忽略，素材没入库。
- 本机 `git lfs version` 为 3.5.1，已安装。
- 逐条 grilling 17 项决策，每条都给出推荐答案，用户逐条回答，全部记入共识。
- 写 `spec.md` 和 7 张 ticket（01–07）。
- 查代码时发现：`LySetting.prefab`、`LyAlert.prefab`、`ScDemoHome.scene` 直接用 uuid 引用了旧 png，图集改造后会失效，已写进 ticket 05。`ScDemoHome.scene` 引用最多（5 个按钮、2 个 tab、多个图标）。
- 发现控件实际是 **20 件**（包括 4 个按钮上的小图标），之前说的 16 件、17 件有误，已在共识里改正。
- 发现 v7 母版里很多件的尺寸不符合 2 倍规则（例如按钮 288×80），02、03 要重新出图，不能直接放大 v7 的 1024 图。
- 第一次尝试用 AskQuestion 选择框提问，被工具判定为占位，之后改用纯文字逐条提问，符合 grilling 的做法。
- 用户确认主题目录名 `ZooV7`、`LegacyV3` 和 spec 整体。共识加入决策 17，spec 状态改为"已确认"，本记录夹改名为"有结论"。
- 检查 `FFrame-zoo` 的未提交改动：4 个是 CRLF 造成的假 M 状态，暂存后已消失；`settings/v2/packages/information.json` 是 Creator 自动生成的表单 ID，每个工程都不一样，决定不提交，留在本地。
- 用户指示：临时总结直接提交，做完后删除。已提交推送（`5be7e93`）。
- 用户指示：把还没处理的事项整理进本记录夹，已提交推送（`05606dd`）。
- 用户指示：移动 `del/` 的内容并全部提交推送，不留风险。这次的做法：
  - 提交前扫描两处 `del/` 的文本文件，没有发现 token 或密钥。
  - 复制到 `FFrame-asset-line/legacy/`，逐文件比对哈希，全部一致。原 `del/` 目录没有删除，仍在本地。
  - 动物园：先在 `.gitignore` 去掉 `资源生成/`，加 `LFS` 跟踪 PNG，提交为 `b5480f9`（后来重做成 `a15b872`）。推送时 GitHub 返回 `This repository exceeded its LFS budget`，额度用完。
  - 推送素材仓库 `c2b6bb4`（普通 git，不走 LFS）成功。
- 拉取另一台电脑的改动：FFrame 快进 15 个提交，asset-line 快进 6 个，动物园 1 个（`1dab931`，弹窗改继承 GMFrame）。动物园本地的 LFS 提交与远端分叉，用 rebase 接上。
- 用户选择取消 LFS：`git reset --mixed origin/main` 撤掉本地 LFS 提交，还原 `.gitignore` 和 `.gitattributes`。动物园仓库回到远端版本，只剩 `information.json` 的本地修改。
- 把 `资源生成/` 先搬到 `D:\creator\FFrame-zoo-art\`（临时），用户指示放进素材仓库，于是搬到 `FFrame-asset-line/scenes/动物园/资源生成/`，临时目录删除。搬前搬后都是 523 个文件、202,424,804 字节。
- 素材仓库 `.gitignore` 新增 `资源生成/`，`git check-ignore` 确认生效，提交推送为 `47f1226`。
- 另一台电脑的 spec 状态（已写进 `spec.md`）：ticket 02 已做完；ticket 03 先用现成图顶上缺的 8 槽，`item.png` 已打好；ticket 04、05 的代码已写，预览未跑。
- 提交信息显示 ticket 01 已完成（`97fb78a`）；ticket 07 的一部分文档已改（`e6b44fd`，皮肤规则改成主题 plist）。
- 框架版本：用户确认"周末提交的内容是最新的"，以 `0.5.3` 为准（来自 `1dab931`，2026-11-01）。spec 里 ticket 04 写的 `0.5.1` 已过时，待改。

## 3. 结论

有结论。共识和 spec 已由用户确认：主题目录名 `ZooV7`、`LegacyV3`，spec 和 7 张 ticket 整体没问题。

- `del/` 的内容已全部归档到 `FFrame-asset-line/legacy/`，并已推送。
- 动物园原始素材不走 GitHub。决定是：放在素材仓库的 `scenes/` 下，被忽略，靠 U 盘同步。
- 实现进度以另一台电脑的 spec 状态为准：01 已完成，02 已完成，03 部分，04、05 代码已写但未预览，06 方案已变，07 部分完成。

用户还有一些问题没有提出，要在新电脑上继续问。

## 4. 接着做

**新电脑上怎么接手**：拖入本文件夹后，直接说"继续"。这里的待办和未决问题都在下面。提问方式按 grilling 规则：纯文字，每次只问一个问题，附推荐答案，用户在输入框里回答。

**换电脑前后的准备**
1. 仓库要 clone：`FFrame`、`FFrame-asset-line`、`FFrame-zoo`（地址：`https://github.com/faace/FFrame.git`，`.../FFrame-asset-line.git`，`.../FFrame-zoo.git`）。`FFrame-asset-line` 里已经有 `legacy/`（两处 `del/` 的全部内容）。
2. **动物园原始素材要用 U 盘拷贝**：从旧电脑的 `D:\creator\FFrame-asset-line\scenes\动物园\资源生成\` 拷到新电脑 clone 下来的 `FFrame-asset-line/scenes/动物园/` 下面。这个目录不在 GitHub 上，clone 不会带过来。
3. Cursor 用户规则：把 `docs/流程/用户规则.md` 里的三段分别粘贴到 Cursor 设置的 User Rules。换电脑时不会自动同步，要重新粘贴一次。
4. 全局 skill（grilling、spec、implement、review）按 `docs/流程/工程化流程安装包.md` 安装到 `~/.agents/skills/`。
5. 项目规则（`.cursor/rules/`）随 `FFrame` 仓库走，不用额外装。

**待办**
- **比较两台电脑的差别**（用户已说会做）：另一台电脑做了不少优化，等用户拿到后比较差别。比较前先不要改素材或 spec。
- **核对 ticket 状态**：01 已完成，02 已完成，03 只做了部分，04、05 代码已写但未预览，07 部分完成。新 session 里先看 spec 状态和各 ticket 文件，再决定怎么做。
- **框架版本已定为 0.5.3**：用户确认周末提交是最新的。待改：`spec.md` 和 ticket 04 里的 `0.5.1` 要改成 `0.5.3`，这一步改文档，需要用户点头再做。
- **以周末提交为准**：本地的素材和记录都基于周末那批提交。新 session 开始前，先 `git pull` 三个仓库，确认是最新的。
- **更新文档**（需要用户确认后再做）：
  - `共识.md` 第 17 条附近"动物园 `资源生成/` 用 Git LFS 入库"，要改成"不入库，放素材仓库 `scenes/`，U 盘同步"。
  - `ticket 06-动物园素材入库.md` 要重写成"不入库，U 盘同步"的版本。
  - `del/build/` 不迁移那条也要同步。
- **规则草案**（ticket 07 执行时写入前要先给用户看）：
  - 界面图按主题组织：`bundles/Skin/<主题>/` 下控件图和物品图各一张 2048 加一份清单。
  - 源图按设计分辨率 720×1280 的 2 倍出，运行时显示 1/2。
  - 素材和提示语放 `FFrame-asset-line/style/<主题>/`，不放 `del/`。
  - 脚本放 `FFrame-asset-line/tools/`，不放 `del/`。
  - 场景的原始生成素材放 `FFrame-asset-line/scenes/<场景>/资源生成/`，被忽略，U 盘同步，不入库。
- **用户还有一些问题要问**，回答后如果影响到 spec，先更新 spec 再继续。

**其它未决事项**
- `FFrame-zoo` 的 `settings/v2/packages/information.json` 留在本地，不提交（每个工程的 sid 都不一样）。
- 用户规则原文写着"临时总结不 commit"，这次是用户指示提交的。如果想长期这样，需要在 Cursor 设置里改那条规则。
- 原 `FFrame/del/` 和 `FFrame-zoo/del/` 的目录还在本地，没有删。新 session 以 `legacy/` 为准，不用再读原目录。

**收尾**：本记录夹"做完这件事后删除"，同时删掉 `docs/临时总结/索引.md` 里对应的那一行。

## 5. 产物

这次用到的 `del/` 目录有两个。`资源生成/` 不是 del，单独写在下面。

- **`FFrame/del/`**（复制到 `legacy/FFrame-del/`，原目录未删）：
  - 子文件夹 99 个（递归，不含自己）。
  - 文件 198 个，19.4MB。按扩展名：`.json` 83，`.png` 62，`.js` 20，`.mjs` 13，`.txt` 10，`.err` 2，`.bin` 2，`.log` 2，`.css` 1，`.wasm` 1，`.html` 1，`.ttf` 1。
- **`FFrame-zoo/del/`**（复制到 `legacy/FFrame-zoo-del/`，原目录未删）：
  - 子文件夹 248 个（递归，不含自己）。
  - 文件 506 个，37.6MB。按扩展名：`.json` 259，`.png` 131，`.mjs` 56，`.py` 26，`.js` 21，`.log` 2，`.wasm` 2，`.bin` 2，`.css` 1，`.ttf` 1，`.txt` 1，`.csv` 1，`.dom` 1，`.html` 1，`.err` 1。
- **`FFrame-zoo/资源生成/`**（不是 del，已搬走）：现在在 `FFrame-asset-line/scenes/动物园/资源生成/`，523 个文件，202MB（357 个 PNG）。不在 git 里，只在本机，换电脑用 U 盘拷贝。
- **已推送的提交**：
  - `FFrame` `5b54f41`（上一版记录）。
  - `FFrame-asset-line` `c2b6bb4`（legacy 归档）、`47f1226`（忽略 `资源生成/`）。
  - `FFrame-zoo` 无新提交，本地是远端版本 `1dab931`。
- 这次新建的目录和文件：`FFrame-asset-line/legacy/FFrame-del/`、`legacy/FFrame-zoo-del/`、`scenes/动物园/资源生成/`。临时目录 `D:\creator\FFrame-zoo-art` 已删除。
