# 更新日志

只记**对 app 有影响**的改动。版本号 `主.次.修`：0.x 阶段，破坏性改动升「次」；只加可选字段、只加新槽升「修」。版本号在 `gmajor/launch/GMLauncher.ts` 的 `version`，同时改 `extensions/gmajor/package.json` 的 `version`。

app 在 `config.version.gmajor` 写所按的框架版本。开机只打日志，主.次不同时多打一条警告，不拦截。升级后怎么判断：看这里的破坏项，再跑一遍。

## 0.6.5

加了勾选框。未勾选只显示框，勾选再显示勾。点击仍由调用方 `gu.addClick` 调 `setValue`。

- **新增（可选）**：`PfGMCheck`。子节点 `box`、`mark`。`value` 是布尔，`setValue` 和检查器是同一份。边长 48，锚点在中心。皮是 `checkbox`、`checkbox_mark`。

## 0.6.4

加了开关。关是浅橡木，开是草地绿，圆钮在左或右。点击仍由调用方 `gu.addClick` 调 `setValue`。

- **新增（可选）**：`PfGMSwitch`。子节点 `face`。`value` 是布尔，`setValue` 和检查器是同一份。宽 96，高 48。皮是 `switch_off`、`switch_on`。

## 0.6.3

标题加了小档和大档，高和字号跟同名按钮档。普通弹窗仍默认中档。

- **新增（可选）**：`PfGMTitleSize`。`small` 高 64、字号 28；`medium` 高 88、字号 36；`large` 高 120、字号 48。`PfGMTitle.setSize`。`GMFrame.titleSize` 默认中档，子类只写和默认不同的。
- **行为**：标题中档高从 85 改为 88，和按钮中档一样高。不改 `titleSize` 的弹窗仍是中档。

## 0.6.2

白字描边从 4 收到 3。按钮、道具格数量、进度条上的字一起改。标题、步进数字、页签字仍不描边。

## 0.6.1

进度条可以在条中间写字。旧调用不改也和以前一样，默认不显示。

- **新增（可选）**：`PfGMBarText`：`off` 不显示，`percent` 按 `value` 取整显示百分比，`ratio` 显示 `current/total`。方法 `setText`、`setRatio`。`setValue` 在 `ratio` 且 `total > 0` 时，分子改成 `value × total` 的四舍五入。
- **行为**：`PfGMBar` 四周留白从 7 改为 8。`value` 为 0 时仍不画填充。白字描边宽统一为 4：进度条上的字、道具格数量（原来是 3）。标题、步进数字、页签字仍不描边。`+`、`−`、`×` 小图标用 `secondary`。步进的加号从 `primary` 改为 `secondary`。

## 0.6.0

**破坏性改动**：`loadSkin` 只认主题目录（有 `ctrl.plist` 的 `bundles/Skin/<主题>/`）。不传主题就不加载任何图，只打一条「没有可用的界面图」的 info，控件用内置白图。以前的逐张 png 目录和「按文件名直接取」的路径全部删除，不再回退。

app 要做的：

- `assets/game/config.ts` 的 `skinTheme` 填一个有 plist 的主题（现在是 `ZooV7`）。
- 预制体、场景里指向旧逐张图的 uuid 要换成图集子图的 uuid。动物园已替换，没有残留。
- `SkinKit` 里的 `redress` 和旧图 uuid 表已删。调用它的地方同步去掉。

LegacyV3 旧逐张图移出 `assets/game/bundles/Skin/`，归档到素材仓库 `legacy/Skin-LegacyV3-game/`。游戏运行时不再加载。

## 0.5.3

普通弹窗可以走骨架 `GMFrame`：默认 620×800，能关标题、关闭钮和底框，左上角有回调才出现。确认框只把标题和关闭钮挪到同一条边上。旧弹窗不改基类的话和以前一样。

- **新增（可选）**：`GMFrame`、`FRAME_EDGE`。子类字段 `width` / `height` / `showTitle` / `showClose` / `showPlate`，方法 `setTitle`、`setLeft`。内容挂 `body`。
- **行为**：`LyAlert` 的标题和关闭钮上移，铆钉压在面板棕色顶边上。确认框的文案、按钮和显隐不变。

## 0.5.2

按钮加了小档和正方形。确认框可以不显示标题、不显示右上角关闭。步进器的加减号从皮肤取图标。旧调用不改也和以前一样。

