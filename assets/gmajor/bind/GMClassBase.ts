import type { GMBindContext } from './GMBindContext';
import { GMBindState } from './GMBindState';
import { GMEventHost } from '../event/GMEventHost';
import type { GMEvent } from '../event/GMEventManager';
import type { IGMLifecycle } from './IGMLifecycle';

type HookName =
    | 'onInit'
    | 'onBind'
    | 'onStart'
    | 'onEnable'
    | 'onDisable'
    | 'onUnbind'
    | 'onRemove';

/** 逻辑侧通用基类（不挂 Component）；自带实例事件 on/off/emit */
export abstract class GMClassBase implements IGMLifecycle {
    private _state: GMBindState = GMBindState.Uncreated;
    private readonly _events = new GMEventHost(this);

    constructor(public readonly bindId: string) {}

    getState(): GMBindState {
        return this._state;
    }

    protected get state(): GMBindState {
        return this._state;
    }

    protected setState(state: GMBindState): void {
        this._state = state;
    }

    /** 监听（listener 为 this，需实现 on{EventName}）；销毁/解绑时自动卸 */
    on(eventNames: string | string[], priority = 0, once = -1): this {
        this._events.on(eventNames, priority, once);
        return this;
    }

    off(eventNames: string | string[]): this {
        this._events.off(eventNames);
        return this;
    }

    onAny(priority = 0, once = -1): this {
        this._events.onAny(priority, once);
        return this;
    }

    offAny(): this {
        this._events.offAny();
        return this;
    }

    emit(event: GMEvent | string, data?: any): this {
        this._events.emit(event, data);
        return this;
    }

    /** 卸掉本实例通过 on/onAny 登记的监听 */
    removeAllEvents(): void {
        this._events.removeAll();
    }

    /** 若子类实现了对应钩子则 await 调用 */
    protected async invoke(hook: HookName, ctx?: GMBindContext): Promise<void> {
        const fn = (this as IGMLifecycle)[hook];
        if (typeof fn !== 'function') return;
        if (hook === 'onBind' || hook === 'onUnbind') {
            await (fn as (c: GMBindContext) => void | Promise<void>).call(this, ctx as GMBindContext);
        } else {
            await (fn as () => void | Promise<void>).call(this);
        }
    }
}
