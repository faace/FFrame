# 控件图集与换肤

## 1. 需求与情况

**需求**：扩充控件库（现在控件太少），并让控件和物品用统一风格的素材。控件和物品各用一张 2048×2048 图集，方便合批、换肤。提示语、生成过程、每个版本、最终采用的素材都要记录下来，换电脑能接着做。

**本窗口补充（2026-11-06）**：控件收尾按顺序一个个做，每做完一步由用户在 Creator 里确认后再做下一步。控件名字由用户定，不由 AI 替定：道具格定为 `PfGMItemCell`；虚拟列表名字待定。道具格先按显示 96×96 做，看设置页效果，不行再改。选中框 108，比木格每边多 6，不占排版。一行 5 个、格间缝 16 是以后背包那一页的排法，不写进控件。

**本窗口补充（2026-11-08）**：做通用开关 `PfGMSwitch`，直接实现。不要多语言，不要复选框，不要下拉框，不要改规则。跟滑条一样是框架控件：脚本、预制体、从 `gmajor/index.ts` 导出。高 48、宽 96。关是浅橡木，开是草地绿，圆钮在左或右。点击不包在控件里，设置页自己 `gu.addClick` 调 `setValue`。演示放在设置页大约 (-180, -230)，旁边用现有深色字写「开关」，不描边。只加这一件和需要的新槽，版本按仓库当前号加一修。勾选框不是这一窗的需求；写总结时它已经在同一工作区里。

**本窗口补充（2026-11-08 勾选框）**：通用勾选框 `PfGMCheck`，直接做。不要多语言、不要开关、不要下拉框、不要改 `.cursor/rules`。48×48。框是浅橡木，勾是草地绿。未勾选只显示框。点击不放进控件，演示页用 `gu.addClick` 调 `setValue`。设置页大约 (80, -230)，旁边用现有深色字写「勾选」，不描边。不要动齿轮旁「语言  中文」、滑条、进度条、步进、道具格。只加新控件和新槽。版本从仓库里当时的版本加一修，不写死。

**本窗口补充（2026-11-08 进度）**：齿轮旁的「语言  中文」不是多语言功能，定成通用下拉框，预留槽 `dropdown`，还没做。不要再把下一步说成语言行。

**本窗口补充（2026-11-12 现状）**：控件这一批基本收尾，框架 0.7.0，12 个控件，图集实画 32、预留 4。剩下的大件是虚拟列表，在另一个窗口做。以后开新窗口前先读第 3、4 节，不要读第 2 节的旧状态。用户要求：一份拷贝文只做一件，必须写「禁止 commit / push」，一步一停。

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

- 2026-11-09 晚，另一个窗口收尾提交（我在控制窗口只核对，没有动代码）：
  - 开关的嵌套实例原来漏登记。`LySetting.prefab` 的 `panel` 上 `nestedPrefabInstanceRoots` 里没有开关节点，运行时它退化成空节点，报 `[LySetting] 没有开关`。那一窗往数组里补了 `{"__id__": 169}`（`cf2cf0f`）。补完实测关→开→关正常。
  - 勾选框和开关两帧的导入参数统一成 `trimType: none` + `packable: false`，子 meta 从 27 清到 25，和 `ctrl.plist` 的 25 帧对上（`3ba6c1b`、`193f242`）。
  - 勾选框的勾描边加到 3 像素，和叉、问号、加减一样粗；后来又左右各偏两像素让内容居中（asset-line `acdcb40`、`761851a`）。
  - 道具格下移到 `-312`，和勾选框留约 10px，不再叠。
  - 我犯的错：一开始给的拷贝文把三件事塞进一个窗口，还写了「提交剩下的 4 个文件」，等于替用户授权了 commit。用户反对后，那两笔提交（`4af7fd3`、`b171080`）用 `reset` 撤回，没 push。之后规矩定死：一份拷贝文只做一件，必须写「禁止 commit / push」，一步一停。

- 2026-11-10 控件展示窗 `LyControls`（`7820442`）：
  - `extends GMFrame`，640×1120，三页页签（按钮 / 选择 / 展示）。按钮页八颗中档，禁用那颗专门验证点击被拦；选择页滑条 + 步进 + 开关 + 勾选；展示页进度条 + 五个道具格。
  - label 不写进预制体，运行时按控件节点的 y 生成，坐标只有预制体一处来源。
  - 首页 `btnDiamond` 改成 `btnControls`「控件展示」。
  - 顺带修了真 bug：`PfGMSlider` 运行时的 `fillClip` 用默认层，Overlay 相机不画，填充整块被裁掉，只剩轨道和滑块。改成跟根同层。框架记到 0.6.6。动物园的滑条也一起吃这个修复。

