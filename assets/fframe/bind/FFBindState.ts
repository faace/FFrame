/**
 * Bundle 标准入口状态。由 FFBundleEntryBase.bind/unbind 推进。
 * 流转：Uncreated -onLoad→ Created -onBind/start/onEnable→ Ready
 *       Ready -onDisable/onUnbind/onDestroy→ Destroyed（再 bind 会重走 onLoad）
 * Binding/Unbinding 为过程态，业务勿长期依赖。详表见 docs/架构/核心简介.md
 */
export enum FFBindState {
    Uncreated = 'uncreated', // 尚未 onLoad（或销毁后重置）
    Created = 'created', // 已 onLoad，尚未完成 bind
    Binding = 'binding', // onBind → start → onEnable 进行中
    Ready = 'ready', // 进场完成，可安全使用
    Unbinding = 'unbinding', // onDisable → onUnbind → onDestroy 进行中
    Destroyed = 'destroyed', // 已销毁；再次 bind 会重走 onLoad
}
