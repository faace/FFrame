/**
 * 全局事件管理（参考 SpiderClub / Crazy777 EventManager）。
 * - 监听对象实现 on{EventName} 或 onAnyEvent；也可直接传函数
 * - 事件名首字母必须大写；回调返回 true 则拦截后续监听
 * - priority 越大越先收到；once=-1 常驻，>0 为剩余可触发次数
 */

export type GMEventListener = object | ((event: GMEvent) => unknown);

export type GMEvent = { name: string; data?: any };

type GMEventInfo = {
    listener: GMEventListener;
    priority: number; // 越大越高
    once: number; // -1 一直；1=一次…
};

export class GMEventManager {
    private events: { [eventName: string]: GMEventInfo[] } = {};
    private targets: GMEventInfo[] = []; // onAny：监听所有消息

    /** 监听全部事件（走 on{Name} 或 onAnyEvent） */
    onAny(listener: GMEventListener, priority = 0, once = -1): this {
        let info = this.targets.find((one) => one.listener === listener);
        if (info) {
            info.once = once;
            if (info.priority === priority) return this;
            info.priority = priority;
        } else {
            this.targets.push({ listener, priority, once });
        }
        this.targets.sort((a, b) => a.priority - b.priority);
        return this;
    }

    offAny(listener: GMEventListener): this {
        const idx = this.targets.findIndex((one) => one.listener === listener);
        if (idx > -1) this.targets.splice(idx, 1);
        return this;
    }

    // eventNames 首字母大写；listener 为 on{Name}/onAnyEvent 对象或函数
    on(eventNames: string | string[], listener: GMEventListener, priority = 0, once = -1): this {
        const names = typeof eventNames === 'string' ? [eventNames] : eventNames;
        for (const eventName of names) {
            const list = this._checkAndGetListeners(eventName, listener);
            const existing = list.find((one) => one.listener === listener);
            if (existing) {
                existing.once = once;
                if (existing.priority === priority) continue;
                existing.priority = priority;
            } else {
                list.push({ listener, priority, once });
            }
            list.sort((a, b) => a.priority - b.priority);
        }
        return this;
    }

    off(eventNames: string | string[], listener: GMEventListener): this {
        const names = typeof eventNames === 'string' ? [eventNames] : eventNames;
        for (const eventName of names) {
            const list = this.events[eventName] || [];
            const idx = list.findIndex((one) => one.listener === listener);
            if (idx > -1) list.splice(idx, 1);
        }
        return this;
    }

    offEvent(eventName: string): this {
        delete this.events[eventName];
        return this;
    }

    /** 移除某 listener 的全部监听（含 onAny） */
    offListener(listener: GMEventListener): this {
        this.offAny(listener);
        for (const eventName of Object.keys(this.events)) {
            const list = this.events[eventName];
            const idx = list.findIndex((one) => one.listener === listener);
            if (idx > -1) list.splice(idx, 1);
        }
        return this;
    }

    /** @param event 事件对象，或 name + data */
    emit(event: GMEvent | string, data?: any): this {
        const ev: GMEvent = typeof event === 'string' ? { name: event, data } : event;
        const eventName = ev.name;
        const handled: GMEventListener[] = [];

        const eventInfos = this.events[eventName];
        if (eventInfos) {
            for (let i = eventInfos.length - 1; i >= 0; i--) {
                const one = eventInfos[i];
                const prevented = this._invoke(one.listener, eventName, ev);
                handled.push(one.listener);
                if (one.once > 0 && --one.once === 0) eventInfos.splice(i, 1);
                if (prevented === true) return this;
            }
        }

        for (let i = this.targets.length - 1; i >= 0; i--) {
            const one = this.targets[i];
            if (handled.indexOf(one.listener) >= 0) continue;
            const prevented = this._invoke(one.listener, eventName, ev);
            if (one.once > 0 && --one.once === 0) this.targets.splice(i, 1);
            if (prevented === true) return this;
        }
        return this;
    }

    clear(): void {
        this.events = {};
        this.targets.length = 0;
    }

    private _checkAndGetListeners(eventName: string, listener: GMEventListener): GMEventInfo[] {
        if (!listener) throw new Error(`[GMEventManager] No listener for ${eventName}`);
        if (!eventName) throw new Error('[GMEventManager] eventName is empty');
        if (eventName[0] !== eventName[0].toUpperCase()) {
            throw new Error(`[GMEventManager] First char of ${eventName} must be upper case`);
        }
        if (typeof listener !== 'function') {
            const obj = listener as Record<string, unknown>;
            if (!(obj[`on${eventName}`] || obj.onAnyEvent)) {
                throw new Error(`[GMEventManager] No on${eventName} or onAnyEvent on listener`);
            }
        }
        if (!this.events[eventName]) this.events[eventName] = [];
        return this.events[eventName];
    }

    private _invoke(listener: GMEventListener, eventName: string, ev: GMEvent): unknown {
        if (typeof listener === 'function') {
            return listener(ev);
        }
        const obj = listener as Record<string, (e: GMEvent) => unknown>;
        const fn = obj[`on${eventName}`] ? `on${eventName}` : 'onAnyEvent';
        return obj[fn]?.(ev);
    }
}
