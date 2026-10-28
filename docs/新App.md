# 新 App 怎么接

App 是自己的 Creator 工程，框架（`FFrame/gmajor`）是被引用的资源库。**目前还没有抽出新 app 模板**，新建 app 前先看 [新App模板（待抽取）.md](./新App模板（待抽取）.md)。

参照物：`D:\creator\FFrame-zoo`（动物园）和本仓库的 demo（`assets/game`）。

## 工程骨架

```
<App>/                              和 FFrame 放在同一个父目录下（兄弟目录）
  package.json                      name、uuid、creator.version（3.8.8）
  tsconfig.json                     extends ./temp/tsconfig.cocos.json，strict: false
  settings/v2/packages/project.json 设计分辨率 720×1280，宽适配
  extensions/gmajor/package.json    挂载框架，见下
  assets/game/                      游戏：ScMain.scene、ScMain.ts、config.ts、bundles/
  del/                              临时文件，已忽略（.gitignore 加 /del/）
  .cursor/rules/                    app 自己的规则（业务命名、策划约定）
  <App>.code-workspace              多根工作区：本工程 + ../FFrame
  .gitignore                        library/ temp/ build/ profiles/ local/ node_modules/ /del/
```

## 挂载框架

`extensions/gmajor/package.json`：

```json
{
  "package_version": 2,
  "name": "gmajor",
  "version": "0.5.0",
  "contributions": {
    "asset-db": { "mount": { "path": "../../../FFrame/gmajor", "readonly": true } }
  }
}
```

- `path` 必须是相对这个扩展目录的路径，不能是绝对路径。上面写法要求 app 和 FFrame 是兄弟目录。
- `name` 必须是 `gmajor`，决定了资源库名 `db://gmajor`。
- app 里 `readonly: true`。要改框架到 FFrame 仓库改。

## 脚本怎么引用框架

```ts
import { GMScene, gm, gp } from 'db://gmajor/index';
```

不要写 `'../gmajor'`。

## 游戏最少要有

编辑器播放 `assets/game/ScMain.scene`。`ScMain` 只调 `gm.boot(config)`。常驻包、入口、确认框皮写在 `assets/game/config.ts`。字段和仓库根的 `config.tpl.json` 相同：`v`、`version`、`boot`、`entry`、`alert`。`version.gmajor` 写所按的框架版本。

- `ScMain.scene`、`ScMain.ts`、`config.ts`
- `config.entry` 指向的入口包（叶子 Bundle + 已登记入口）
- `config.boot` 里写了的每一个包，同样要有入口

新游戏不必带 demo 里的 `Demo`、`User`、`Setting`。`boot` 可以是空数组。没有入口包时 `gm.boot` 失败。

## 皮肤

播放只加载 Bundle `Skin`（`assets/game/bundles/Skin/`）。不写进 `boot`，不绑入口。没有这个包，或缺某一张，该槽用内置白图，打一条日志，开机继续。

框架会取哪些文件名，写在仓库根 README 的「皮肤槽」。App 自己把同名 png 放进 `bundles/Skin`。框架仓库不带这些图。

不要在 `GameUI/Skin` 再放一套图。

控件脚本在框架。确认框基类 `GMAlert` 在框架，皮是 app 常驻包里的预制体（demo 是 `GameUI` / `LyAlert`）。不用确认框就可以不预载。分层见 [界面组件/说明.md](./界面组件/说明.md)。

## 升级框架后

不锁版本。框架升了「次」，开机日志会多一条警告。看 [CHANGELOG.md](../CHANGELOG.md) 的破坏项，再跑一遍。
