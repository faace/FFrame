# 控件图集与换肤

## 1. 需求与情况

**需求**：扩充控件库（现在控件太少），并让控件和物品用统一风格的素材。控件和物品各用一张 2048×2048 图集，方便合批、换肤。提示语、生成过程、每个版本、最终采用的素材都要记录下来，换电脑能接着做。

**本窗口补充（2026-11-06）**：控件收尾按顺序一个个做，每做完一步由用户在 Creator 里确认后再做下一步。控件名字由用户定，不由 AI 替定：道具格定为 `PfGMItemCell`；虚拟列表名字待定。道具格先按显示 96×96 做，看设置页效果，不行再改。选中框 108，比木格每边多 6，不占排版。一行 5 个、格间缝 16 是以后背包那一页的排法，不写进控件。

**本窗口补充（2026-11-08）**：做通用开关 `PfGMSwitch`，直接实现。不要多语言，不要复选框，不要下拉框，不要改规则。跟滑条一样是框架控件：脚本、预制体、从 `gmajor/index.ts` 导出。高 48、宽 96。关是浅橡木，开是草地绿，圆钮在左或右。点击不包在控件里，设置页自己 `gu.addClick` 调 `setValue`。演示放在设置页大约 (-180, -230)，旁边用现有深色字写「开关」，不描边。只加这一件和需要的新槽，版本按仓库当前号加一修。勾选框不是这一窗的需求；写总结时它已经在同一工作区里。

**本窗口补充（2026-11-08 勾选框）**：通用勾选框 `PfGMCheck`，直接做。不要多语言、不要开关、不要下拉框、不要改 `.cursor/rules`。48×48。框是浅橡木，勾是草地绿。未勾选只显示框。点击不放进控件，演示页用 `gu.addClick` 调 `setValue`。设置页大约 (80, -230)，旁边用现有深色字写「勾选」，不描边。不要动齿轮旁「语言  中文」、滑条、进度条、步进、道具格。只加新控件和新槽。版本从仓库里当时的版本加一修，不写死。

