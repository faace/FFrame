/**
 * FFrame 核心出口 = 模块一览（先看本文件再下钻）。
 * 目录：launch/ event/ resource/ bind/ ui/；用法表：docs/架构/核心简介.md
 */

// —— event/ ——
export { FFEventManager } from './event/FFEventManager'; // 全局事件（优先级/once/拦截/onXxx）
export type { FFEvent, FFEventListener } from './event/FFEventManager';

// —— resource/ ——
export type { FFAsyncComplete, FFAsyncCompleteWith, FFAsyncProgress } from './resource/FFAsyncCallback'; // 完成在前、onProgress 可选
export type { IFFResource } from './resource/IFFResource'; // Bundle / 资源加载能力接口
export { FFCocosResource } from './resource/FFCocosResource'; // assetManager 实现

// —— bind/ ——
export { FFBindState } from './bind/FFBindState'; // 入口状态机
export type { IFFLifecycle } from './bind/IFFLifecycle'; // 编排侧生命周期契约
export { FFClassBase } from './bind/FFClassBase'; // 逻辑侧通用基类（含实例事件）
export { FFBindContext } from './bind/FFBindContext'; // 绑定时上下文
export { FFBinder } from './bind/FFBinder'; // load/bind/unbind、嵌套、回滚
export type { FFBindOptions } from './bind/FFBinder';
export { FFBundleRegistry } from './bind/FFBundleRegistry'; // 标准入口自登记表
export { FFBundleEntryBase } from './bind/FFBundleEntryBase'; // Bundle 标准入口基类
export type { IFFBundleEntry } from './bind/FFBundleEntryBase';

// —— ui/ ——
export { FFComponent } from './ui/FFComponent'; // UI 通用基类；业务 onInit/onStart/onRemove
export { FFLayer } from './ui/FFLayer'; // Layer 基类；Ly* 继承；默认 scale 入场
export { FFScene } from './ui/FFScene'; // 场景基类；Sc* 继承（→Layer→Component）；默认 opacity
export { FFUIManager } from './ui/FFUIManager'; // 视图门面：openScene / showLayer / loading
export type { FFOpenSceneOptions, FFShowLayerOptions, FFLoadingShowOptions } from './ui/FFUIManager';

// —— launch/ ——
export { ff, registerBundleEntry } from './launch/FFLauncher'; // ff 全局单例（含 ff.ui）；Bundle 入口自登记
export type { FFCore } from './launch/FFLauncher';
