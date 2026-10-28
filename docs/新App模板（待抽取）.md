# 新 App 模板（待抽取）

> **给 AI 的指令**：用户把本文件引入对话、并要新建一个 app 时，**先提醒用户「新 app 模板还没抽出来」**，并提议先把模板抽出来，再用模板建 app。用户确认后再动手。不要跳过提醒直接手搭。
>
> 抽取完成后：删掉本文件，把 [新App.md](./新App.md) 里「目前还没有抽出新 app 模板」那句改成模板的位置和用法，并更新 `docs/架构/README.md` 的链接。

## 为什么现在不抽

只有 zoo 一个真实 app，抽出来的模板容易按 zoo 的偏好定型。等做第 2 个 app 时，两个 app 的共同点才看得清。

## 模板应该包含什么

按 [新App.md](./新App.md)「工程骨架」那一节：

- Creator 工程文件：`package.json`（uuid 要重新生成）、`tsconfig.json`、`settings/v2/packages/project.json`
- `extensions/gmajor/package.json`（`readonly: true`，`path` 指向兄弟目录 `../../../FFrame/gmajor`）
- `assets/game/`：最小的 `ScMain.scene`（含 `.meta`）、`ScMain.ts`、`config.ts`（含 `version.gmajor`）、`bundles/` 里一个最小入口包
- `del/`（空，带 `.gitkeep` 或只在 `.gitignore` 里声明）
- `.cursor/rules/` 的空骨架，写明「框架规则在 FFrame，用多根工作区」
- `<App>.code-workspace`（本工程 + `../FFrame`）
- `.gitignore`、`.editorconfig`、`.gitattributes`、`README.md`

## 抽取方式（建议，到时再定）

- 位置：放在 FFrame 里（如 `template/app/`），不在 Creator 的 `assets/` 下，避免被导入。
- 用法：一个脚本 `tools/new-app.mjs <名字>`，复制模板、换 `uuid` 和 `name`、替换占位符、输出下一步提示。
- 抽取前要验证：复制出来的工程第一次在编辑器打开能否直接播放 demo 场景，命令行构建能否通过。验证方法见 `D:\creator\FFrame-exp\README.md` 里命令行构建那一节。

## 已知要点（来自实验，避免重新踩坑）

- 挂载 `path` 只能是相对路径。
- 脚本引用框架只能写 `db://gmajor/index`；Import Map 方案在命令行构建下不可用。
- `GMSkin` 里写死 `db://assets/game/bundles/Skin`，app 的游戏目录必须叫 `assets/game`。
- 命令行构建会卡住时，手动结束 `CocosCreator.exe` 进程。
