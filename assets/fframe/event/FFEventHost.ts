/**
 * 实例级事件能力（内部复用，不从 index 导出）。
 * 由 FFLauncher 注入全局 FFEventManager，避免与 ff 循环依赖。
 */
import type { FFEvent, FFEventListener, FFEventManager } from './FFEventManager';

let eventsRef: FFEventManager | null = null;

/** 启动时注入；仅 Launcher 调用 */
export function bindFFEvents(em: FFEventManager): void {
    eventsRef = em;
}

function em(): FFEventManager {
    if (!eventsRef) throw new Error('[fframe] 事件总线尚未就绪');
    return eventsRef;
}

/** 挂在 FFClassBase / FFComponent 上：记本实例监听，销毁时卸干净 */
export class FFEventHost {
    private readonly names: string[] = [];
    private any = false;

    constructor(private readonly target: FFEventListener) {}

    on(eventNames: string | string[], priority = 0, once = -1): this {
        const list = typeof eventNames === 'string' ? [eventNames] : eventNames;
        for (const name of list) {
            if (this.names.indexOf(name) < 0) this.names.push(name);
        }
        em().on(list, this.target, priority, once);
        return this;
    }

    off(eventNames: string | string[]): this {
        const list = typeof eventNames === 'string' ? [eventNames] : eventNames;
        em().off(list, this.target);
        for (const name of list) {
            const i = this.names.indexOf(name);
            if (i > -1) this.names.splice(i, 1);
        }
        return this;
    }

    onAny(priority = 0, once = -1): this {
        this.any = true;
        em().onAny(this.target, priority, once);
        return this;
    }

    offAny(): this {
        this.any = false;
        em().offAny(this.target);
        return this;
    }

    emit(event: FFEvent | string, data?: any): this {
        em().emit(event, data);
        return this;
    }

    /** 卸掉本实例登记过的监听 */
    removeAll(): void {
        if (this.names.length) {
            em().off(this.names, this.target);
            this.names.length = 0;
        }
        if (this.any) {
            em().offAny(this.target);
            this.any = false;
        }
    }
}
