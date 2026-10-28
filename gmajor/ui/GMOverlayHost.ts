import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/** persist Overlay 上的调度器：具名 delay，可取消（loading 显形/超时） */
@ccclass('GMOverlayHost')
export class GMOverlayHost extends Component {
    private readonly named = new Map<string, () => void>();

    scheduleNamed(name: string, delay: number, cb: () => void): void {
        this.unscheduleNamed(name);
        const wrap = (): void => {
            this.named.delete(name);
            cb();
        };
        this.named.set(name, wrap);
        this.scheduleOnce(wrap, delay);
    }

    unscheduleNamed(name: string): void {
        const wrap = this.named.get(name);
        if (!wrap) return;
        this.unschedule(wrap);
        this.named.delete(name);
    }
}
