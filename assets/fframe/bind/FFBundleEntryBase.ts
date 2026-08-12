import type { FFBindContext } from './FFBindContext';
import { FFBindState } from './FFBindState';
import { FFClassBase } from './FFClassBase';
import type { IFFLifecycle } from './IFFLifecycle';

/** Bundle 对外标准入口（bind / unbind / getState） */
export interface IFFBundleEntry {
    readonly bundleName: string;
    getState(): FFBindState;
    bind(ctx: FFBindContext): Promise<void>;
    unbind(ctx: FFBindContext): Promise<void>;
}

/**
 * 标准入口基类：编排侧调 bind/unbind；内部按序触发生命周期钩子并推进 FFBindState。
 * 状态流转见 FFBindState.ts；业务重写 onLoad/onBind/start/… 即可。
 */
export abstract class FFBundleEntryBase extends FFClassBase implements IFFBundleEntry {
    constructor(public readonly bundleName: string) {
        super(bundleName);
    }

    /** 进场：Uncreated→Created→Binding→Ready；抛错由 FFBinder 回滚 */
    async bind(ctx: FFBindContext): Promise<void> {
        if (this.state === FFBindState.Ready) return;
        if (this.state === FFBindState.Binding) {
            throw new Error(`[${this.bundleName}] 正在绑定中`);
        }

        const needCreate = this.state === FFBindState.Uncreated || this.state === FFBindState.Destroyed;
        this.setState(FFBindState.Binding);

        try {
            if (needCreate) {
                await this.invoke('onLoad');
                this.setState(FFBindState.Created);
            }
            await this.invoke('onBind', ctx);
            await this.invoke('start');
            await this.invoke('onEnable');
            this.setState(FFBindState.Ready);
        } catch (err) {
            this.setState(needCreate ? FFBindState.Uncreated : FFBindState.Created);
            throw err;
        }
    }

    /** 退场：Ready→Unbinding→Destroyed；子级联由 FFBinder 负责 */
    async unbind(ctx: FFBindContext): Promise<void> {
        if (this.state === FFBindState.Uncreated || this.state === FFBindState.Destroyed || this.state === FFBindState.Unbinding) {
            return;
        }

        this.setState(FFBindState.Unbinding);
        try {
            await this.invoke('onDisable');
            await this.invoke('onUnbind', ctx);
            await this.invoke('onDestroy');
        } finally {
            this.removeAllEvents();
            this.setState(FFBindState.Destroyed);
        }
    }

    asLifecycle(): IFFLifecycle {
        return this;
    }
}
