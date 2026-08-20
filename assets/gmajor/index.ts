/**
 * GMajor 核心出口 = 模块一览（先看本文件再下钻）。
 * 目录：launch/ event/ resource/ bind/ ui/ data/；用法表：docs/架构/核心简介.md
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
export { GMLayer } from './ui/GMLayer'; // Layer 基类；Ly* 继承；默认 scale 入场
export { GMScene } from './ui/GMScene'; // 场景基类；Sc* 继承（→Layer→Component）；默认 opacity
export { GMUIManager } from './ui/GMUIManager'; // 视图门面：openScene / showLayer / loading
export type { GMOpenSceneOptions, GMShowLayerOptions, GMLoadingShowOptions } from './ui/GMUIManager';

// —— data/ ——
export { GMKvStore } from './data/GMKvStore'; // LocalStore / web 假服信封读写
export { GMRemoteAdapter } from './data/GMRemoteAdapter'; // 拉树；web 用 localStorage 当假服
export { GMStoreHub } from './data/GMStoreHub'; // gd / gl 枢纽：建拆树、apply / sync / watch
export type { GMDataRoot, GMLocalRoot, GMWatchCb, GMWatchRoot } from './data/GMStoreHub';

// —— launch/ ——
export { config } from './config'; // 框架配置（版本）；跟 gmajor/ 走
export { gm, gd, gl, registerBundleEntry } from './launch/GMLauncher'; // gm 全局单例；gd===gm.data；gl===gm.local
export type { GMCore } from './launch/GMLauncher';