**本窗口补充（2026-11-08 进度）**：齿轮旁的「语言  中文」不是多语言功能，定成通用下拉框，预留槽 `dropdown`，还没做。不要再把下一步说成语言行。

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
- 换肤：每套主题一个文件夹，运行时按主题名加载。主题目录名 `ZooV7`（当前唯一主题）。`LegacyV3`（旧版逐张图）已于 2026-11-02 退役，游戏不再加载，归档到 `FFrame-asset-line/legacy/Skin-LegacyV3-game/`（见第 2 节）。
- 素材仓库：`FFrame-asset-line`，按 `style/<主题>/` 组织。每个主题下分 `控件/`、`物品/`，各有 `prompt.md`、`history/`、最终图和清单。
- 风格提示语：共用的风格块写在 `style.md`，两步都引用它。
- 尺寸：按设计分辨率 720×1280 的 2 倍出图，运行时显示 1/2。
- 控件 21 件（5 个按钮底板、标题、面板、2 个 tab、滑条轨道和滑块、进度条、经验条的底和填充两件、步进底板、格子、选中框、X、问号、加号、减号），另预留约 10 个空槽。
- 物品图标：金币、钻石、能量、广告、音乐、喇叭、齿轮、播放（未用），统一 128×128 源图格子。
- 游戏里旧的 `Skin` 原先整体移入 `LegacyV3/` 保留。2026-11-02 用户决定退役：运行时不再加载，文件移到素材仓库归档，不删除。
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
- 2026-11-02 复核：实际是 **21 件**。经验条是底（`bar_bg`）和填充（`bar_fill`）两件，之前数成 1 件，漏了 1。已把共识、ticket 02 和本记录里的 20 改为 21。
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
- 框架版本：用户确认"周末提交的内容是最新的"，当前框架版本以 `0.5.3` 为准（来自 `1dab931`，2026-11-01）。ticket 04 的 `0.5.1` 没错，它就是周末发布的那个版本，不改成 `0.5.3`。（之前写"要改成 0.5.3"是错的，已更正。）
- 2026-11-02 LegacyV3 退役（用户同意，并说工程已在 Creator 里打开，写完直接算验证）。按顺序做了：
  - 用 `del/替换皮肤引用/替换.mjs` 把预制体和场景里的旧 uuid 换成 `ZooV7` 子图 uuid。先 `--dry` 看到 37 处，真跑也是 37 处，`--check` 残留 0。`git diff` 为 37 行增、37 行删，都是 uuid 行。备份在 `del/替换皮肤引用/备份/`。
  - 删掉 `SkinKit.ts` 的 `LEGACY_SLOT` 旧图映射和 `redress`，四个调用文件（`LyButtons.ts`、`LySetting.ts`、`ScDemoHome.ts`、`LyAlert.ts`）去掉 import 和调用。用 `del/替换皮肤引用/移除redress.mjs` 做，每处只匹配一次才写。同时去掉 `SkinKit` 里因此没用到的 `PfGMBtn` import。ReadLints 无报错。
  - 重写 `gmajor/ui/GMSkin.ts`：删掉逐张图的 loose 和平铺路径、`indexFrames`、`packed`、`editorWait`、`doneEditor`，以及 `LegacyV3` 回退。不传主题就不加载图，只打一条 info。编辑器没设主题时默认 `ZooV7`。`applySkin` 改用 `loadSkin(loadedTheme, …)`。ReadLints 无报错。
  - 把 `assets/game/bundles/Skin/LegacyV3/`（28 张 png 和 `.meta`，共 56 个文件，86,953 字节）用 Move-Item 整体移到 `FFrame-asset-line/legacy/Skin-LegacyV3-game/`，`LegacyV3.meta` 移到 `legacy/Skin-LegacyV3-game.meta`。移动前后文件数和字节数一致，原处已没有。
  - grep 确认 `assets`、`gmajor`、`config` 里没有 `LegacyV3` 引用（config 注释已改），旧 uuid 残留 0。
  - 版本升到 0.6.0：`GMLauncher.ts`、`extensions/gmajor/package.json`、`config.ts` 的 `version.gmajor`。CHANGELOG 加了 0.6.0（破坏性改动）。第一次写 CHANGELOG 时用了双引号 here-string，反引号吞掉了几个字，已恢复原文件重写。
  - 文档同步：共识第 14、15、17 条；`spec.md` 三处；ticket 04 两处；ticket 05 整体重写（目标、范围、验收、执行记录）；框架 `README.md` 和 `docs/界面组件/说明.md` 各一处。

- 2026-11-06 控件收尾（本窗口）：
  - 首页设置入口：用户要求加回「设置」按钮，打开 LySetting。一开始按错了按钮（用户说的「设置」是 `btnStart`，「页签」是 `btnSetting`），之后按要求恢复设置入口，页签入口保持删除。`ScDemoHome.scene` 无悬空引用。（`1483937`）
  - 滑条填充：第一版用九宫格拉伸，填充很短时两端被压扁，轮廓发虚（对照图：`del/slider对比/`，已拷进本记录夹）。用户否掉后改成运行时 Mask 裁剪（`fillClip`），填充不拉伸，只露出左缘到滑块中心。（`1483937`）
  - 滑块两端：用户要求 thumb 中心能拖到最左、最右；后来说太靠边，改为两边各收窄 4px（`PF_GM_SLIDER.inset = 4`）。
  - 滑条素材：`progress_fill` 改名 `slider_fill`，边框 meta 改成和轨道一致（上下 6、左右 10）。`SkinKit` 的 SLICED 名单同步。
  - 预制体：从 PfGMBar 复制 fill 节点时，误把整个 Prefab 和根也带进来（多出 19 个对象）。还原 git 版本后只加 fill 节点，共 6 个新增对象，无悬空引用。
  - 道具格：用户定名 `PfGMItemCell`，写了控件、预制体和导出，设置页两格改用它。（`a1bdb0a`，已推送，待 Creator 确认）
  - 虚拟列表：我先写了一版拷贝文，让新窗口直接动工，还替用户定了名字 `GMVirtualList`。用户否了，改成讨论优先的拷贝文。另一窗口已删掉 `GMVirtualList`，`gmajor/` 里已查不到。这个文件没进过 git。
  - 2026-11-06 道具格尺寸和打开报错：用户问背包一行 5 个、中间留缝，格子做多大。普通弹窗默认宽 620，正文左右各让 24，能排的宽度是 572。木格 96、缝 16 时一行 544，左右各剩 14。用户定先做 96，看效果，不行再改。控件根和底 96（皮 `slot_item`），图标 52，选中框 108（皮 `frame_select`，默认隐藏）。底和框整张拉伸，不切九宫格（`SkinKit` 的九宫格名单没有这两张；`slot_item` 图上虽有 16 的边）。设置页金币在 (-50, -290) 不选中，钻石在 (80, -290) 选中。钻石现在有木格底，旧画面那里透出的是面板底色。没有数量字，没有点击。ReadLints 无报错。看图裁在 `del/看道具格现状/`，没有拷进记录夹。用户打开 Creator 看到 `Each script can have at most one Component`，接着 `Cannot set properties of null (setting '_sealed')`。当时堆栈对应本机上的 `GMVirtualList.ts`（一个文件里两个组件），不是道具格。该文件现已不在工作区。不要当成格子的错去改 `PfGMItemCell`。
  - 提交 `.creator/asset-template`（`34681e4`）。`item.png` 的改动不是本窗口提交的，本窗口没碰。

