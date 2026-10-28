# FFrame 示例 App

这是 FFrame 自带的 demo，用来展示框架的基本用法和控件。它是 FFrame 这个 Creator 工程的 `assets/game`。原独立仓库 `FFrame-example` 已并入这里并归档。

框架在仓库根的 `gmajor/`，由 `extensions/gmajor` 挂成资源库 `db://gmajor`。这里统一写 `import { ... } from 'db://gmajor/index'`。框架不 import 这里的代码。编辑器播放 `ScMain.scene`。

槽名、框架版本、什么改动算破坏，以框架仓库根目录的 README 和 `CHANGELOG.md` 为准。本文件写这个示例怎么接上、目录里各是什么。

## 本仓库依赖框架的什么

- `ScMain` 继承 `GMScene`，在 `onStart` 里调用 `gm.boot(config)`。
- 包入口继承 `GMBundleEntryBase`，用 `registerBundleEntry` 登记。绑定名等于叶子目录名。
- 界面脚本走 `GMScene` / `GMLayer` / `GMComponent`。确认框皮继承 `GMAlert`。
- 控件用框架预制体：`PfGMBtn`、`PfGMTitle`、`PfGMSlider`、`PfGMBar`、`PfGMStepper`、`PfGMTabs`。
- 数据用 `gd` / `gl`，事件用 `on` / `emit`，点击用 `gu.addClick`，挡操作用 `gm.ui.loadingShow`。
- 平台只喊 `gp`。

框架的 Overlay 常驻节点由 `gm.ui` 创建。这个仓库不建它，也不把它写进 `config`。

## 目录

```
ScMain.scene            编辑器播放的场景
ScMain.ts               只点火，读 config.ts
config.ts               boot / entry / alert / 游戏版本
bundles/Skin/           Bundle Skin。播放时界面图只从这里取
bundles/GameUI/         常驻包。预载 LyAlert，并带 SkinKit
bundles/User/           常驻包。绑定后 gd.sync('User')
bundles/Setting/        常驻包。本地设置 gl.Setting
bundles/Demo/DemoHome/  入口包。场景、设置弹层、列表示例
bundles/Demo/DemoChild/ 子包生命周期示例，开机不绑定
```

`bundles/Demo` 只是分组，不是 Bundle。不要在 `bundles/GameUI/Skin/` 再放一套界面图；播放不读那个位置。

`config.ts` 现在是：

- `boot`：`GameUI`、`User`、`Setting`
- `entry.web`：`DemoHome`
- `alert`：`GameUI` / `LyAlert`

## 最小游戏不必带这些包

新游戏从空框架往外长时，最少是 `ScMain.scene`、`ScMain.ts`、`config.ts`，加上 `entry` 指向的一个入口包。`boot` 里点了名的包都要有入口。`Skin` 可以没有，缺了控件是白图，开机继续。

上面的 `GameUI`、`User`、`Setting`、`Demo` 是这个示例的用法，不是框架要求的包名。要用 `gu.alert`，才需要像 `GameUI` 这样在常驻包 `onBind` 里 `setAlertPrefab`。

## 皮肤

图放在 `bundles/Skin/`，文件名小写蛇形。`gm.boot` 会加载 Bundle `Skin`，不把这个包写进 `boot`。

框架控件会来取哪些文件，看框架 README 的「框架会取的图」。本仓库已经按那张清单放了同名 png。播放只用这里。

这个示例另外还在用、但框架不会按名字来取的图：`slot_item`、`frame_select`，以及 `icon_music`、`icon_sfx`、`icon_settings`、`icon_gold`、`icon_diamond` 等。设置弹层 `LySetting` 用它们铺图标。`panel` 已由 `PfGMTabs` 按名字来取。

## 开机会做的

`config.boot` 先绑三个常驻包，再按 `entry.web` 进入 `DemoHome`。

- **GameUI**：预载确认框 `LyAlert`，之后 `gu.alert` 用这张皮。
- **User**：绑定后 `gd.sync('User')`，拉账号数据树。
- **Setting**：本地设置 `gl.Setting`。没有值时补上背景乐音量、音效音量、语言（默认中文）。
- **DemoHome**：打开场景 `ScDemoHome`。

## 留在包里、开机不会自动跑

这些是验收过的用法，入口不再主动调用。

- **LySetting**：设置。滑条、进度条、步进用框架控件。背板和图标用 `Skin` 里的蛇形文件名贴上。遮罩由框架克隆。
- **PfDemoItem**：列表项。拿到脚本后改数量，不直接改节点。
- **PfDemoTabPage**：页签内容，继承 `GMTabPage`。首页再点一次「页签」打开或关掉三页（概况、背包、记录）。记录页的 `onShow` 会等两秒，用来看 loading。
- **DemoChild**：子包的绑定生命周期（`onInit` / `onBind` / `onStart` / `onUnbind` / `onRemove`），只打日志。要看它，得由别的包再去绑定 `DemoChild`。
