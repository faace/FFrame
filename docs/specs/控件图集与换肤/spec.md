# 控件图集与换肤 spec

依据：`共识.md`（同目录）。本文件只写技术设计和 ticket 清单，不写代码。

## 技术设计

### 1. 目录与 Bundle 结构（游戏侧）

现在 `assets/game/bundles/Skin/` 是一个 Bundle（`bundleName: Skin`，priority 8），里面是 27 张独立 png。改成：

```
assets/game/bundles/Skin/
  ZooV7/                 当前主题（动物园 v7）
    ctrl.png             2048×2048，控件图集
    ctrl.json            控件清单
    item.png             2048×2048，物品图集
    item.json            物品清单
  LegacyV3/              旧主题（现在的 48 像素逐张图，整体移入）
    ...
```

- 主题目录名用大驼峰，和 `01-naming` 一致，不用中文和连字符。
- 同一个 Bundle 里放多个主题目录。`loadSkin` 不能再 `loadDir('')`，要按主题名 `loadDir(theme)`，否则会把所有主题都载入。
- 切换主题 = 释放旧主题的 SpriteFrame 和 Texture，再载入新主题目录。

### 2. 清单格式（`ctrl.json` / `item.json`）

```json
{
  "sheet": "ctrl.png",
  "size": [2048, 2048],
  "theme": "ZooV7",
  "slots": {
    "btn_primary": { "rect": [x, y, w, h], "border": [l, r, t, b], "sliced": true, "display": [w, h] }
  }
}
```

- `rect`：在图集上的像素坐标，单位是源图像素（2 倍）。
- `border`：九宫格四边，单位是源图像素。按决策 10，显示时是 1/2。
- `sliced`：是否九宫格。
- `display`：推荐的显示尺寸，只做参考，框架不强制。
- 清单里的 `slots` 键名就是现在的槽名（`btn_primary`、`panel`、`icon_close` 等），不改。
- 清单本身不放版本信息。最终采用的版本记录在 `FFrame-asset-line/style/ZooV7/控件/prompt.md` 和 `history/` 里。

### 3. 运行时（gmajor）

- `GMSkin.ts`：
  - `loadSkin(theme, cb)`：加载 `ctrl.png` 和 `item.png` 为 `Texture2D`，读取两份 `json`，为每个槽建一个 `SpriteFrame`（同一张 texture，不同 rect）。
  - `skinFrame(name)`、`applySkin(name, apply)` 保持不变。框架控件（`PfGMBtn` 等）不用改调用方式。
  - 槽名先查控件图，再查物品图；都没有时返回白图（和现在一样）。
  - 缺图的日志规则不变：整包缺失打一条 info，缺单张打 warn。
- 编辑器模式：现在用 `db://assets/game/bundles/Skin/<名>.png/spriteFrame` 查 uuid。图集后要改成按 `ctrl.png` 和 `json` 读取，或者编辑器里直接用白图预览。这一点在 ticket 04 里定。
- 版本：对外接口不变，`gmajor` 升修订版本 `0.5.0 → 0.5.1`，`CHANGELOG.md` 写一条。

### 4. 预制体引用（游戏侧风险）

现在 `LyAlert.prefab`、`LySetting.prefab` 等里有直接拖进去的 png 引用（uuid）。图集改造后这些引用会失效。处理方式：

- 预制体里不再直接引用图标，改成在脚本里 `skinFrame('icon_close')` 之类按名取图。
- 框架预制体（`gmajor/prefabs/PfGM*.prefab`）本来就不引用游戏资源，不受影响。

### 5. 动物园素材（素材仓库）

- `FFrame-asset-line`：`style/ZooV7/` 和 `style/LegacyV3/`（旧版的 v3 原图和切片数据）。
- `FFrame-zoo`：`资源生成/` 用 Git LFS 入库，需要先改 `.gitignore`，去掉 `资源生成/` 这一行，再 `git lfs track`。不提交 zoo 现有的 5 个未提交改动。

## 已确认

状态：spec 已由用户确认（2026-10-30）。ticket 02 已做完。ticket 03 先用现成图顶上缺的 8 槽，`item.png` 已打好，出图以后再改。ticket 04、05 的代码已写，预览未跑。物品图不要用控件那套纯代码填色。

1. 主题目录名用 `ZooV7` 和 `LegacyV3`（英文大驼峰），不用 `动物园-v7` 这种写法。
2. v7 母版里的部分件尺寸（例如按钮 288×80）和 2 倍规则不一致。ticket 02 按 2 倍规则重新出图，不直接拿 v7 的 1024 图放大。

## Ticket 清单

- [x] 01 素材仓库整理：建 `FFrame-asset-line/style/ZooV7/` 和 `LegacyV3/` 结构，从 `legacy/FFrame-del/` 迁入历史版本和脚本。
- [x] 02 控件图集：`draw-zoo-v7-ctrl.mjs` 按 2 倍尺寸出 `ctrl.png` 和 `ctrl.json`。名单是 21 个槽，另加 10 个空槽。依赖 01。
- [ ] 03 物品图集：出 `item.png` 和 `item.json`。28 格已打进图集，其中 8 格是现成图复制。依赖 01。
- [ ] 04 GMSkin 图集加载：`gmajor` 支持按主题加载两张图集，升 `0.5.1`。代码已写，预览未跑。无依赖。
- [ ] 05 游戏侧接入：`bundles/Skin` 已分成 `LegacyV3/` 和 `ZooV7/`，开机读 `config.skinTheme`。预览未跑。依赖 02、03、04。
- [ ] 06 动物园素材入库：`FFrame-zoo/资源生成/` 进 LFS。无依赖。
- [ ] 07 文档与规则：更新 `docs/界面组件/`，把 `01-naming` 的“界面控件与默认皮”段落按草案合并，运行 `tools/sync-cursor-rules-index.mjs`。依赖 05。

## 依赖关系

```
01 ──┬── 02 ──┐
     └── 03 ──┼── 05 ── 07
04 ──────────┘
06（独立）
```