- 2026-11-08 用户确认当天提交都完成：
  - 滑条填充此前已确认没问题。圆钮描边加到 4 像素，斜向才不会比轨道细。框架 `d7ea53a` 只改了 `ctrl.png`；素材仓库 `a03eb7a`。
  - 道具格补上数量。选中框从 108 改为 96，浅绿线贴在深色描边上，盖住木格描边；浅橡木圈改成浅草地绿（素材 `008cdff`，框架 `1f606b1`）。数量字号固定 20，不按字数缩小，超过 999 显示 `999+`（`d137102`）。白字描边定为 3，按钮、道具格数量、进度条上的字一起改（`16f002b`，框架 0.6.2）。设置页四格：星星 999、金币 12、钻石选中且数量 3、宝箱 1000。仍不接收点击。
  - 经验行（设置页红框那一行）补了文字状态。`PfGMBar` 默认不显示字，可切百分比或当前/总值。四周留白改为 8。设置页有加、减和文字状态按钮。`+`、`−`、`×` 小图标用 `secondary`，步进加号也改为 `secondary`。框架 0.6.1（`1f606b1`）、0.6.2（`16f002b`）。
  - 规则 `01-naming.mdc` 里「滑条只有轨道和滑块」还没改。能搜到两处（正文约第 176 行，文末对照约第 271 行）。公开面子节点名仍只写滑条 `track` / `thumb`。
  - 晚上补充：设置页齿轮旁的「语言  中文」不再当成多语言，也不用页签或按钮去换语言。这件做成通用下拉框，预留槽 `dropdown`，还没开工。开关和复选框分到别的窗口做，预留槽 `switch`、`checkbox`。这一条是开工前的状态。当天夜里开关已做完，勾选框由另一窗口做完，见下一条。