- 2026-11-12 两个窗口并行做下拉框和 Toast（我给的拷贝文按「图集归下拉框窗口独占、Toast 先走白图」分工）：
  - 下拉框 `PfGMSelect` / `PfGMOption`（第 10 个控件，`33fa059`）。收起态子节点 `bg`/`icon`/`label`/`arrow`；预制体里带 `list` 骨架（`view`(Mask) → `content` + `scrollBar`），运行时克隆，用引擎 `ScrollView` 滚，不手写滚动。行高 64，一屏最多 8 行。`GMOptionItem` 是 `text` + `icon`。新增 6 个皮：`dropdown`、`dropdown_list`、`dropdown_item_on`、`icon_arrow`、`scrollbar`、`scrollbar_thumb`。
  - 轻提示 `PfGMToast`（第 11 个控件，`1724c84`）。子节点 `bg`/`label`，皮 `toast`。`show` / `hide` / `setAnchor`，最多叠 3 条、间距 12、新的在最上、同一句去重只续命。不进弹层栈、不挡输入、不可点。新增 `gu.toastRoot()` 和 Overlay 上的 `toasts` 容器。
  - 开关、勾选、步进补了 `setOnChange` / `toggle` / `stepBy`（`94abdb9`），框架记到 0.7.0。语义统一：`setValue` 不回调，用户操作才回调。
  - `5a702ac` 把选择页从 4 个下拉精简成 2 个，顺手踩了「并排改纵向只改 y」的坑，控件压进 panel 边框 12px。于是加了规则 `70ee2d5`：控件不许压背景边框；并排改纵向要连 x 和宽一起改。
  - 图集：asset-line `094369d` 加下拉和滚动条（实画 25 → 31），`fa7e524` 加 toast（480×72，九宫格 20，实画 32 预留 4）。

- 2026-11-12 本窗口（控制窗口）补标记，只改文档和规则，不动代码：
  - `CHANGELOG.md` 的 0.7.0 原来只记了变更回调，下拉框和 Toast 一个字没写。补成三节：下拉、轻提示、变更回调。
  - 框架 `README.md` 皮肤槽表停在 18 个槽到 `panel` 为止，补 7 个新槽。另外发现 `slot_item` / `frame_select` 被错列在「框架不会按名字来取」里，但 `PfGMItemCell` 是按名字取的（`PfGMItemCell.ts` 第 61、62 行），挪回正表。
  - `assets/game/README.md` 控件名单补 `PfGMSelect`、`PfGMOption`、`PfGMToast`。
  - `docs/界面组件/进度.md`：「当前焦点」改成虚拟列表；补回漏掉的清单 9（`PfGMItemCell`）；补清单 11（`PfGMToast`）；「先不做」按现状重写。
  - `01-naming.mdc` 三处对齐：177 行框架预制体名单补 6 个控件；206 行公开面子节点名补全（原来只写滑条 `track`/`thumb`、进度条 `bg`/`fill`）；178 行「滑条只有轨道和滑块」改成「轨道、填充、滑块和运行时建的裁剪层」；文末对照表补两行。跑过 `tools/sync-cursor-rules-index.mjs`，5 条已更新。
  - 版本号没有补修号。下拉框和 Toast 都挤在 0.7.0 里，这是当初为并行定的「两个窗口都不碰版本文件」。要不要拆成 0.7.1 / 0.7.2 还没定。

## 3. 结论

有结论。框架已到 0.7.0（已推送，HEAD `70ee2d5`），12 个控件做完：按钮、标题、页签、滑条、进度条、步进、开关、勾选框、道具格、下拉、下拉行、轻提示。图集实画 32、预留 4（`radio`、`input`、`badge`、`count_plate`）。展示窗 `LyControls` 三页，首页「控件展示」进入。剩下的大件是虚拟列表，2026-11-12 起在另一个窗口做。

## 4. 接着做

**接手方式**：`git pull` 三个仓库即可，本轮都干净、与远端同步（FFrame `70ee2d5`、asset-line `fa7e524`、zoo `15a8a37`）。上一节「换电脑前必须带走的工作区」已经过时，不要再照着做——那些改动早就提交了。

