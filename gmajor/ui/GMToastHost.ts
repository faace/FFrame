import { _decorator, assetManager, Prefab, tween, Tween, UITransform, Vec3 } from 'cc';
import { CORE_BUNDLE } from '../resource/GMCoreBundle';
import { GMComponent } from './GMComponent';
import { GMOverlayHost } from './GMOverlayHost';
import { PF_GM_TOAST_HEIGHT, PfGMToast } from './PfGMToast';

const { ccclass } = _decorator;

export type GMToastAnchor = 'top' | 'center' | 'bottom';

/** 一列轻提示。条数以后要改，只改 max */
const QUEUE = {
    max: 3,
    gap: 12,
    edge: 120, // top / bottom 距屏边
    centerTop: 168, // center 档最高点，在中线上方
    riseFrom: 40, // top / bottom 入位前先偏开这么多
    base: 2.0, // 秒；12 字以内都用这个
    perChar: 0.05,
    cap: 3.5,
    freeChars: 12,
    move: 0.15, // 让位
    rise: 0.2, // 新的一条入位
};

interface ToastItem {
    bar: PfGMToast;
    timer: string;
    dying: boolean;
}

/** 时长：2 秒起，超 12 字每字加 0.05，封顶 3.5 */
function lifeOf(text: string): number {
    const extra = Math.max(0, text.length - QUEUE.freeChars) * QUEUE.perChar;
    return Math.min(QUEUE.cap, QUEUE.base + extra);
}

/**
 * 挂在 Overlay 的 toasts 节点上。
 * 管队列、锚点、预制体和定时器。PfGMToast 只画一条。
 */
@ccclass('GMToastHost')
export class GMToastHost extends GMComponent {
    private anchor: GMToastAnchor = 'center';
    private readonly live: ToastItem[] = []; // [0] 贴着停靠点，新的在末尾
    private seq = 0;
    private prefab: Prefab | null = null;
    private waiters: Array<(pf: Prefab | null) => void> | null = null;
    private spawn: ((prefab: Prefab) => GMComponent | null) | null = null;
    private scheduler: GMOverlayHost | null = null;

    /** 由 GMUIManager 在 Overlay 建好时接上。spawn 负责入树并刷层 */
    attach(spawn: (prefab: Prefab) => GMComponent | null, scheduler: GMOverlayHost): void {
        this.spawn = spawn;
        this.scheduler = scheduler;
    }

    /** 弹一句。再调一次同一句会再出一条 */
    toast(text: string): void {
        const one = String(text ?? '').trim();
        if (!one) return console.warn('[gm.ui] toast 空字符串，忽略');
        if (!this.spawn) return console.error('[gm.ui] toast 未挂上');
        this.loadPrefab((pf) => {
            if (!pf || !this.node.isValid || !this.spawn) return;
            const ts = this.spawn(pf);
            if (!(ts instanceof PfGMToast)) {
                ts?.node.destroy();
                return console.error('[gm.ui] toast 预制体没挂脚本');
            }
            ts.setText(one);
            ts.fadeIn();
            const item: ToastItem = { bar: ts, timer: 'toast:' + (++this.seq), dying: false };
            this.live.push(item); // 新的排在最外一格
            while (this.live.length > QUEUE.max) {
                const old = this.live.shift();
                if (old) this.dismiss(old); // 挤掉贴着停靠点的那条
            }
            this.arm(item, one);
            this.relayout(item);
        });
    }

    /** 正在显示的全部收起。已经开始淡出的不再参与排位 */
    toastHide(): void {
        const leaving = this.live.splice(0, this.live.length);
        for (const one of leaving) this.dismiss(one);
    }

    /** 值变了先收起，再改停靠点。相同的值不动 */
    setAnchor(anchor: GMToastAnchor): void {
        if (anchor === this.anchor) return;
        this.toastHide();
        this.anchor = anchor;
    }

    onRemove(): void {
        if (this.scheduler?.isValid) {
            for (const one of this.live) this.scheduler.unscheduleNamed(one.timer);
        }
        this.live.length = 0;
    }

    private arm(item: ToastItem, text: string): void {
        this.scheduler?.scheduleNamed(item.timer, lifeOf(text), () => this.expire(item));
    }

    private expire(item: ToastItem): void {
        if (item.dying) return;
        const i = this.live.indexOf(item);
        if (i !== -1) this.live.splice(i, 1);
        this.dismiss(item);
        this.relayout(null); // 其余的补向停靠点，不重置别人的计时
    }

    /** 离开队列后停在原地淡出。调用方负责先从 live 里拿掉 */
    private dismiss(item: ToastItem): void {
        if (item.dying) return;
        item.dying = true;
        this.scheduler?.unscheduleNamed(item.timer);
        Tween.stopAllByTarget(item.bar.node);
        item.bar.fadeOut(() => {
            if (item.bar.node.isValid) item.bar.node.destroy();
        });
    }

    /** fresh 从入位点飘到自己的格子，其余的让位 */
    private relayout(fresh: ToastItem | null): void {
        if (this.live.length === 0) return;
        const h = this.node.getComponent(UITransform)?.height ?? 1280;
        for (let i = 0; i < this.live.length; i++) {
            const one = this.live[i];
            if (!one.bar.node.isValid) continue;
            const node = one.bar.node;
            Tween.stopAllByTarget(node);
            const y = this.slotY(i, h);
            if (one !== fresh) {
                tween(node).to(QUEUE.move, { position: new Vec3(0, y, 0) }, { easing: 'quadOut' }).start();
                continue;
            }
            node.setPosition(0, this.enterY(y), 0);
            tween(node).to(QUEUE.rise, { position: new Vec3(0, y, 0) }, { easing: 'quadOut' }).start();
        }
    }

    /** index 0 贴着停靠点，越大越靠外 */
    private slotY(index: number, h: number): number {
        const step = PF_GM_TOAST_HEIGHT + QUEUE.gap;
        const half = PF_GM_TOAST_HEIGHT / 2;
        if (this.anchor === 'bottom') return -h / 2 + QUEUE.edge + half + index * step;
        if (this.anchor === 'center') return QUEUE.centerTop - index * step;
        return h / 2 - QUEUE.edge - half - index * step;
    }

    /** center 从中线出发；top 从格子下方来；bottom 从格子上方来 */
    private enterY(slot: number): number {
        if (this.anchor === 'center') return 0;
        if (this.anchor === 'bottom') return slot + QUEUE.riseFrom;
        return slot - QUEUE.riseFrom;
    }

    private loadPrefab(done: (pf: Prefab | null) => void): void {
        if (this.prefab?.isValid) return done(this.prefab);
        if (this.waiters) return void this.waiters.push(done);
        this.waiters = [done];
        const bundle = assetManager.getBundle(CORE_BUNDLE);
        if (!bundle) return this.flush(null, 'GMUI 未加载');
        bundle.load('PfGMToast', Prefab, (err, pf) => this.flush(err ? null : pf, err?.message ?? '没有 PfGMToast'));
    }

    private flush(pf: Prefab | null, why: string): void {
        const list = this.waiters ?? [];
        this.waiters = null;
        if (!pf) console.error('[gm.ui] toast 预制体加载失败', why);
        else this.prefab = pf;
        list.forEach((fn) => fn(pf));
    }
}
