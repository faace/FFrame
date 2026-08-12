import { _decorator, Component } from 'cc';
import { FFEventHost } from '../event/FFEventHost';
import type { FFEvent } from '../event/FFEventManager';

const { ccclass } = _decorator;

/**
 * UI 通用基类（挂 Component）。
 * 第 1 刀：仅实例事件 on/off/emit；Prefab/弹窗/Scene 特化与编排对接以后再加。
 */
@ccclass('FFComponent')
export class FFComponent extends Component {
    private _events: FFEventHost | null = null;

    private host(): FFEventHost {
        if (!this._events) this._events = new FFEventHost(this);
        return this._events;
    }

    onLoad(): void {
        this.host();
    }

    onDestroy(): void {
        this._events?.removeAll();
        this._events = null;
    }

    /** 监听（listener 为 this，需实现 on{EventName}）；节点销毁时自动卸 */
    on(eventNames: string | string[], priority = 0, once = -1): this {
        this.host().on(eventNames, priority, once);
        return this;
    }

    off(eventNames: string | string[]): this {
        this.host().off(eventNames);
        return this;
    }

    onAny(priority = 0, once = -1): this {
        this.host().onAny(priority, once);
        return this;
    }

    offAny(): this {
        this.host().offAny();
        return this;
    }

    emit(event: FFEvent | string, data?: any): this {
        this.host().emit(event, data);
        return this;
    }

    removeAllEvents(): void {
        this._events?.removeAll();
    }
}
