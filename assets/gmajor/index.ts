/**
 * GMajor 核心出口 = 模块一览（先看本文件再下钻）。
 * 目录：launch/ event/ resource/ bind/ ui/ data/ platform/；用法表：docs/架构/核心简介.md
 */

// —— event/ ——
export { GMEventManager } from './event/GMEventManager'; // 全局事件（优先级/once/拦截/onXxx）
export type { GMEvent, GMEventListener } from './event/GMEventManager';

// —— resource/ ——
export type { GMAsyncComplete, GMAsyncCompleteWith, GMAsyncProgress } from './resource/GMAsyncCallback'; // 完成在前、onProgress 可选
export type { IGMResource } from './resource/IGMResource'; // Bundle / 资源加载能力接口
export { GMCocosResource } from './resource/GMCocosResource'; // assetManager 实现

// —— bind/ ——
export { GMBindState } from './bind/GMBindState'; // 入口状态机
export type { IGMLifecycle } from './bind/IGMLifecycle'; // 编排侧生命周期契约
export { GMClassBase } from './bind/GMClassBase'; // 逻辑侧通用基类（事件 + watch + spawn）
export { GMBindContext } from './bind/GMBindContext'; // 绑定时上下文
export { GMBinder } from './bind/GMBinder'; // load/bind/unbind、嵌套、回滚
export type { GMBindOptions } from './bind/GMBinder';
export { GMBundleRegistry } from './bind/GMBundleRegistry'; // 标准入口自登记表
export { GMBundleEntryBase } from './bind/GMBundleEntryBase'; // Bundle 标准入口基类
export type { IGMBundleEntry } from './bind/GMBundleEntryBase';

// —— ui/ ——
export { GMComponent } from './ui/GMComponent'; // UI 通用基类；业务 onInit/onStart/onRemove；watch 随节点卸
export { PfGMBtn, PfGMBtnSize, PfGMBtnStyle, PfGMBtnTheme } from './ui/PfGMBtn'; // 框架按钮；theme 对 Skin 同名底板，style 版式，size 档位
export { PfGMTitle } from './ui/PfGMTitle'; // 框架标题；自己取 TitleBar；setText 按字宽拉条
export { PfGMSlider } from './ui/PfGMSlider'; // 框架滑条；轨道+滑块；value 0–1；自己听拖动
export { PfGMBar } from './ui/PfGMBar'; // 框架进度条；槽+填充；value 0–1；九宫格拉宽
export { PfGMStepper } from './ui/PfGMStepper'; // 框架步进；嵌套 PfGMBtn；整数 value/min/max/step
export { loadSkin, applySkin, skinFrame, SKIN_BUNDLE } from './ui/GMSkin'; // 游戏 Skin 包；缺槽用内置白图
export { GMLayer } from './ui/GMLayer'; // Layer 基类；Ly* 继承；mask+panel 入场；场景不套
export { GMAlert } from './ui/GMAlert'; // 确认框基类；皮在本游戏常驻包
export type { GMAlertInit } from './ui/GMAlert'; // gu.alert 填进确认框的文案和关闭
export { GMScene } from './ui/GMScene'; // 场景基类；Sc* 继承（→Layer→Component）；默认 opacity
export { GMUIManager } from './ui/GMUIManager'; // 视图门面：openScene / showLayer / addClick / createTs / alert；设计分辨率 720×1280，宽适配
export type { GMOpenSceneOptions, GMShowLayerOptions, GMLoadingShowOptions, GMAddClickOpts, GMClickPress, GMCreateTsNodeParm, GMAlertParams, GMAlertBtn } from './ui/GMUIManager';

// —— data/ ——
export { GMKvStore } from './data/GMKvStore'; // LocalStore / web 假服信封读写
export { GMRemoteAdapter } from './data/GMRemoteAdapter'; // 拉树；web 用 localStorage 当假服
export { GMStoreHub } from './data/GMStoreHub'; // gd / gl 枢纽：建拆树、apply / sync / watch
export type { GMDataRoot, GMLocalRoot, GMWatchCb, GMWatchRoot } from './data/GMStoreHub';

// —— launch/ ——
export { gm, gd, gl, gu, gp, version, registerBundleEntry } from './launch/GMLauncher'; // gm 全局单例；gd===gm.data；gl===gm.local；gu===gm.ui；gp===gm.platform；version 框架版本
export type { GMCore } from './launch/GMLauncher';
export type { GMGameConfig, GMBootOpts } from './launch/GMBoot'; // 项目开机配置；gm.boot 吃这个

// —— platform/ ——
export { GMPlatform, toGpEventName } from './platform/GMPlatform'; // 平台基类；游戏只喊 gp；推送事件名 Gp*
export type { GMPlatformId, GMPlatformParams, GMPlatformMsg } from './platform/GMPlatform';
