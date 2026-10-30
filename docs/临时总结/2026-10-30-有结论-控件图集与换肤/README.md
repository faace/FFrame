# 控件图集与换肤

## 1. 需求与情况

**需求**：扩充控件库（现在控件太少），并让控件和物品用统一风格的素材。控件和物品各用一张 2048×2048 图集，方便合批、换肤。提示语、生成过程、每个版本、最终采用的素材都要记录下来，入库到 git，换电脑能接着做。

**当时的情况**：
- 游戏里 `bundles/Skin/` 是 27 张独立的 48 像素小图，是从 v3（奶油底色）切出来再用脚本重画的版本。
- 控件母版 `ui-sheet-v7` 的提示词写明"same pixel craft as the zoo map"，和动物园母图风格一致。
- 素材分散在三处：`FFrame/del/ui-style/`（v1–v7 图和提示词，不入库）、`FFrame-asset-line/style/`（画风文档和动物园效果图，已入库）、`FFrame-zoo/资源生成/`（动物园素材 193MB，被 `.gitignore` 排除，没入库）。
- `FFrame/.gitignore` 里有 `/del/`，所以 `del/` 下的东西不进 git。

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
- 动物园 `资源生成/` 用 Git LFS 入库；`del/build/` 不删、不迁移，留在本地。
- 游戏里旧的 `Skin` 整体移入 `LegacyV3/` 保留。

## 2. 尝试

- 对比 `ui-sheet-v3` 和 `ui-sheet-v7`，确认 v7 更接近动物园风格，游戏现在的 `Skin` 是 v3 的重画版。
- 查 `.gitignore`：确认 `del/` 和 `资源生成/` 都被忽略，素材没入库。
- 本机 `git lfs version` 为 3.5.1，已安装，不需要额外装。
- 逐条 grilling 17 项决策，每条都给出推荐答案，用户逐条回答，全部记入共识。
- 写 `spec.md` 和 7 张 ticket（01–07）。
- 查代码时发现：`LySetting.prefab`、`LyAlert.prefab`、`ScDemoHome.scene` 直接用 uuid 引用了旧 png，图集改造后会失效，已写进 ticket 05。`ScDemoHome.scene` 引用最多（5 个按钮、2 个 tab、多个图标）。
- 发现控件实际是 **20 件**（包括 4 个按钮上的小图标），之前说的 16 件、17 件有误，已在共识里改正。
- 发现 v7 母版里很多件的尺寸不符合 2 倍规则（例如按钮 288×80），02、03 要重新出图，不能直接放大 v7 的 1024 图。
- 第一次尝试用 AskQuestion 选择框提问，被工具判定为占位，之后改用纯文字逐条提问，符合 grilling 的做法。
- 用户确认主题目录名 `ZooV7`、`LegacyV3` 和 spec 整体。共识加入决策 17，spec 状态改为"已确认"，本记录夹改名为"有结论"。
- 检查 `FFrame-zoo` 的 5 个未提交改动：4 个是 CRLF 造成的假 M 状态，暂存后已消失；`settings/v2/packages/information.json` 是 Creator 自动生成的表单 ID，每个工程都不一样，决定不提交，留在本地。
- 用户指示：临时总结直接提交，做完后删除。已提交推送（`5be7e93`）。
- 用户指示：把还没处理的事项整理进本记录夹，方便换到新电脑后拖进去继续问。

## 3. 结论

有结论。共识和 spec 已由用户确认：主题目录名 `ZooV7`、`LegacyV3`，spec 和 7 张 ticket 整体没问题。还没有开始实现，ticket 01–07 都是未完成状态。

用户还有一些问题没有提出，要在新电脑上继续问。

## 4. 接着做

**新电脑上怎么接手**：拖入本文件夹后，直接说"继续"。这里的待办和未决问题都在下面。提问方式按 grilling 规则：纯文字，每次只问一个问题，附推荐答案，用户在输入框里回答。