- **新增（可选）**：`PfGMBtnSize.small`（180×64，正方形边长 64）。`PfGMBtnShape`：`standard` 是宽按钮，`square` 边长等于这一档的高。纯图标仍是正方形。旧预制体不写 `shape` 时仍是宽按钮。
- **新增（可选）**：`gu.alert` 的 `showTitle`、`showClose`，缺省都是 `true`。
- **行为**：`PfGMStepper` 的加减按钮运行时换成皮肤槽 `icon_minus`、`icon_plus`。没有这两张图时仍是白图。

## 0.5.1

`loadSkin` 可以按主题加载图集。不传主题时仍是原来的逐张图。`skinFrame` 和 `applySkin` 没变。

- **新增（可选）**：`loadSkin(theme, onComplete)`。从 `bundles/Skin/<theme>/` 读取引擎已导入的 `ctrl.plist`、`item.plist`（同名 png 是实际尺寸）。同名槽控件图优先。运行时不再按清单切 `SpriteFrame`。
- 主题目录没有 plist：一条 info（整包没有）或按该目录里的逐张图按文件名收成槽（`LegacyV3`）。缺物品图集：一条 warn。缺槽名仍是白图。
- 编辑器里有 plist 就用图集子图；没有则仍按单张 png 取。
- 开机若 `config.skinTheme` 有值，按该主题目录加载。不写 `skinTheme` 时仍和以前一样扫包根。

## 0.5.0（破坏）

框架引用方式翻转：app 是 Creator 工程，框架是被引用的资源库。

- **框架目录搬家**：`assets/gmajor/` → 仓库根 `gmajor/`。不再是工程 `assets/` 的一部分。
- **接入方式**：工程里加 `extensions/gmajor/package.json`，用 `contributions.asset-db.mount` 把框架挂成资源库 `db://gmajor`。`path` 必须是相对扩展目录的路径。app 用 `readonly: true`，FFrame 自己的 demo 用 `readonly: false`。写法见 `extensions/gmajor/package.json`。
- **import 改写**：`from '../gmajor'`、`from '../../../gmajor'` 全部改成 `from 'db://gmajor/index'`。
- **去掉联接**：不再需要目录联接，也不再需要 `script.preserveSymlinks`。
- **字体路径**：`assets/gmajor/fonts/main.ttf` → `db://gmajor/fonts/main.ttf`（只影响提示文字）。
- **新增（可选）**：`config.version.gmajor`，写所按的框架版本。
- **demo**：原 `FFrame-example` 并入 `assets/game`，不再需要克隆。
- **临时文件**：每个工程根 `del/`（已忽略），取代 `tools/temp/`。
- **修复**：`PfGMBar` / `PfGMBtn` / `PfGMSlider` / `PfGMStepper` / `PfGMTitle` 预制体里写死的 `_spriteFrame` 原先指向 demo `bundles/Skin` 里的 png（框架依赖了游戏资源），app 没有同名图时预览报 `The asset ... is missing`。现在统一指向引擎内置白图 `default_sprite_splash`。运行时仍由 `GMSkin` 按文件名从 app 的 `bundles/Skin` 取图，行为不变。**框架预制体里不要引用 `assets/game` 下的任何资源。**
- **修复**：app 没有 Bundle `Skin` 时，开机不再去加载它（原先会打 404 红日志，预览还弹错误框）。只留一条 `[Skin] 没有 Skin 包，用内置白图` 的 info 日志（编辑器里也只报这一条，不再对每个槽各报一次警告）。包在但缺某一张图，仍然是警告。
- **修复（Skin 依赖包）**：Skin 的图与别的 Bundle 共用资源时，Creator 会把共用部分放进高优先级的包（如 `GameUI`），Skin 就依赖它，开机 `loadDir` 报 `Please load bundle GameUI first`，所有按钮退回白图。`loadSkin` 现在先加载 Skin 依赖的包再取图。
- **修复（发布构建）**：`PfGM*` 预制体常被代码按 uuid 动态加载，没有场景静态引用时不会被打进包，发布后按钮加载 404。现在预制体搬到 `gmajor/prefabs/`（原 `gmajor/ui/`，uuid 不变），该目录设为 Bundle `GMUI`，`gm.boot` 开机先加载它（工程里没有该 Bundle 则跳过）。**预制体放 `gmajor/prefabs/`，脚本放 `gmajor/ui/`**：Bundle 目录里不能有脚本，否则脚本会被打进 Bundle。

app 要改的：

1. 加 `extensions/gmajor/package.json`（照 demo 的，改 `path` 和 `readonly`）。
2. 全局替换 import。
3. 删掉联接和 `preserveSymlinks`。
4. `config.ts` 里加 `version.gmajor: '0.5.0'`。

## 0.4.0

此前版本。