- 2026-11-08 本窗口做通用开关 `PfGMSwitch`（用户说直接做。不要多语言，不要复选框，不要下拉框，不要改 `.cursor/rules`）：
  - 一个预留槽 `switch` 放不下两张 192×96 的状态图（显示 96×48，圆钮要画在图里）。改成 `switch_off`、`switch_on`，放在滚动条旁边的空位：图集 (1760,32) 和 (1760,160)，各 192×96。游戏半尺寸是 (880,16) 和 (880,80)，各 96×48。没有占 `checkbox`。已有 21 件的像素没改。对照备份是 `del/开关控件/旧ctrl.png`，新槽以外差分为 0。
  - 没有跑整份 `export-zoo-v7-plist.mjs`。那份会把游戏里的 `slider_fill` 改回 `progress_fill`，并重写 `item.png` 和旧的子图 uuid。游戏图集是手改的：`ctrl.plist` 加了两帧，`ctrl.plist.meta` 的子图 id 是 `c0ff0`、`c0ff1`，`ctrl.png` 用新 2048 图缩小一半。素材侧改了 `tools/draw-zoo-v7-ctrl.mjs`、`style/ZooV7/控件/prompt.md`、`说明.md`、`ctrl.png`、`ctrl.json` 和 `history/v8`。`prompt.md` 现在写已画 25 个（21 件加开关两张、勾选框两张），预留 8 个。勾选框两张是另一窗口画的。
  - 第一次写游戏图集的内联脚本，正则里的 `</key>` 把表达式截断了，什么都没写上。改成 `del/开关控件/写入图集和设置页.mjs` 之后写上了。裁图 `switch_off.png`、`switch_on.png` 以及旁边的 `slider_thumb.png`、`slider_track.png` 留在这个目录，用来对硬边和圆钮。设置页的开关关、开关开两张截图已拷进本记录夹。
  - 控件：`gmajor/ui/PfGMSwitch.ts`，预制体 `gmajor/prefabs/PfGMSwitch.prefab`，从 `gmajor/index.ts` 导出。继承 `GMComponent`，`@executeInEditMode`。取图用 `applySkin`，不 import 游戏 `SkinKit`。根锚点在中心。检查器和 `setValue` 同一份布尔 `value`，默认关。子节点只有 `face`，固定 96×48，不拉伸。点击不在控件里。
  - 设置页 `LySetting`：在当时最新内容上只加了开关。实例名 `switch`，位置 (-180, -230)。旁边 `addText` 写「开关」，(-76, -230)，字号 24，颜色 `skinInk`（92,64,32），不描边。`gu.addClick` 调 `setValue(!value)`。没动「语言  中文」、滑条、进度条、步进、道具格。
  - 版本：本窗口按当时仓库版本加一修，写成 0.6.4（`GMLauncher.ts`、`extensions/gmajor/package.json`、`config.ts` 的 `version.gmajor`，`CHANGELOG.md` 的 0.6.4）。写总结时这三处已经是 0.6.5，CHANGELOG 的 0.6.5 是另一窗口的勾选框 `PfGMCheck`。开关不要再升一版。
  - Creator 在 17:29 导入了开关脚本和开关预制体（预览日志是核心已就绪 0.6.4），之后没有导入改过的 `LySetting.prefab` 和 `ctrl` 图集。改修改时间、整文件重写都没有新的 Import 记录。当时打开设置页没有 `switch` 节点。
  - 用 `del/开关控件/补预览库.js` 把新 `ctrl.png`、两张子图和设置页里的开关实例写进 `library/`，预览服务读的就是这份库。内存里的 Skin `config.json` 没有 `c0ff0`，重新打开 `http://localhost:7456/` 后图集仍解出 23 帧，含 `switch_off`、`switch_on`。点开关：关是浅橡木、圆钮在左；开是草地绿、圆钮在右；再点回到关。`value` 和 `face` 的图名跟着变。语言行、滑条、进度条、步进、四格道具都还在。开关底边按这个坐标压住星星格上沿大约十来像素，位置没改。
  - 这次预览跑的脚本仍是 0.6.4，画面上没有勾选框。源码里另一窗口已加上 `PfGMCheck`：设置页运行时在 (80, -230) 创建，旁边「勾选」在 (156, -230)。本窗口没有点过它。
  - `docs/界面组件/说明.md` 写了勾选框，没有开关那一条。`assets/game/README.md` 的控件名单有 `PfGMSwitch`，没有 `PfGMCheck`。框架 `README.md` 的皮表两对都有。