**待办**
- 虚拟列表（另一个窗口在做）。大任务，先 grilling 定范围：A 普通滚动列表封装（N 项一次铺进 `ScrollView`，100 项以内够用，`PfGMSelect` 里已有一套可抽）还是 B 真正的回收复用（几百上千项才有意义）。动物园里最高的列表项数：背包上限 16、商店约 24、任务卡 3、待领奖励无上限。名字待定，不沿用已删的 `GMVirtualList`。
- 红点 `badge`。首页签到、广告累计两个入口要它（`02-首页.md` 第 64 行的待实现表）。图集槽是 64×64，但红点通常 16–20，做之前要定：真做 64 的红点，还是改成小圆点 + 数字两形态。
- 输入框 `input`。目前没有直接需求（改名、搜索都没有），可以做也可以搁置。
- `radio`、`count_plate` 按需再填，不预先画。
- 版本号要不要拆：下拉框和 Toast 都记在 0.7.0 里。按「只加可选字段、只加新槽升修号」严格算，应该是 0.7.1 和 0.7.2。没定。
- 设置页齿轮旁那行「语言  中文」还是死文字。动物园策划 `13-设置.md` 写明「仅中文，不做语言选择」，所以那行在正式项目里不该存在；下拉框已经做完了，现在只是 demo 里没换成真控件。
- `FFrame-zoo` 版本落后：`config.ts` 写 `gmajor: '0.6.3'`，框架已经 0.7.0，extension 仍是 0.5.0。等控件全部做完一起同步。
- 规则草案还剩 1 条没落盘：「动物园这类场景的原始生成素材放 `FFrame-asset-line/scenes/<场景>/资源生成/`，被忽略，不入库，换电脑用 U 盘拷贝」。等确认后再写。
- loading 暂时不动。
- ticket 03 物品图在别处处理。01、02 已完成；04、05 已验证；07 部分完成。
- `FFrame-zoo` 的 `settings/v2/packages/information.json` 留在本地，不提交。
- 用户规则写着临时总结不 commit。这次总结也不提交。

**收尾**：本记录夹做完这件事后删除，同时删掉 `docs/临时总结/索引.md` 里对应的那一行。

## 5. 产物

2026-11-12 重数。`FFrame/del/` 整体：子文件夹 119 个（递归，不含自己），文件 317 个，23,640,103 字节。按扩展名：`.png` 123、`.json` 87、`.mjs` 51、`.js` 22、`.txt` 10、`.prefab` 6、`.ts` 4、`.bin` 2、`.err` 2、`.log` 2、`.bak` 1、`.scene` 1、`.md` 1、`.css` 1、`.html` 1、`.ttf` 1、`.diff` 1、`.wasm` 1。

这件事用到的子目录分开写（`del/` 根上其它旧目录不在这次范围里）：

- **`FFrame/del/下拉框/`**（下拉框窗口）
  - 子文件夹 4 个。
  - 文件 53 个，2,394,995 字节。按扩展名：`.mjs` 14、`.png` 32、`.prefab` 3、`.ts` 4。
- **`FFrame/del/toast/`**（轻提示窗口）
  - 子文件夹 2 个。
  - 文件 11 个，319,026 字节。按扩展名：`.mjs` 4、`.png` 4、`.js` 2、`.diff` 1。
- **`FFrame/del/控件展示窗/`**（展示窗窗口）
  - 子文件夹 0 个。
  - 文件 7 个，40,365 字节。按扩展名：`.mjs` 7。
- **`FFrame/del/勾选框验证/`**（勾选框验证窗口）
  - 子文件夹 0 个。
  - 文件 12 个，785,070 字节。按扩展名：`.png` 10、`.json` 2。
- **`FFrame/del/勾的描边/`**（勾的居中微调）
  - 子文件夹 0 个。
  - 文件 15 个，290,701 字节。按扩展名：`.png` 9、`.mjs` 6。
- **`FFrame/del/ZooV7九宫格/`**（九宫格核对）
  - 子文件夹 0 个。
  - 文件 1 个，18,592 字节。按扩展名：`.json` 1。
- 已经不在的：`FFrame/del/开关控件/`、`FFrame-zoo/del/`、`FFrame/del/替换皮肤引用/`、`FFrame/del/删除首页按钮/`、`FFrame/del/slider填充/`、`FFrame/del/slider对比/`、`FFrame/del/看道具格现状/`、`FFrame-asset-line/del/勾选框对照/`。归档仍以已推送的 `FFrame-asset-line/legacy/` 为准。
- **`FFrame-asset-line/scenes/动物园/资源生成/`**：这台电脑上这个目录不在。上次记的是 523 个文件、约 202MB，不在 git 里。
- **记录夹里的文件**（平放在 README 旁边）
  - 子文件夹 0 个。
  - 文件 6 个。按扩展名：`.png` 6。`track对比fill.png`、`设置页开关关.png`、`设置页开关开.png`、`switch_off.png`、`switch_on.png`、`勾选框预览.png`。
