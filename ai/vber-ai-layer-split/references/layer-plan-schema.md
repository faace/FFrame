# 分层计划 JSON

## 目录

- 数据结构
- 字段规则
- 素材判断规则
- 排序约定
- 示例

## 数据结构

```json
{
  "version": 1,
  "imageName": "已上传图片名称",
  "source": { "width": 1080, "height": 1920 },
  "request": "需要按钮、货币图标和状态条",
  "options": {
    "deduplicate": true,
    "splitText": false,
    "clearExisting": true,
    "submitAfterConfirmation": true,
    "download": false
  },
  "regions": [
    {
      "id": "start-button",
      "name": "开始按钮",
      "role": "button",
      "rect": { "x": 360, "y": 1500, "width": 360, "height": 120 },
      "priority": 80,
      "reuseKey": "start-button",
      "include": true,
      "reason": "运行时独立点击并切换状态"
    }
  ]
}
```

## 字段规则

- `version`：固定为 `1`。
- `imageName`：VberAI 中的精确名称，非模糊描述。
- `source`：源图固有像素尺寸。
- `request`：保留用户原始素材需求的简短文本。
- `options`：把默认选择写清楚，便于复现。
- `regions[].id`：小写字母、数字和连字符组成，计划内唯一。
- `regions[].name`：面向用户的语义名称。
- `regions[].role`：建议使用 `background`、`button`、`icon`、`panel`、`avatar`、`bar`、`badge`、`decoration`、`text-art`。
- `regions[].rect`：源图像素坐标；左上角为原点；宽高必须为正数且不得越界。
- `regions[].priority`：整数，数字越大越靠前、越优先取得重叠像素。
- `regions[].reuseKey`：视觉相同的候选使用同一值；去重开启时只保留一个。
- `regions[].include`：设为 `false` 时保留排除记录，但不在页面画框。
- `regions[].reason`：说明运行时用途或排除原因。

## 素材判断规则

把“运行时组件”作为最小拆分单位，而不是把每个视觉轮廓作为一个素材。

包括：

- 会独立点击、隐藏、移动、复用或换皮的按钮和图标。
- 会独立变化的血条、能量条、货币底板和状态组件。
- 需要单独摆放的头像框、徽章、宝箱和导航图标。
- 用户明确要求的完整背景层。

通常排除：

- 纯装饰裂纹、阴影、噪点和与背景不可分的纹理。
- 可以由界面代码渲染的普通文字和数字。
- 外观相同且用途相同的重复实例。
- 已经被一个更合理的完整组件包含的内部碎片。

按钮若需要多语言或动态文字，拆底板、不拆普通文字。文字本身是美术资产时，可使用 `text-art` 单独拆出。

## 排序约定

排序只影响相交区域。最终目标顺序按 `priority` 从高到低排列；相同优先级保持计划中的原顺序。

发生相交时：

- 明确前景图标高于背景板。
- 小组件高于包含它的大区域。
- 完整按钮与装饰相交时，以用户运行时需要完整保留的对象优先。
- 背景通常最低。

不要仅按面积排序；语义优先级更重要。

## 示例

下面表示保留一份货币图标、一个数值底板和一个完整按钮，并明确排除重复图标：

```json
{
  "version": 1,
  "imageName": "首页方案 A",
  "source": { "width": 1080, "height": 1920 },
  "request": "货币区和主按钮",
  "options": {
    "deduplicate": true,
    "splitText": false,
    "clearExisting": true,
    "submitAfterConfirmation": true,
    "download": false
  },
  "regions": [
    { "id": "currency-icon", "name": "货币图标", "role": "icon", "rect": { "x": 40, "y": 44, "width": 96, "height": 96 }, "priority": 100, "reuseKey": "currency-icon", "include": true, "reason": "独立复用" },
    { "id": "currency-bg", "name": "货币数值底板", "role": "panel", "rect": { "x": 104, "y": 58, "width": 220, "height": 68 }, "priority": 40, "reuseKey": "currency-bg", "include": true, "reason": "承载动态数值" },
    { "id": "currency-icon-copy", "name": "重复货币图标", "role": "icon", "rect": { "x": 380, "y": 44, "width": 96, "height": 96 }, "priority": 100, "reuseKey": "currency-icon", "include": false, "reason": "与 currency-icon 相同" },
    { "id": "primary-button", "name": "主按钮底板", "role": "button", "rect": { "x": 300, "y": 1600, "width": 480, "height": 140 }, "priority": 80, "reuseKey": "primary-button", "include": true, "reason": "独立点击；文字由程序渲染" }
  ]
}
```

