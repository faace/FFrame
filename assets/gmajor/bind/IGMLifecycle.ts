import type { GMBindContext } from './GMBindContext';
import type { GMBindState } from './GMBindState';

/**
 * 编排侧生命周期契约（Binder 只认此接口；非节点自动调）。
 * 与 state 对照见 GMBindState.ts、docs/架构/核心简介.md
 */
export interface IGMLifecycle {
    readonly bindId: string;
    getState(): GMBindState;

    onInit?(): void; // [→Created] 首次准备
    onBind?(ctx: GMBindContext): void | Promise<void>; // [Binding] 进场；可 bindChild
    onStart?(): void; // [Binding] 依赖就绪
    onEnable?(): void | Promise<void>; // [→Ready] 启用（预留）
    onDisable?(): void | Promise<void>; // [Unbinding] 停用（预留）
    onUnbind?(ctx: GMBindContext): void | Promise<void>; // [Unbinding] 解绑清理
    onRemove?(): void; // [→Destroyed] 销毁；此时本入口事件与 watch 已卸
}
