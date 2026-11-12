# FFrame

Cocos Creator 框架 **gmajor** 的仓库。同时也是一个 Creator 工程，里面的 `assets/game` 是展示框架和控件基本用法的 demo。

具体游戏（如动物园）是另一个仓库、另一个 Creator 工程。游戏**引用**本仓库的 `gmajor/`，不是被放进本仓库。

```
D:\creator\
  FFrame\        本仓库：框架 + demo
  FFrame-zoo\    一个 app：自己的 Creator 工程，把 ..\FFrame\gmajor 挂进来
```

## 怎么引用

框架代码在仓库根 `gmajor/`，不在 `assets/` 里。每个工程用 Cocos 扩展的资源库挂载引用它：

```
<工程>/extensions/gmajor/package.json
  contributions.asset-db.mount.path     相对这个扩展目录的路径，指向 gmajor/
  contributions.asset-db.mount.readonly app 写 true，FFrame 自己的 demo 写 false
```

挂载后框架是资源库 `db://gmajor`。游戏脚本这样引用：

```ts
import { GMScene, gm, gp } from 'db://gmajor/index';
```

不要写 `'../gmajor'`，两者不在同一个资源库。app 里框架是只读的；要改框架，到本仓库的 `gmajor/` 改。写法示例见 [extensions/gmajor/package.json](extensions/gmajor/package.json)，实验记录见 `D:\creator\FFrame-exp\README.md`。

版本不锁，app 永远用兄弟目录里最新的框架。框架版本是 `gm.version`，改动记在 [CHANGELOG.md](CHANGELOG.md)。app 在 `config.version.gmajor` 写所按的版本，开机只打日志。

日常怎么写脚本，先看 [docs/架构/README.md](docs/架构/README.md)。新建 app 看 [docs/新App.md](docs/新App.md)。

编辑器播放 `assets/game/ScMain.scene` 看 demo。
## 目录

```
gmajor/          框架代码。固定小写，不是 Asset Bundle
  index.ts              模块出口。先看这里
  launch/               gm.boot、gm.version
  bind/                 包的加载和生命周期
  data/                 gd / gl
  event/                事件总线
  resource/             Bundle 加载
  platform/             gp。游戏只喊 gp
  ui/                   场景、弹层、Overlay、PfGM* 控件
  fonts/main.ttf        控件用的字体
assets/game/            demo App（原 FFrame-example）
extensions/gmajor/     把 gmajor/ 挂成 db://gmajor
del/                    临时文件，已忽略
CHANGELOG.md           框架更新日志
docs/                   架构、新 App、界面控件、设计讨论
.cursor/rules/          写代码时的约定。01-naming 含改哪边
config.tpl.json         和游戏 config.ts 相同的字段，给对照
```

`library/`、`temp/`、`profiles/`、`build/` 是编辑器本地目录，不入库。

## 开机

`ScMain` 在 app 里（demo 是 `assets/game/ScMain.ts`）。它只做一件事：把 `assets/game/config.ts` 交给 `gm.boot`。

`config` 的字段：

| 字段 | 作用 |
|---|---|
| `v` | 这份配置的格式 |
| `version.app` | 游戏版本。框架版本是 `gm.version`，不写在这里 |
| `boot` | 常驻包名单。按顺序绑定，进程里一直绑着。可以是空数组 |
| `entry` | `role` → 入口包。缺了当前 role，开机失败 |
| `alert` | 确认框皮：`{ bundle, prefab }`。开机不检查它 |

`role` 默认 `gp.params.role`，没有就是 `web`。入口包如果不在 `boot` 里，绑定前会补进去。名单里每一个名字都要是叶子 Bundle，并且有已登记入口，否则失败。

Overlay 是框架自己的常驻节点。第一次打开场景、弹层或确认框时创建，切场景还在。上面有层栈、loading、确认框。loading 是代码画的字，不读皮肤。游戏不要自己 `addPersistRootNode`。

要用 `gu.alert`，某个常驻包在 `onBind` 里把预制体交给 `gm.ui.setAlertPrefab`。示例是 `GameUI` 按 `config.alert` 加载 `LyAlert`。节点名必须是 `body`、`btnOk`、`btnCancel`，按钮上的字节点叫 `label`。不用确认框就可以不预载，调用时会打错误日志。

## 新游戏最少要有

新建 app 时，`assets/game/` 最少这些：

- `ScMain.scene`、`ScMain.ts`（挂在 Canvas 下同名空节点，与 Camera 同级）
- `config.ts`
- `entry` 指向的那个入口包（目录名 = Bundle 名 = 绑定名，大驼峰）
- `boot` 里写到的每个包

`bundles/Skin` 可以没有。没有时控件是白图，开机继续。示例里的 `GameUI`、`User`、`Setting`、`Demo` 是用法，不是每个游戏的必带包。

`assets/game` 本身不要标成 Bundle。只有 `bundles/` 下的叶子功能目录才是 Bundle。

## 皮肤槽

播放按 `config.skinTheme` 加载游戏的 Bundle `Skin`：`assets/game/bundles/Skin/<主题>/`。`gm.boot` 在绑定常驻包之前加载它。不写进 `config.boot`，不登记入口。

一套主题两份图集：`ctrl.png` + `ctrl.plist`（控件），`item.png` + `item.plist`（物品）。进工程的是实际尺寸。源图按 720×1280 的 2 倍出，留在 `FFrame-asset-line`。没有 plist 的主题不加载，缺图用白图（0.6.0 起逐张 png 路径已删除）。

