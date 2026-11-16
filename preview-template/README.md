# Web Preview 调试工具

本工程在 **编辑器浏览器 Preview** 下使用的调试能力：**节点树查看 / 改属性** + **UI 改动写回 Prefab**。

全部落在工程根目录，**不修改 `assets/`**，也不改 Cocos 安装目录。

## 功能概览

### ccc-devtools（节点树）

- 实时浏览场景节点树
- 选中节点后编辑 Transform、UITransform、Label、Sprite、UIOpacity、Layout 等
- 高亮节点、输出引用到控制台
- 可选 Profiler 浮窗

来源：[potato47/ccc-devtools](https://github.com/potato47/ccc-devtools) 3.x 模板（Preact）。

### WebSync（同步写回）

- **记录基准**：锁定当前页的 UI 状态
- 在 DevTools 里拖动 / 改数值
- **同步**：把相对基准的改动 POST 到编辑器，写入对应 `.prefab`
- **画布点选**：在 Game 画布上点节点，自动在 DevTools 里定位

## 目录结构

```text
preview-template/
  README.md                 ← 本文件
  index.ejs                 ← Cocos 预览页模板（注入 devtools + web-sync）
  devtools/assets/          ← ccc-devtools 静态资源
  web-sync/
    web-sync-debug.js       ← WebSync 运行时脚本
    devtools-overrides.css  ← 文字对比度 + WebSync 底栏样式

extensions/web-sync-helper/ ← 编辑器扩展，监听 7457 写 prefab
```

## 首次启用

1. 打开 **扩展 → 扩展管理器**，启用 **`web-sync-helper`**
2. **完全重启** Cocos Creator（`preview-template` 只在启动时加载）
3. 菜单 **项目 → 预览**，或浏览器打开 Preview URL
4. 预览页 **右侧** 点击 **DevTools 图标** 打开节点树面板（打开后底部才出现 WebSync 工具条）

控制台应能看到 `[web-sync-helper] 已启动 (7457)`（扩展加载成功时）。

## 日常使用流程

```text
打开 DevTools（右侧面板）
  → 底栏点「记录基准」
  → 在 DevTools 里改节点位置 / 尺寸 / Layout …
  → 底栏点「同步 (S)」
  → 回到编辑器刷新 Prefab，人工 diff 验收
```

**务必先记录基准再改 UI**，否则无法计算 diff。

## 界面说明

DevTools 面板在 **右侧**（ccc-devtools 默认布局）。开关在预览页 **右上角**。

| 位置 | 按钮 | 说明 |
|------|------|------|
| 右上角（DevTools 开关左侧） | 缓存图标 | 查看 assetManager 已加载资源（纹理预览、大小），快捷键 `R`；不依赖 DevTools 是否打开 |
| 右上角 | DevTools 图标 | 打开 / 关闭节点树面板（快捷键 `D`） |

### DevTools 面板右上角

| 按钮 | 说明 |
|------|------|
| 刷新·1s (C) 等 | 节点树刷新频率（见下节），快捷键 `C` 循环切换 |

### DevTools 底栏（WebSync，仅 DevTools 打开时显示）

| 按钮 | 说明 |
|------|------|
| 记录基准 | 记录当前页 prefab 节点状态 |
| 同步 (S) | 写回 Prefab |

上方状态行：当前页、是否已记录基准、待同步数量。

### DevTools 节点树搜索栏旁

| 按钮 | 说明 |
|------|------|
| 当前页 | 在树中定位当前弹层；没有弹层时定位场景 Canvas |
| 点选 (P) / 取消 (P) | 画布点选并定位；再按 P 或再点按钮取消 |

### 节点树刷新频率

原版 ccc-devtools 用 `requestAnimationFrame` 刷新节点树，约 **60 次/秒**（不是 1 秒 1 次），容易整屏闪。

已 patch `devtools/assets/index.js`，改为可配置模式。面板右上角 **「刷新·… (C)」** 按钮循环切换（顺序）：

| 显示 | 含义 |
|------|------|
| 刷新·原版 (C) | 原版 `requestAnimationFrame`，约 60 次/秒 |
| 刷新·½频 (C) | 原版一半，隔帧刷新，约 30 次/秒 |
| 刷新·1s (C) | 每 1 秒刷新（**默认**） |
| 刷新·不刷 (C) | 暂停自动刷新 |

选择会写入 `localStorage cc_devtools_tree_refresh_mode`。

### DevTools 面板

- 右侧可拖拽调整宽度（宽度会记在 `localStorage cc_devtools_width`）
- **每次打开 Preview 默认关闭**；会话内可用 `D` 或右上角按钮开关（不写回 localStorage，刷新后仍关闭）
- 与项目 `GameState` / 业务 debug 模式无关

## 快捷键

| 按键 | 作用 |
|------|------|
| `D` | 打开 / 关闭 DevTools 面板（输入框聚焦时不触发） |
| `C` | 循环切换节点树刷新档位（DevTools 已展开且输入框未聚焦时） |
| `R` | 打开 / 关闭资源缓存查看（assetManager 纹理等） |
| `P` | 切换画布点选：DevTools 收起时先展开并进入点选；已展开时第一次开启、第二次取消（输入框聚焦时不触发） |
| `S` | 同步写回 |
| `Ctrl+Shift+S` | 同步写回 |
| `Esc` | 也可退出点选（同再按 `P`） |
| `Alt + 点击画布` | 单次点选并定位（无需先开点选模式） |

## 当前页判定

WebSync 认为「当前页」按这个顺序取，都要求 **activeInHierarchy**：

1. `GMOverlay/alerts` 下 sibling 索引最大的子节点（确认框画在弹层上面）
2. 否则 `GMOverlay/layers` 下 sibling 索引最大的子节点
3. 都没有时用场景 `Canvas`

`loading`、`toasts` 不参与。无需在 `assets` 里挂调试脚本。

## 同步写回支持字段

| 类型 | 字段 |
|------|------|
| Node | `x`, `y`, `scaleX`, `scaleY`, `angle`（写入 `_lpos` / `_lscale` / `_euler`） |
| UITransform | `width`, `height` |
| Layout | `spacingX/Y`, `paddingLeft/Right/Top/Bottom` |
| UIOpacity | `opacity` |
| Label / Sprite | `color`（rgba） |

暂不支持：Widget 边距、Spine、自定义脚本属性、任意嵌套 prefab 槽位自动映射。写回后请人工检查。

## 更新 ccc-devtools

```bash
npx cccdev@latest init --force
```

该命令会覆盖 `devtools/` 和 `index.ejs`。**更新后必须**：

1. 保留 `index.ejs` 中的定制：

```html
<link rel="stylesheet" href="./web-sync/devtools-overrides.css" />
<script>/* cc_devtools_tree_refresh_mode 初始化 */</script>
<script src="./web-sync/web-sync-debug.js"></script>
```

2. **重新打节点树刷新 patch**（否则又回到 60fps 刷屏）：

```powershell
node preview-template/web-sync/patch-devtools-tree-refresh.cjs
```

## 故障排查

| 现象 | 处理 |
|------|------|
| 预览页无 DevTools 按钮 | 重启编辑器；确认存在 `preview-template/index.ejs` |
| 「无法连接编辑器」 | 启用 `web-sync-helper` 并重启编辑器 |
| 「同步失败 404」 | 确认 7457 端口未被占用；看扩展是否报错 |
| 改了 UI 但同步数为 0 | 是否先点「记录基准」；改动是否在当前页 prefab 内 |
| 写回后编辑器里数值不对 | 刷新 Prefab；复杂节点用 MCP / 人工改盘 |
| 更新 cccdev 后 WebSync 消失 | 检查 `index.ejs` 定制项；运行 `patch-devtools-tree-refresh.mjs` |
| 节点树闪屏 | 点右上角「刷新·…」改为「刷新·不刷」，或按 `C` 切换 |

## 与 MCP / 正式构建的关系

- **Preview + DevTools**：只看运行态、快速试布局；适合人工调 UI
- **MCP `workflow.mjs`**：改 prefab 结构、批量 mutator；适合 agent 落盘
- **正式 Web / 微信包**：不包含本目录内容，无需在构建配置里排除

DevTools 里改过的值 **不是** prefab 唯一事实源；同步写回后仍应按项目规范 review diff。

## 相关链接

- [Cocos 自定义网页预览](https://docs.cocos.com/creator/3.8/manual/zh/editor/preview/browser.html)
- [ccc-devtools GitHub](https://github.com/potato47/ccc-devtools)
- 工程内 MCP 说明：`docs/rules/mcp-ops.md`
