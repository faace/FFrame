import { _decorator, Component } from 'cc';
import { FFEventHost } from '../event/FFEventHost';
import type { FFEvent } from '../event/FFEventManager';

const { ccclass } = _decorator;

/**
 * UI 通用基类（挂 Component）。
 * 业务写 onInit/onStart/onRemove；不要重写 onLoad/start/onDestroy。
 */
@ccclass('FFComponent')
export class FFComponent extends Component {
    private _events!: FFEventHost; // onLoad 里创建

    onInit?(): void; // 与 onLoad 同时机；可 this.on(...)
    onStart?(): void; // 与 start 同时机
    onRemove?(): void; // 与 onDestroy 同时机；此时监听已卸

    onLoad(): void { // 引擎回调；业务用 onInit，不要重写
        this._events = new FFEventHost(this);
        this.onInit?.();
    }

    start(): void { // 引擎回调；业务用 onStart，不要重写
        this.onStart?.();
    }

    onDestroy(): void { // 引擎回调；业务用 onRemove，不要重写
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

    emit(event: FFEvent | string, data?: any): this {
        this._events.emit(event, data);
        return this;
    }

    removeAllEvents(): void {
        this._events.removeAll();
    }
}
