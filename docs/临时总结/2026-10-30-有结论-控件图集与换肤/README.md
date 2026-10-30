# 控件图集与换肤

## 1. 需求与情况

**需求**：扩充控件库（现在控件太少），并让控件和物品用统一风格的素材。控件和物品各用一张 2048×2048 图集，方便合批、换肤。提示语、生成过程、每个版本、最终采用的素材都要记录下来，入库到 git，换电脑能接着做。

**当时的情况**：
- 游戏里 `bundles/Skin/` 是 27 张独立的 48 像素小图，是从 v3（奶油底色）切出来再用脚本重画的版本。
- 控件母版 `ui-sheet-v7` 的提示词写明"same pixel craft as the zoo map"，和动物园母图风格一致。
- 素材分散在三处：`FFrame/del/ui-style/`（v1–v7 图和提示词，不入库）、`FFrame-asset-line/style/`（画风文档和动物园效果图，已入库）、`FFrame-zoo/资源生成/`（动物园素材 193MB，被 `.gitignore` 排除，没入库）。
- `FFrame/.gitignore` 里有 `/del/`，所以 `del/` 下的东西不进 git。

## 2. 尝试

- 对比 `ui-sheet-v3` 和 `ui-sheet-v7`，确认 v7 更接近动物园风格，游戏现在的 `Skin` 是 v3 的重画版。
- 查 `.gitignore`：确认 `del/` 和 `资源生成/` 都被忽略，素材没入库。
- 本机 `git lfs version` 为 3.5.1，已安装，不需要额外装。
- 逐条 grilling 17 项决策，每条都给出推荐答案，你逐条回答，全部记入 `docs/specs/控件图集与换肤/共识.md`。
- 写 `spec.md` 和 7 张 ticket（01–07）。
- 查代码时发现：`LySetting.prefab`、`LyAlert.prefab`、`ScDemoHome.scene` 直接用 uuid 引用了旧 png，图集改造后会失效，已写进 ticket 05。
- 发现控件实际是 **20 件**（包括 4 个按钮上的小图标），之前我说的 16 件、17 件有误，已在共识里改正。
- 发现 v7 母版里很多件的尺寸不符合 2 倍规则（例如按钮 288×80），02、03 要重新出图，不能直接放大 v7 的 1024 图。
- 第一次尝试用 AskQuestion 选择框提问，被工具判定为占位，之后改用纯文字逐条提问，符合 grilling 的做法。
- 没有做过的：没有写任何代码，没有生成图，没有迁移文件，没有改 `.cursor/rules/`。
- 之后：用户确认主题目录名 `ZooV7`、`LegacyV3` 和 spec 整体。共识加入决策 17，spec 状态改为"已确认"，本记录夹改名为"有结论"。

## 3. 结论

有结论。共识和 spec 已经由你确认：主题目录名用 `ZooV7` 和 `LegacyV3`（英文大驼峰，代替共识里举例的 `动物园-v7`），spec 和 7 张 ticket 整体没问题。共识已写入 `docs/specs/控件图集与换肤/共识.md`（决策 17），spec 状态已改为"已确认"。

## 4. 接着做

- 在**新 session** 里运行 `/implement 01`，从素材仓库整理开始。每条 ticket 各开一个新 session。
- **换电脑前必须先做 ticket 01**：`FFrame/del/ui-style/` 不进 git，另一台电脑拿不到 v7 图和提示词。要先把它们迁到 `FFrame-asset-line` 并推送。
- `FFrame-zoo` 有 5 个未提交改动，其中大部分是 CRLF 行尾变化，需要你决定怎么处理。
- `.cursor/rules/01-naming.mdc` 的更新放在 ticket 07，等实际目录结构定下来再做，并且写入前要先给你看草案。
- 用户还有其它问题要问，回答后如果影响到 spec，要先更新 spec 再继续。
- 用户指示：本记录夹已提交到 git，**做完这件事后删除**（连同索引里的那一行）。

## 5. 产物

- `del/ui-style`（只读，没有写入）：子文件夹 1 个（`orig`，不含自己）。文件 44 个：`.png` 33 个、`.txt` 10 个、`.json` 1 个，没有无扩展名文件。
- 没有拷贝任何 del 文件进本记录夹。
- 本次新增的 git 文档（不在 del 下）：`docs/specs/控件图集与换肤/共识.md`、`spec.md`、`tickets/01–07`，共 9 个 `.md`。