- 2026-11-08 本窗口做通用勾选框 `PfGMCheck`（用户说直接做。不要多语言，不要开关，不要下拉框，不要改 `.cursor/rules`）：
  - 开关那一窗已经占了 `switch_off`、`switch_on`，版本写成 0.6.4。本窗口没有改开关的脚本、预制体和那两张图。勾选框不占槽名 `switch`。
  - 控件按滑条的做法：`gmajor/ui/PfGMCheck.ts`，预制体 `gmajor/prefabs/PfGMCheck.prefab`，从 `gmajor/index.ts` 导出。继承 `GMComponent`，`@executeInEditMode`。取图只用 `applySkin`，没有 import 游戏 `SkinKit`。根锚点在中心。检查器和 `setValue` 同一份布尔 `value`。子节点 `box`、`mark`，边长 48。未勾选时 `mark` 隐藏。点击不在控件里。
  - 画法跟现有 `tools/draw-zoo-v7-ctrl.mjs`。原先 21 件的画函数没改。框用已有 `frame()`，勾用新的 `paintGlyph`。源图 2048 上：`checkbox` 在 (384, 1394)、96×96；`checkbox_mark` 在 (1728, 1394)、96×96。重画后，当时已画的 23 张（21 件加开关两张）像素对照是齐的。脚本断言是已画 25、预留 8。它按原习惯重写了素材侧 `ctrl.png`、`ctrl.json` 和 `history/v8/`。开关窗口写的「勾选框两张是另一窗口画的」就是这次。
  - 游戏图集没有跑整份 `export-zoo-v7-plist.mjs`。只把两块贴进 `assets/game/bundles/Skin/ZooV7/ctrl.png`，并在 `ctrl.plist` 末尾加上 `checkbox.png`、`checkbox_mark.png`。游戏坐标：框 `{{192,697},{48,48}}`，勾 `{{864,697},{48,48}}`。贴图脚本在 `FFrame-asset-line/del/勾选框对照/贴图.mjs`。对照图已拷进本记录夹，文件名 `勾选框预览.png`。
  - `说明.md`、`prompt.md` 写了这两个槽。预留还剩 radio、input、badge、dropdown、toast、count_plate、scrollbar、scrollbar_thumb。
  - 设置页在开关窗口的最新 `LySetting.ts` 上只追加勾选框。运行时从 GMUI 加载预制体，放在 (80, -230)。「勾选」在 (156, -230)，24 号，`skinInk`，不描边。`gu.addClick` 调 `setValue`。没有改「语言  中文」、滑条、进度条、步进、道具格，也没有改开关节点。48 的框和下面钻石格大约叠 12 像素，坐标按 (80, -230) 留着，等看到画面再决定挪不挪。
  - 版本从当时已经写上的 0.6.4 再加一修到 0.6.5：`GMLauncher.ts`、`extensions/gmajor/package.json`、`assets/game/config.ts` 的 `version.gmajor`，`CHANGELOG.md` 顶部是 0.6.5，0.6.4 那节留着。动物园 `config.ts` 仍是 `gmajor: '0.6.3'`，extension 仍是 0.5.0，这次没改。
  - ReadLints 看过 `PfGMCheck.ts`、`LySetting.ts`、`index.ts`，没有报错。没有 commit，没有 push。
  - 预览：17:46 只拨修改时间时，Creator 只重新查询资源，没有导入，当时预览仍是 0.6.4，设置页没有勾选框。17:56:44 出现 `refresh db`，导入了 `PfGMCheck.ts`、预制体、`LySetting.ts`、`ctrl.png`、`ctrl.plist`，脚本数变成 66。导入后 `checkbox`、`checkbox_mark` 的 `trimType` 仍是 `auto`，`packable` 仍是 true；边是 0，裁切矩形仍是整张 48×48，偏移 0，这一下还没裁掉像素。约定是 `trimType: none`、`packable: false`，还没改。导入之后没有再打开设置页把勾点上、点掉。

- 2026-11-08 换电脑前对过远端：`origin/main` 是 `3ace0e7`，已提交的框架版本是 0.6.3。`git pull` 能拿到下面三笔，拿不到开关和勾选框。
  - `42fb1b0` 标题补小档和大档，设置页用小档。`PfGMTitleSize`：小 64/28，中 88/36，大 120/48。中档高从 85 改为 88。这就是已提交的 0.6.3。
  - `0111c70` 按钮禁用改为去色，仍可点，点下去只水平抖一下。展示页底部对照五个主题的灰。
  - `3ace0e7` 按钮和弹窗展示：确认钮改成左大右叠，次要图标改成两行。
  - 工作区未提交的版本号是 0.6.5。0.6.4 是开关，0.6.5 是勾选框。

## 3. 结论

