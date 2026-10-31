# 04 GMSkin 图集加载

## 目标

`gmajor` 支持按主题加载两张图集（`ctrl.png` 和 `item.png`），对外接口 `skinFrame(name)`、`applySkin(name, apply)` 不变。

## 范围（文件/目录）

- `FFrame/gmajor/ui/GMSkin.ts`：加载逻辑改成按主题名读取图集和清单。
- `FFrame/gmajor/launch/GMLauncher.ts`：`loadSkin` 调用处如需传主题名，只改这一处。
- `FFrame/gmajor/index.ts`：如有新导出（例如 `setSkinTheme`），只加不删。
- `FFrame/gmajor/ui/PfGMBtn.ts`、`PfGMSlider.ts`、`PfGMBar.ts`、`PfGMStepper.ts`、`PfGMTitle.ts`、`PfGMTabs.ts`：只有取图方式需要改时才动，接口不变。
- `FFrame/extensions/gmajor/package.json`：`version` 改 `0.5.1`。
- `FFrame/gmajor/launch/GMLauncher.ts`：`version` 改 `0.5.1`。
- `FFrame/CHANGELOG.md`：写一条 `0.5.1`，说明新增了图集加载，接口不变。

## 验收标准

- [ ] `loadSkin(theme)` 能读取 `bundles/Skin/<theme>/ctrl.png` 和 `ctrl.json`，并为每个槽建 `SpriteFrame`。代码已写，游戏包里还没有主题目录，预览里没跑过。
- [ ] `skinFrame(name)` 对所有现有槽名都能返回正确的 `SpriteFrame`（rect 和 border 与清单一致）。同上，未在预览里对过。
- [x] 缺槽时返回白图，行为和现在一致。
- [x] 整包缺失时只打一条 info，缺单张打一条 warn。
- [x] 编辑器模式下不报错，预览时能显示控件（可以是白图占位，但不能崩）。不传主题时编辑器仍按单张 png 取；传了主题也不去切图。
- [x] `PfGMBtn`、`PfGMSlider`、`PfGMBar`、`PfGMStepper`、`PfGMTitle`、`PfGMTabs` 的代码不需要因为图集改造而改接口。
- [x] `CHANGELOG.md` 里有 `0.5.1` 条目，写明接口未变。

## 执行记录（2026-10-31）

`loadSkin(theme, onComplete)` 读 `Skin/<theme>/` 里的 `ctrl`、`item` 图和清单。清单 `rect` 从左上角换成纹理左下角。不传主题时仍走原来的逐张图，开机没有改调用。游戏侧目录还没拆，这一步没有在预览里点过主题图集。

## 依赖

无（可以先用旧的逐张图做测试，之后再切换到图集）

## 不做

- 不改控件的行为和尺寸规则。
- 不改游戏侧 `bundles/Skin` 的文件结构（那是 05 的事）。
- 不做主题切换的 UI，只提供 `loadSkin(theme)` 接口。