**换电脑前后的准备**
1. 三个仓库都要 clone：`FFrame`、`FFrame-asset-line`、`FFrame-zoo`（地址：`https://github.com/faace/FFrame.git`，`.../FFrame-asset-line.git`，`.../FFrame-zoo.git`）。
2. 装 Git LFS，然后在 `FFrame-zoo` 里运行 `git lfs install`。ticket 06 要用到，旧电脑上版本是 3.5.1。
3. Cursor 用户规则：把 `docs/流程/用户规则.md` 里的三段分别粘贴到 Cursor 设置的 User Rules。换电脑时不会自动同步，要重新粘贴一次。
4. 全局 skill（grilling、spec、implement、review）按 `docs/流程/工程化流程安装包.md` 安装到 `~/.agents/skills/`。
5. 项目规则（`.cursor/rules/`）随 `FFrame` 仓库走，不用额外装。

**最重要的风险：`del/` 不进 git**
- `FFrame/del/ui-style/`（44 个文件，v1–v7 图和提示词）不在 git 里，新电脑拿不到。
- `FFrame/del/` 根下的 15 个脚本（`draw-btn-plates.mjs`、`draw-skin-plates.mjs`、`slice-ui-sheet.mjs`、`cut-ui-v3.mjs`、`pixellab-*.mjs` 等）也不在 git 里。
- 两种办法：
  - **A（推荐）**：在旧电脑上先做 ticket 01，把它们迁到 `FFrame-asset-line` 并推送，新电脑 clone 就有。
  - **B**：直接把旧电脑的 `D:\creator\FFrame\del\` 拷到新电脑对应位置（U 盘或网盘）。

**待办（按 ticket）**
- ticket 01：素材仓库整理。在新 session 里运行 `/implement 01`。
- ticket 02：控件图集，按 2 倍规则重新出图，20 件加约 10 个空槽。依赖 01。
- ticket 03：物品图集，8 个图标统一 128 格。依赖 01。
- ticket 04：GMSkin 图集加载，版本升到 0.5.1，接口不变。无依赖。
- ticket 05：游戏侧接入，`bundles/Skin` 重组，去掉预制体的 uuid 引用。依赖 02、03、04。
- ticket 06：动物园素材入库，`FFrame-zoo/资源生成/` 用 Git LFS 入库，不碰 zoo 的未提交改动。无依赖。
- ticket 07：文档和规则，更新界面组件文档，合并 `01-naming` 的草案。依赖 05。

**规则草案（ticket 07 执行时写入前要先给用户看）**
- 界面图按主题组织：`bundles/Skin/<主题>/` 下控件图和物品图各一张 2048 加一份清单。
- 源图按设计分辨率 720×1280 的 2 倍出，运行时显示 1/2。
- 素材和提示语放 `FFrame-asset-line/style/<主题>/`，不放 `del/`。
- 脚本放 `FFrame-asset-line/tools/`，不放 `del/`。

**其它未决事项**
- `FFrame-zoo` 的 `settings/v2/packages/information.json` 留在本地，不提交（每个工程的 sid 都不一样）。
- 另外 4 个 CRLF 假 M 已经消失，不用处理。
- 用户规则原文写着"临时总结不 commit"，这次是用户指示提交的。如果想长期这样，需要在 Cursor 设置里改那条规则。
- `FFrame/del/build/`（9.5MB 编译产物）留在本地，不迁移，也不删。
- 动物园 `资源生成/` 的 LFS 入库（ticket 06）要先改 `.gitignore`，去掉 `资源生成/` 这一行，再 `git lfs track` 大图。
- 用户还有一些问题要问，回答后如果影响到 spec，先更新 spec 再继续。

**收尾**：本记录夹"做完这件事后删除"，同时删掉 `docs/临时总结/索引.md` 里对应的那一行。

## 5. 产物

- `FFrame/del/`（根目录，不递归）：子文件夹 2 个（`build`、`ui-style`，不含自己）。文件 15 个：`.mjs` 13 个、`.err` 1 个、`.log` 1 个。这次只读取了文件名和检查了凭据，没有写入。`build/` 里的 139 个文件没有计入。
- `FFrame/del/ui-style/`（只读，没有写入）：子文件夹 1 个（`orig`，不含自己）。文件 44 个：`.png` 33 个、`.txt` 10 个、`.json` 1 个，没有无扩展名文件。
- 没有拷贝任何 del 文件进本记录夹。
- 本次新增的 git 文档（不在 del 下）：`docs/specs/控件图集与换肤/共识.md`、`spec.md`、`tickets/01–07`，共 9 个 `.md`。
