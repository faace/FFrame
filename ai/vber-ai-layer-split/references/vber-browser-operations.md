# VberAI 浏览器操作

## 目录

- 连接和定位
- 图片进入项目
- 坐标校准
- 程序化框选
- 排序
- 提交
- 下载
- 故障处理

## 连接和定位

使用 `chrome:control-chrome` 连接用户已有的 VberAI 标签页。通过 `chrome.user.openTabs()` 查找 `https://studio.vberai.com/editor`，再用 `chrome.user.claimTab(tabInfo)` 取得控制权。

使用可见 UI 精确搜索 `imageName`，不要按列表序号选择。进入图层拆分后先获取源图固有尺寸和当前显示边界。

### 分层状态门禁

定位并选中目标图片后，必须点击图片操作工具栏中的“图层拆分”，再验证以下可见状态同时成立：

- 标题“图层拆分”可见。
- 当前步骤说明“框选元素”可见。
- “取消”和“下一步”操作区可见；没有框选时“下一步”应为禁用状态。

主编辑器中的选中框、图片尺寸标签、图片操作工具栏或缩放百分比都不能替代此验证。未通过门禁时不得读取分层画布边界、生成矩形计划、导入框选工具或发送拖拽事件。

## 图片进入项目

- 项目内已有图片：按名称定位并直接使用。
- 本地图片：读取文件字节，使用 `tab.clipboard.write()` 写入 `image/png` 或 `image/jpeg`，点击画布后按 `Meta+V`（Windows 使用 `Control+V`）。确认新增节点后按文件名重命名。

```js
await tab.clipboard.write([{
  entries: [{ mimeType: "image/png", base64 }],
  presentationStyle: "inline"
}]);
await canvas.click();
await body.press("Meta+V");
```

普通单图优先使用粘贴，不依赖单独上传按钮。

页面读取使用 `tab.playwright`。需要发送精确鼠标事件时，从标签页取得已支持的 CDP 会话，并在 Node 控制会话中导入：

```js
const layerTool = await import("/absolute/path/to/vber-ai-layer-split/scripts/vber-browser-tool.mjs");
```

## 坐标校准

从承载源图的可见元素读取 `getBoundingClientRect()`。该读取只用于测量，不修改页面。

显示边界必须对应图像内容本身，不能包含侧栏、外框、留白或控制点。记录：

```js
const displayedImageRect = { x, y, width, height };
```

若画布支持任意缩放，工具会分别计算 X/Y 比例。框选过程中禁止改变页面缩放、画布缩放和滚动位置。

## 程序化框选

读取并验证计划，然后调用：

```js
await layerTool.drawRegionsWithCdp(cdp, plan, displayedImageRect, {
  pauseMs: 80,
  insetPx: 0
});
```

该函数只处理 `include !== false` 的区域，并依次发送按下、移动、释放事件。执行完成后比较页面显示的区域数量与函数返回的 `drawn`。

如果鼠标事件未落在框选模式，先用可见 UI 激活矩形框选工具，再重新执行。不得在未知模式下连续重试。

## 排序

从页面区域列表读取当前 ID 或稳定名称数组，目标数组按 `priority` 从高到低生成：

```bash
node scripts/layer-plan.mjs target plan.json
node scripts/layer-plan.mjs moves current.json target.json
```

`moves` 输出相邻移动操作。将每步映射到页面对应行的“上移”或“下移”按钮。每完成一组动作重新读取顺序，不能假定点击全部成功。

仅在预览缺块与区域相交有关时调整排序。若区域不相交，排序不会修复裁剪错误。

## 提交

提交属于不可逆的远端变更。先把截图、素材清单和数量交给用户确认；只有用户明确确认后点击提交。

提交完成后等待生成项目出现，通常名称带 `_layer` 后缀。验证生成项目的子图层数量和预览，不根据后缀本身断言成功。

## 下载

优先级：

1. 网站正式导出/下载功能。
2. 编辑器已加载的节点图片 Blob、Base64 或图片哈希映射。
3. 仅当用户明确接受降级时才使用截图。

通过内部图片数据下载时，不调用跨域 Canvas 重绘；直接保存原 PNG 字节以保留 Alpha。文件名来自计划中的稳定 ID，并清理非法路径字符。

下载后检查 PNG 签名、尺寸、Alpha、非全透明像素和文件数量。不要把已经透明的拆分结果再送去 AI 抠图。

## 故障处理

### 框选漂移

重新读取图像显示边界和源图尺寸；检查页面滚动、缩放和侧栏展开是否变化。清空本轮错误框选后一次性重画。

### 数量不一致

确认 `include:false` 和去重项未被计入目标数量；检查拖拽是否小于网站最小矩形尺寸或起点落在已有控制点上。

### 未进入分层步骤

回到主编辑器，重新按精确名称选择目标图片并点击“图层拆分”。只重试一次；若仍看不到标题、步骤说明和底部操作区，停止操作并报告站点结构或状态异常。

### 预览缺块

先计算相交区域并检查层级。排序无效时再检查矩形范围，不要同时修改范围和层级。

### 跨域无法打包

优先读取应用已经持有的原始节点图片数据。跨域限制只说明页面不能重新绘制并导出，不代表原始资源不存在。

### 站点内部接口变化

停止直接调用未知内部方法。回到可见 UI，通过 DOM 测量 + CDP 坐标拖拽执行；更新 Skill 工具前先在单个测试框上验证。
