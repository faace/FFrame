import type { GMBindContext } from './GMBindContext';
import { GMBindState } from './GMBindState';
import { GMClassBase } from './GMClassBase';
import type { IGMLifecycle } from './IGMLifecycle';

/** Bundle 对外标准入口（bind / unbind / getState） */
export interface IGMBundleEntry {
    readonly bundleName: string;
    getState(): GMBindState;
    bind(ctx: GMBindContext): Promise<void>;
    unbind(ctx: GMBindContext): Promise<void>;
}

/**
 * 标准入口基类：编排侧调 bind/unbind；内部按序触发生命周期钩子并推进 GMBindState。
 * 状态流转见 GMBindState.ts；业务重写 onInit/onBind/onStart/… 即可。
 */
export abstract class GMBundleEntryBase extends GMClassBase implements IGMBundleEntry {
    constructor(public readonly bundleName: string) {
        super(bundleName);
    }

    /** 进场：Uncreated→Created→Binding→Ready；抛错由 GMBinder 回滚 */
    async bind(ctx: GMBindContext): Promise<void> {
        if (this.state === GMBindState.Ready) return;
        if (this.state === GMBindState.Binding) {
            throw new Error(`[${this.bundleName}] 正在绑定中`);
        }

        const needCreate = this.state === GMBindState.Uncreated || this.state === GMBindState.Destroyed;
        this.setState(GMBindState.Binding);

        try {
            if (needCreate) {
                await this.invoke('onInit');
                this.setState(GMBindState.Created);
            }
            await this.invoke('onBind', ctx);
            await this.invoke('onStart');
            await this.invoke('onEnable');
            this.setState(GMBindState.Ready);
        } catch (err) {
            this.setState(needCreate ? GMBindState.Uncreated : GMBindState.Created);
            throw err;
        }
    }

    /** 退场：Ready→Unbinding→Destroyed；子级联由 GMBinder 负责 */
    async unbind(ctx: GMBindContext): Promise<void> {
        if (this.state === GMBindState.Uncreated || this.state === GMBindState.Destroyed || this.state === GMBindState.Unbinding) {
            return;
        }

        this.setState(GMBindState.Unbinding);
        try {
            await this.invoke('onDisable');
            await this.invoke('onUnbind', ctx);
            this.removeAllEvents();
            await this.invoke('onRemove');
        } finally {
            this.removeAllEvents();
            this.setState(GMBindState.Destroyed);
        }
    }

    asLifecycle(): IGMLifecycle {
        return this;
    }
}
