# 新 App 怎么接

一个 Creator 工程。框架在本仓库，具体游戏在独立 git，克隆到 `assets/game`。本仓库忽略该目录。示例：[FFrame-example](https://github.com/faace/FFrame-example)。

编辑器播放 `assets/game/ScMain.scene`。`ScMain` 只调 `gm.boot(config)`。常驻包、入口、确认框皮写在 `assets/game/config.ts`。字段和仓库根的 `config.tpl.json` 相同：`v`、`version`、`boot`、`entry`、`alert`。

## 现在就能跑

```
git clone https://github.com/faace/FFrame-example.git assets/game
```

## 最小游戏

新游戏不必带示例里的 `Demo`、`User`、`Setting`。最少要有：

- `ScMain.scene`、`ScMain.ts`、`config.ts`
- `config.entry` 指向的入口包（叶子 Bundle + 已登记入口）
- `config.boot` 里写了的每一个包，同样要有入口

`boot` 可以是空数组。没有入口包时 `gm.boot` 失败。

## 皮肤

播放只加载 Bundle `Skin`（`assets/game/bundles/Skin/`）。不写进 `boot`，不绑入口。没有这个包，或缺某一张，该槽用内置白图，打一条日志，开机继续。

框架会取哪些文件名，写在仓库根 README 的「皮肤槽」。样图在 `assets/gmajor/ui/skin/`，文件名和槽相同，播放不读这个目录。要样子时，把同名 png 复制进游戏的 `bundles/Skin`。

不要在 `GameUI/Skin` 再放一套图。

控件脚本在 FFrame。确认框基类 `GMAlert` 在框架，皮是游戏常驻包里的预制体（示例是 `GameUI` / `LyAlert`）。不用确认框就可以不预载。分层见 [界面组件/说明.md](./界面组件/说明.md)。

换一个游戏，就是换掉整个 `assets/game` 目录。
