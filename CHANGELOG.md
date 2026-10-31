# 更新日志

只记**对 app 有影响**的改动。版本号 `主.次.修`：0.x 阶段，破坏性改动升「次」；只加可选字段、只加新槽升「修」。版本号在 `gmajor/launch/GMLauncher.ts` 的 `version`，同时改 `extensions/gmajor/package.json` 的 `version`。

app 在 `config.version.gmajor` 写所按的框架版本。开机只打日志，主.次不同时多打一条警告，不拦截。升级后怎么判断：看这里的破坏项，再跑一遍。

## 0.5.1

`loadSkin` 可以按主题加载图集。不传主题时仍是原来的逐张图。`skinFrame` 和 `applySkin` 没变。

- **新增（可选）**：`loadSkin(theme, onComplete)`。从 `bundles/Skin/<theme>/` 读取 `ctrl.png`、`ctrl.json`、`item.png`、`item.json`，按清单切出 `SpriteFrame`。同名槽控件图优先。
- 清单 `rect` 的原点在图的左上角。
- 主题目录一份都没有：一条 info。缺其中一张：一条 warn。缺槽名仍是白图。
- 编辑器里仍按单张 png 取图。只调用了带主题的 `loadSkin` 时，编辑器预览用白图，不报错。
- 开机仍调用 `loadSkin(onComplete)`，不传主题。游戏目录还没按主题拆开时，行为与 0.5.0 相同。

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
