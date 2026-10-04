# FFrame

Cocos Creator 工程，里面是框架 **gmajor**。具体游戏不在这个 git 里。

游戏是另一个仓库，克隆到 `assets/game`。本仓库的 `.gitignore` 忽略这个目录。换一个游戏，就换掉整个 `assets/game`。框架代码不 import 游戏代码。

示例游戏：[FFrame-example](https://github.com/faace/FFrame-example)。

```
git clone https://github.com/faace/FFrame.git
git clone https://github.com/faace/FFrame-example.git assets/game
```

编辑器播放 `assets/game/ScMain.scene`。日常怎么写脚本，先看 [docs/架构/README.md](docs/架构/README.md)。

## 目录

```
assets/gmajor/          框架代码。固定小写，不是 Asset Bundle
  index.ts              模块出口。先看这里
  launch/               gm.boot、gm.version
  bind/                 包的加载和生命周期
  data/                 gd / gl
  event/                事件总线
  resource/             Bundle 加载
  platform/             gp。游戏只喊 gp
  ui/                   场景、弹层、Overlay、PfGM* 控件
  ui/skin/              皮肤样图。不是 Bundle，播放不加载
  fonts/main.ttf        控件用的字体
assets/game/            独立 git。本仓库忽略
docs/                   架构、新 App、界面控件、设计讨论
.cursor/rules/          写代码时的约定。01-naming 含改哪边
config.tpl.json         和游戏 config.ts 相同的字段，给对照
```

`library/`、`temp/`、`profiles/`、`build/` 是编辑器本地目录，不入库。

## 开机

`ScMain` 在游戏仓。它只做一件事：把 `assets/game/config.ts` 交给 `gm.boot`。

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

从空的本仓库开始时，游戏仓最少这些：

- `ScMain.scene`、`ScMain.ts`（挂在 Canvas 下同名空节点，与 Camera 同级）
- `config.ts`
- `entry` 指向的那个入口包（目录名 = Bundle 名 = 绑定名，大驼峰）
- `boot` 里写到的每个包

`bundles/Skin` 可以没有。没有时控件是白图，开机继续。示例里的 `GameUI`、`User`、`Setting`、`Demo` 是用法，不是每个游戏的必带包。

`assets/game` 本身不要标成 Bundle。只有 `bundles/` 下的叶子功能目录才是 Bundle。

## 皮肤槽

播放只加载游戏的 Bundle `Skin`：`assets/game/bundles/Skin/<文件名>.png`。`gm.boot` 在绑定常驻包之前加载它。不写进 `config.boot`，不登记入口。

文件名用小写蛇形，种类在前。编辑器和播放认的是同一个文件名。缺这个包，或缺下面某一张：该槽用 Cocos 内置白图，打一条日志，开机不停。

`assets/gmajor/ui/skin/` 里是同名样图，给新游戏复制。这个目录不是 Bundle。复制时连同 `.meta` 一起拷到新游戏的 `bundles/Skin`，九宫格才在。不要拷进已经有同名图的工程里叠 uuid。本仓库自带的示例游戏已经有自己的一套，uuid 和样图不同。

不要在 `assets/game/bundles/GameUI/Skin/` 再放界面图。

### 框架会取的图

这些名字写在 `PfGM*` 里。游戏要这些控件有样子，`bundles/Skin` 里就要有同名文件。

| 文件 | 谁在取 |
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
| `stepper_plate` | `PfGMStepper` 的数字板 |
| `tab_normal` | `PfGMTabs` 未选中的页签 |
| `tab_selected` | `PfGMTabs` 选中的页签 |
| `panel` | `PfGMTabs` 下面的板 |

主题枚举仍然叫 `primary` 这些。取图时拼成 `btn_` 加主题名，所以文件名能看出是按钮底板。

按钮、标题、滑条轨道、进度条的槽和填充、步进板，由控件自己切九宫格。图标和文字拖进控件才显示，没设就空着。关闭钮用的图标文件是 `icon_close`，由预制体引用，不是 `PfGMBtn` 按名字去取。

### 样图里还有、框架不会按名字来取

示例和业务自己 `addSkin` 时会用到。新游戏可以不带。

`progress_fill`、`frame_select`、`slot_item`、`icon_close`、`icon_help`、`icon_settings`、`icon_energy`、`icon_plus`、`icon_minus`、`icon_music`、`icon_gold`、`icon_sfx`、`icon_ad`、`icon_diamond`。

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
| 控件脚本和预制体、开机、绑定、数据、事件、平台、Overlay、皮肤怎么加载 | 本仓库 `assets/gmajor/` |
| 样图文件名和样图本身 | 本仓库 `assets/gmajor/ui/skin/` |
| 业务包、`config.ts`、真正进播放的图、业务窗口 | 游戏仓 `assets/game/` |

框架不 import 游戏。游戏可以 import `gmajor`。

## 兼容

公开面被游戏依赖，改名、删字段、改节点名要升 `gm.version`，并在上面这种「破坏项」里写旧名和新名。

公开面包括：

- `config` 的 `boot` / `entry` / `alert`
- `gm.boot` 的调用形状
- 确认框节点名 `body`、`btnOk`、`btnCancel`、`label`
- 上一节「框架会取的图」
- `PfGM*` 的子节点名。滑条是 `track`、`thumb`。进度条是 `bg`、`fill`。按钮是 `label`、`icon`。页签是 `tabs`、`panel`

只加可选字段，或只加新的皮肤槽，不记破坏。游戏仓怎么改，不保证别的游戏还能跑。