有结论。已推送的框架是 0.6.3（`3ace0e7`）：标题三档、按钮禁用去色抖动、弹窗按钮改排。滑条、道具格、经验行已确认。开关 0.6.4 已在设置页点过关和开。勾选框 0.6.5 已导入，设置页还没点过勾，`checkbox` 和 `checkbox_mark` 的 `trimType` 仍是 `auto`。下拉框还没做。开关和勾选框都还没提交。

## 4. 接着做

**新电脑上怎么接手**：先 `git pull`，再盖上下面两份未提交的工作区，然后打开这份记录说「继续」。只 `git pull` 会停在 `3ace0e7`（框架 0.6.3），没有开关和勾选框。盖上工作区之后版本号才是 0.6.5。

**换电脑前必须带走的工作区**（2026-11-08 写总结时都还没 commit）。带走两份仓库的整个工作目录。只打 `git diff` 补丁会丢掉未跟踪文件，也会丢掉被忽略的 `del/`：`FFrame/del/开关控件/`、`FFrame-asset-line/del/勾选框对照/`。
- `FFrame`：开关和勾选框混在同一批改动里。已改的有 `CHANGELOG.md`、框架 `README.md`、`assets/game/README.md`、`LySetting.ts`、`LySetting.prefab`、`Skin/ZooV7/ctrl.png`、`ctrl.plist`、`ctrl.plist.meta`、`config.ts`、`docs/界面组件/说明.md`、`extensions/gmajor/package.json`、`gmajor/index.ts`、`GMLauncher.ts`，以及本记录夹。未跟踪的有 `gmajor/ui/PfGMSwitch.ts`、`gmajor/prefabs/PfGMSwitch.prefab`（含各自 `.meta`）和另一窗口的 `PfGMCheck` 脚本与预制体。另外还有未跟踪的 `FFrame.code-workspace`，以及 `assets/game/bundles/Skin/assets/` 里的四份 `.meta`（不像皮肤图），提交前先看，不要随手加进去。
- `FFrame-asset-line`：`tools/draw-zoo-v7-ctrl.mjs`，`style/ZooV7/控件/` 下的 `prompt.md`、`说明.md`、`ctrl.png`、`ctrl.json`，以及 `history/v8` 的 `ctrl.png`、`ctrl.json`、`结论.md`。
- `library/` 里为了预览手补的开关和图集不要拷去当源。新电脑用上面的源文件，让 Creator 重新导入 `LySetting.prefab` 和 `ctrl.plist`。导入前若设置页没有开关，就是还在用旧库。