槽名用小写蛇形，种类在前。编辑器和播放认的是同一个槽名。缺这个包，或缺下面某一张：该槽用 Cocos 内置白图，打一条日志，开机不停。

框架仓库不带这些图。九宫格写在 plist 子图的边上。

不要在 `assets/game/bundles/GameUI/Skin/` 再放界面图。

### 框架会取的图

这些名字写在 `PfGM*` 里。游戏要这些控件有样子，当前主题的图集里就要有同名槽。

| 槽名 | 谁在取 |
|---|---|
| `btn_primary` | `PfGMBtn`，主题 `primary` |
| `btn_secondary` | `PfGMBtn`，主题 `secondary` |
| `btn_warning` | `PfGMBtn`，主题 `warning` |
| `btn_neutral` | `PfGMBtn`，主题 `neutral` |
| `btn_info` | `PfGMBtn`，主题 `info` |
| `title_bar` | `PfGMTitle` |
| `bar_bg` | `PfGMBar` 的槽 |
| `bar_fill` | `PfGMBar` 的填充 |
| `slider_track` | `PfGMSlider` 的轨道 |
| `slider_thumb` | `PfGMSlider` 的滑块 |
| `switch_off` | `PfGMSwitch` 关掉。浅橡木轨道，圆钮在左 |
| `switch_on` | `PfGMSwitch` 打开。草地绿，圆钮在右 |
| `checkbox` | `PfGMCheck` 的框。浅橡木 |
| `checkbox_mark` | `PfGMCheck` 的勾。草地绿，勾上才显示 |
| `stepper_plate` | `PfGMStepper` 的数字板 |
| `tab_normal` | `PfGMTabs` 未选中的页签 |
| `tab_selected` | `PfGMTabs` 选中的页签 |
| `panel` | `PfGMTabs` 下面的板 |
| `dropdown` | `PfGMSelect` 收起态的盒子。320×72 |
| `dropdown_list` | `PfGMSelect` 展开列表的底板，上边直角贴住盒子 |
| `dropdown_item_on` | `PfGMOption` 选中那一行。草地绿 |
| `icon_arrow` | `PfGMSelect` 右侧箭头，展开时控件转 180° |
| `scrollbar` | `PfGMSelect` 展开列表的滚动条槽 |
| `scrollbar_thumb` | 滚动条滑块，九宫格纵向拉伸 |
| `slot_item` | `PfGMItemCell` 的木格底 |
| `frame_select` | `PfGMItemCell` 的选中框，默认隐藏 |
| `toast` | `PfGMToast` 的底板。480×72 |

主题枚举仍然叫 `primary` 这些。取图时拼成 `btn_` 加主题名，所以文件名能看出是按钮底板。

按钮、标题、滑条轨道、进度条的槽和填充、步进板、页签、下拉盒子和列表底板、轻提示板、`panel` 按子图上的九宫格拉伸。图标和文字拖进控件才显示，没设就空着。关闭钮用的图标槽是 `icon_close`，由预制体引用，不是 `PfGMBtn` 按名字去取。

### 框架不会按名字来取

示例和业务自己 `addSkin` 时会用到。新游戏可以不带。

`slider_fill`、`icon_close`、`icon_help`、`icon_settings`、`icon_energy`、`icon_plus`、`icon_minus`、`icon_music`、`icon_gold`、`icon_sfx`、`icon_ad`、`icon_diamond`。

只有一张、种类本身就是名字的，不再加第二段，所以面板底叫 `panel`。

## 0.4.0 破坏项

`gm.version` 从 `0.3.1` 升到 `0.4.0`。框架写死的皮肤槽从大驼峰改成小写蛇形。旧文件名不再被读取。

| 旧 | 新 |
|---|---|
| `primary` / `secondary` / `warning` / `neutral` / `info` | `btn_primary` / `btn_secondary` / `btn_warning` / `btn_neutral` / `btn_info` |
| `TitleBar` | `title_bar` |
| `BarBg` / `BarFill` | `bar_bg` / `bar_fill` |
| `SliderTrack` / `SliderThumb` | `slider_track` / `slider_thumb` |
| `PlateStepper` | `stepper_plate` |

业务侧原来按大驼峰 `addSkin` 的图也改成了蛇形，例如 `Panel` → `panel`，`IconClose` → `icon_close`。

## 改哪边

| 改什么 | 仓库 |
|---|---|
| 控件脚本和预制体、开机、绑定、数据、事件、平台、Overlay、皮肤怎么加载 | 本仓库 `gmajor/` |
| 业务包、`config.ts`、界面图、业务窗口 | app 工程的 `assets/game/` |

框架不 import 游戏。游戏通过 `db://gmajor/index` 引用框架。

## 兼容

公开面被游戏依赖，改名、删字段、改节点名要升 `gm.version`，并在 [CHANGELOG.md](CHANGELOG.md) 里写破坏项：旧名、新名、怎么改。

公开面包括：

- `config` 的 `boot` / `entry` / `alert`
- `gm.boot` 的调用形状
- 确认框节点名 `body`、`btnOk`、`btnCancel`、`label`
- 上一节「框架会取的图」
- `PfGM*` 的子节点名。滑条是 `track`、`fill`、`thumb`。进度条是 `bg`、`fill`。按钮是 `label`、`icon`。页签是 `tabs`、`panel`。开关是 `face`。勾选框是 `box`、`mark`

只加可选字段，或只加新的皮肤槽，不记破坏。app 里的业务怎么写，不保证别的 app 还能跑。
