# 新 App 怎么接

一个 Creator 工程。框架在本仓库，具体游戏在独立 git，克隆到 `assets/game`。本仓库忽略该目录。示例：[FFrame-example](https://github.com/faace/FFrame-example)。

当前 `main` 上的开机仍是游戏目录里的 `config.ts` 和 `ScMain`。下面是已经定下、尚未改代码的目标接法。示例仓库在框架改完之前，仍用现在这套 Demo 来跑。

## 现在就能跑

```
git clone https://github.com/faace/FFrame-example.git assets/game
```

编辑器播放 `assets/game/ScMain.scene`。常驻包、入口、确认框皮写在 `assets/game/config.ts`。

## 目标接法

1. 编辑器始终播放 `gmajor` 里的启动场景。它不 import 游戏代码。
2. 没有 Bundle `App` 时，打开框架预览场景。默认贴图只被这个预览场景引用。
3. 有 `App` 时，读取 `assets/game/App/config.json`。结构见仓库根的 `config.tpl.json`。
4. JSON 解析失败，或写了 `skinBundle` 但包加载失败：开机停住。
5. 成功则在绑定 `boot` 之前，按预制体名把皮肤包装上。没有某张皮，或者缺了关键节点，只这一槽用代码绘制。
6. 再绑定 `boot`。皮肤包不要写进 `boot`。

`assets/game` 本身不要标成 Bundle。`App` 与 `GameUI` 等包同级，不能嵌套。

不写 `skinBundle` 时，基础控件全部用代码绘制。槽名在框架里增加，不写进 config。游戏自己的业务窗口不占槽。

| 预制体名 | 节点 |
|---|---|
| `alert` | `panel` 下 `body`、`btnOk`、`btnCancel`，按钮下 `label` |
| `mask` | 根节点是铺满屏幕的图 |
| `loading` | 子节点 `label` |

发行构建不选预览场景。产物里若出现默认贴图，构建失败。

换一个游戏，就是换掉整个 `assets/game` 目录。