**换电脑前后的准备**
1. 仓库要 clone：`FFrame`、`FFrame-asset-line`、`FFrame-zoo`（地址：`https://github.com/faace/FFrame.git`，`.../FFrame-asset-line.git`，`.../FFrame-zoo.git`）。clone 之后再盖上上一段的未提交工作区。`FFrame-asset-line` 里已经有 `legacy/`（两处 `del/` 的归档）。
2. 动物园原始素材不在 GitHub。上次记的路径是 `D:\creator\FFrame-asset-line\scenes\动物园\资源生成\`。2026-11-08 这台电脑上这个目录已经不在，不要从这台找。换电脑用上次的 U 盘。
3. Cursor 用户规则：把 `docs/流程/用户规则.md` 里的三段分别粘贴到 Cursor 设置的 User Rules。换电脑时不会自动同步，要重新粘贴一次。
4. 全局 skill（grilling、spec、implement、review）按 `docs/流程/工程化流程安装包.md` 安装到 `~/.agents/skills/`。
5. 项目规则（`.cursor/rules/`）随 `FFrame` 仓库走，不用额外装。这次没改规则。

**待办**
- 新电脑打开 `http://localhost:7456/`，点「设置」。开关在 (-180, -230)，旁边「开关」。开关窗口已看到关、开、再关。勾选框在 (80, -230)，旁边「勾选」。17:56 已经导入，还没在那次导入之后点过。先把 `checkbox`、`checkbox_mark` 的 `trimType` 改成 `none`、`packable` 改成 false，别动其它帧的边，再点一次：勾要出现，再点要消失。看和下面钻石格叠的大约 12 像素要不要挪。不要改「语言  中文」、滑条、进度条、步进、道具格，也不要改开关。
- 下拉框还没做。齿轮旁「语言  中文」只是占位，不是多语言。预留槽 `dropdown`。类名未定。不要再把下一步说成语言行。
- 红点、Toast。预留槽 `badge`、`toast`。
- 输入框最后做，预留槽 `input`。
- 图集还空着的 8 个槽：`radio`、`input`、`badge`、`dropdown`、`toast`、`count_plate`、`scrollbar`、`scrollbar_thumb`。按做到的控件再填，不预先画。
- 文档还没对齐：`01-naming.mdc` 仍有两处写「滑条只有轨道和滑块」，公开面子节点名仍只写 `track` / `thumb`。`docs/界面组件/说明.md` 没有开关。`assets/game/README.md` 没有勾选框。
- 虚拟列表最后做。名字待定，不沿用已删的 `GMVirtualList`。2026-11-06 的组件报错来自那个未入库脚本，不要为那条报错去改道具格。开工前先讨论范围、名字和 demo 入口。
- loading 暂时不动。
- ticket 03 物品图在别处处理。01、02 已完成；04、05 已验证；07 部分完成。
- 规则草案还剩 1 条没写进规则：「动物园这类场景的原始生成素材放 `FFrame-asset-line/scenes/<场景>/资源生成/`，被忽略，不入库，换电脑用 U 盘拷贝」。等确认后再写。
- FFrame-zoo 等控件做完再同步。zoo 的 `config.ts` 仍是 `gmajor: '0.6.3'`，和已推送的框架一致。extension 版本仍是 0.5.0。盖上未提交工作区后框架是 0.6.5。
- 给新窗口的拷贝文先讨论、不直接动工，名字由用户定。
- `FFrame-zoo` 的 `settings/v2/packages/information.json` 留在本地，不提交。
- 用户规则写着临时总结不 commit。这次总结也不提交。若要带着走，提交的是上面的代码和素材，不是把「必须提交总结」写成新规则。

**收尾**：本记录夹做完这件事后删除，同时删掉 `docs/临时总结/索引.md` 里对应的那一行。

## 5. 产物

- **`FFrame/del/`**（2026-11-08 18:51 再数，数字没变。里面包含 `开关控件/`）：
  - 子文件夹 13 个（递归，不含自己）。
  - 文件 57 个，5,968,449 字节。按扩展名：`.png` 44，`.mjs` 10，`.json` 2，`.js` 1。
- **`FFrame-asset-line/del/勾选框对照/`**（勾选框窗口。脚本留在这里，对照图已拷进记录夹）：
  - 子文件夹 0 个。
  - 文件 2 个，15,265 字节。按扩展名：`.png` 1，`.mjs` 1。
- **`FFrame/del/开关控件/`**（开关窗口。脚本和中间图留在这里）：
  - 子文件夹 0 个。
  - 文件 8 个，66,417 字节。按扩展名：`.png` 5，`.mjs` 1，`.js` 1，`.json` 1。
  - `写入图集和设置页.mjs` 把两帧写进游戏图集和设置页。`补预览库.js` 只补预览用的 `library/`。`旧ctrl.png` 是改画前的 2048 备份。`skin-config.json` 是当时预览返回的图集配置。
- 2026-11-06 清点过、这次路径已经不在，没有文件可数：`FFrame-zoo/del/`、`FFrame/del/替换皮肤引用/`、`FFrame/del/删除首页按钮/`、`FFrame/del/slider填充/`、`FFrame/del/slider对比/`、`FFrame/del/看道具格现状/`。归档仍以已推送的 `FFrame-asset-line/legacy/` 为准。
- **`FFrame-asset-line/scenes/动物园/资源生成/`**：2026-11-08 这台电脑上这个目录不在。上次记的是 523 个文件、约 202MB，不在 git 里。
- **拷进记录夹的文件**（平放在 README 旁边）：
  - 子文件夹 0 个。
  - 文件 6 个。按扩展名：`.png` 6。分别是原来的 `track对比fill.png`，开关窗口的 `设置页开关关.png`、`设置页开关开.png`、`switch_off.png`、`switch_on.png`，勾选框窗口的 `勾选框预览.png`。
