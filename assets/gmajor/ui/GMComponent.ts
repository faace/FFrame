import { _decorator, Component } from 'cc';
import { GMEventHost } from '../event/GMEventHost';
import type { GMEvent } from '../event/GMEventManager';
import { GMWatchHost } from '../data/GMWatchHost';
import type { GMWatchCb, GMWatchRoot } from '../data/GMStoreHub';

const { ccclass } = _decorator;

/**
 * UI 通用基类（挂 Component）。
 * 业务写 onInit/onStart/onRemove；不要重写 onLoad/start/onDestroy。
 */
@ccclass('GMComponent')
export class GMComponent extends Component {
    private _events!: GMEventHost; // onLoad 里创建
    private _watches!: GMWatchHost;

    onInit?(): void; // 与 onLoad 同时机；可 this.on / this.watch
    onStart?(): void; // 与 start 同时机
    onRemove?(): void; // 与 onDestroy 同时机；此时事件与 watch 已卸
    init?(parm?: unknown): void; // 入树后由 createTs 带参调用；与 onInit 独立

    onLoad(): void { // 引擎回调；业务用 onInit，不要重写
        this._events = new GMEventHost(this);
        this._watches = new GMWatchHost();
        this.onInit?.();
    }

    start(): void { // 引擎回调；业务用 onStart，不要重写
        this.onStart?.();
    }

    onDestroy(): void { // 引擎回调；业务用 onRemove，不要重写
        this._watches?.removeAll();
        this._events.removeAll();
        this.onRemove?.();
    }

    /** 监听（listener 为 this，需实现 on{EventName}）；节点销毁时自动卸 */
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

    removeAllEvents(): void {
        this._events.removeAll();
    }

    /** 字段监听（节点销毁时自动卸）；root 传 gd 或 gl */
    watch(root: GMWatchRoot, name: string, key: string, cb: GMWatchCb): this {
        this._watches.watch(root, name, key, cb);
        return this;
    }

    unwatch(root: GMWatchRoot, name: string, key: string, cb: GMWatchCb): this {
        this._watches.unwatch(root, name, key, cb);
        return this;
    }

    removeAllWatches(): void {
        this._watches.removeAll();
    }
}
