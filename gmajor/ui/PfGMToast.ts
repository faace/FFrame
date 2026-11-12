import { _decorator, assetManager, Color, Label, Prefab, Sprite, UIOpacity, UITransform, tween, Tween, Vec3 } from 'cc';
import { gu } from '../launch/GMLauncher';
import { CORE_BUNDLE } from '../resource/GMCoreBundle';
import { GMComponent } from './GMComponent';
import { GMOverlayHost } from './GMOverlayHost';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 轻提示可调参数。改数字改这里。
 * 一句话，不进弹层栈、不挡操作、自动消失。多条从新到旧往下排成一列。
 * 槽预留 480×128，这里只用 72：真图中间那条横带要画平，装饰只落九宫格区。
 */
const PF_GM_TOAST = {
    width: 480,
    height: 72,
    edge: 120, // top / bottom 距屏边；center 不用
    gap: 12, // 槽间距
    max: 3, // 同时最多 3 条，第 4 条挤掉最老
    padX: 16, // 左右留白，再加九宫格左右各 20
    border: 20, // 九宫格左右边；源图 40，图是一半尺寸
    base: 2.0, // 秒；12 字以内都用这个
    perChar: 0.05, // 超出 12 字每字加
    cap: 3.5, // 时长上限
    fadeIn: 0.15,
    fadeOut: 0.2,
    move: 0.15, // 让位缓动
    rise: 0.2, // 新的一条从下方升上来
    riseFrom: 40, // 升起多少像素再落到位（比 12 的槽间距大，看得出「从下面来」）
    fontSize: 28,
    ink: [92, 64, 32] as const, // 奶油底深墨，不描边
    freeChars: 12, // 这句长度以内按 base 算
};

export type GMToastAnchor = 'top' | 'center' | 'bottom'; // 一个项目只能用一种

let anchor: GMToastAnchor = 'top'; // 第一次 setAnchor 定死，之后改不动
let anchorFixed = false;
let prefab: Prefab | null = null; // 首次 show 从 GMUI 载入，之后复用
let waiters: Array<(pf: Prefab | null) => void> | null = null;
const live: PfGMToast[] = []; // 从上到下；live[0] 在停靠点，新来的 push 到末尾
let seq = 0;

/** 时长：2 秒起，超 12 字每字加 0.05，封顶 3.5 */
function lifeOf(text: string): number {
    const extra = Math.max(0, text.length - PF_GM_TOAST.freeChars) * PF_GM_TOAST.perChar;
    return Math.min(PF_GM_TOAST.cap, PF_GM_TOAST.base + extra);
}

/**
 * 第 index 条该在的 y。屏高由调用方取一次传进来。
 * live[0] 是最上面那条，index 越大越靠外（top/center 往下，bottom 往上）。
 */
function slotY(index: number, h: number): number {
    const d = index * (PF_GM_TOAST.height + PF_GM_TOAST.gap);
    const half = PF_GM_TOAST.height / 2;
    if (anchor === 'center') return -d; // 从中线往下排
    if (anchor === 'bottom') return -h / 2 + PF_GM_TOAST.edge + half + d; // 距底 120 往上排
    return h / 2 - PF_GM_TOAST.edge - half - d; // 距顶 120 往下排
}

/**
 * 各归各位。
 * fresh 那条是刚进来的：从下方升起（bottom 档反过来，从上方落下），不是凭空出现在空位。
 * 其余的是让位：已经有位置的，平滑挪到新的一格。
 */
function relayout(fresh: PfGMToast | null = null): void {
    if (live.length === 0) return; // 没条就不去碰 Overlay（编辑器里也不建）
    const h = gu.toastRoot()?.getComponent(UITransform)?.height ?? 1280; // 取一次
    // 新条从「它该在的位置再往外一点」升/落进来：top 与 center 往下排，从下往上；bottom 往上排，从上往下
    const from = anchor === 'bottom' ? 1 : -1;
    live.forEach((one, i) => {
        if (!one.node.isValid) return;
        Tween.stopAllByTarget(one.node);
        const y = slotY(i, h);
        if (one !== fresh) {
            tween(one.node).to(PF_GM_TOAST.move, { position: new Vec3(0, y, 0) }, { easing: 'quadOut' }).start();
            return;
        }
        one.node.setPosition(0, y + PF_GM_TOAST.riseFrom * from, 0); // 先摆在更靠外一点
        tween(one.node).to(PF_GM_TOAST.rise, { position: new Vec3(0, y, 0) }, { easing: 'quadOut' }).start();
    });
}

/** 从 GMUI 包取预制体；并发调用排队，只 load 一次 */
function loadPrefab(done: (pf: Prefab | null) => void): void {
    if (prefab?.isValid) return done(prefab);
    if (waiters) return void waiters.push(done);
    waiters = [done];
    const bundle = assetManager.getBundle(CORE_BUNDLE);
    if (!bundle) return flush(null, 'GMUI 未加载');
    bundle.load('PfGMToast', Prefab, (err, pf) => flush(err ? null : pf, err?.message ?? '没有 PfGMToast'));
}

function flush(pf: Prefab | null, why: string): void {
    const list = waiters ?? [];
    waiters = null;
    if (!pf) console.error('[PfGMToast] 预制体加载失败', why);
    else prefab = pf; // 记住，之后不再 load
    list.forEach((fn) => fn(pf));
}

/** 框架轻提示。挂 Overlay 的 toasts 容器；不进弹层栈、不挡输入、不接收点击 */
@ccclass('PfGMToast')
@executeInEditMode(true)
export class PfGMToast extends GMComponent {
    private bg: Sprite | null = null;
    private label: Label | null = null;
    private timer = ''; // 本条的具名定时器
    private owner: GMOverlayHost | null = null; // arm 时记下，销毁时不再去找 Overlay
    private dying = false;

    @property
    text = '这是一句提示';

    /**
     * 弹一句。每调一次就多一条，不去重。
     * 同一句话连点三次就是三条，各自计时；最多同时 PF_GM_TOAST.max 条，超了送走最上面那条。
     */
    static show(text: string): void {
        const one = String(text ?? '').trim();
        if (!one) return console.warn('[PfGMToast] 空字符串，忽略');
        const root = gu.toastRoot();
        if (!root) return console.error('[PfGMToast] Overlay 未就绪，无法弹出');
        loadPrefab((pf) => {
            if (!pf || !root.isValid) return;
            const ts = gu.createTs(pf, { parent: root }); // 跟父节点同层，避免 Overlay 相机不画
            if (!(ts instanceof PfGMToast)) return console.error('[PfGMToast] 预制体没挂脚本');
            ts.play(one);
        });
    }

    /** 全部立刻收起。切场景或回主菜单时由调用方调 */
    static hide(): void {
        for (const one of live.slice()) one.drop();
    }

    /** 位置。只能设一次；第二次传不同的值只 warn，不生效 */
    static setAnchor(one: GMToastAnchor): void {
        if (anchorFixed && one !== anchor) return console.warn('[PfGMToast] 位置已定为', anchor, '，忽略', one);
        anchor = one;
        anchorFixed = true;
        relayout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMToast] 需要子节点 bg 和 label');
        if (this.label!.isSystemFontUsed || !this.label!.font) console.error('[PfGMToast] label 未挂 db://gmajor/fonts/main.ttf');
        this.dress();
        this.layout();
    }

    onRemove(): void {
        if (this.timer) this.owner?.unscheduleNamed(this.timer); // 不重新去建 Overlay
        const i = live.indexOf(this);
        if (i !== -1) live.splice(i, 1);
    }

    update(): void { // 检查器改了 text 就重排。编辑态和运行态同一条
        if (!this.label) return;
        if (this.label.string === this.text) return;
        this.layout();
    }

    /**
     * 入列、算时长、淡入。别人的计时不动。
     * 排队顺序是「旧的在上、新的往下贴」，所以推到最后，不是插到最前。
     */
    private play(text: string): void {
        this.text = text;
        this.dying = false;
        live.push(this); // 新来的贴在最下面
        while (live.length > PF_GM_TOAST.max) live.shift()?.drop(); // 超了先送走最上面那条
        this.layout();
        relayout(this); // 新的一条从下方升上来
        this.fadeIn();
        this.arm();
    }

    /** 淡出后销毁；别的条往上补位 */
    private drop(): void {
        if (this.dying) return;
        this.dying = true;
        const i = live.indexOf(this);
        if (i !== -1) live.splice(i, 1);
        if (this.timer) this.owner?.unscheduleNamed(this.timer);
        const op = this.op();
        Tween.stopAllByTarget(op);
        tween(op).to(PF_GM_TOAST.fadeOut, { opacity: 0 }).call(() => {
            if (this.node.isValid) this.node.destroy();
        }).start();
        relayout();
    }

    /** 每条自己一个具名定时器；重排不重置、不取消 */
    private arm(): void {
        const host = this.host();
        if (!host) return;
        this.owner = host;
        if (!this.timer) this.timer = 'toast:' + (++seq); // 名字只取一次，续命时复用同一个
        host.scheduleNamed(this.timer, lifeOf(this.text), () => this.drop()); // 内部会先取消同名
    }

    private fadeIn(): void {
        const op = this.op();
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(PF_GM_TOAST.fadeIn, { opacity: 255 }).start();
    }

    /** 调度器挂在 Overlay 根上，不在 toasts 容器上 */
    private host(): GMOverlayHost | null {
        return gu.toastRoot()?.parent?.getComponent(GMOverlayHost) ?? null;
    }

    private op(): UIOpacity { // 预制体里已放好；万一被删也补上，不影响别的
        return this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        return !!(this.bg && this.label);
    }

    private layout(): void {
        const bg = this.bg;
        const label = this.label;
        if (!bg || !label) return;
        const w = PF_GM_TOAST.width;
        const h = PF_GM_TOAST.height;
        this.node.getComponent(UITransform)?.setContentSize(w, h);
        bg.node.getComponent(UITransform)?.setContentSize(w, h);
        bg.node.setPosition(0, 0, 0);
        const inner = w - PF_GM_TOAST.padX * 2 - PF_GM_TOAST.border * 2;
        const ink = PF_GM_TOAST.ink;
        label.string = this.text;
        label.fontSize = PF_GM_TOAST.fontSize;
        label.lineHeight = PF_GM_TOAST.fontSize;
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; // 超长缩字号，不换行
        label.enableWrapText = false;
        label.enableOutline = false; // 奶油底上的深色字不描边
        label.node.getComponent(UITransform)?.setContentSize(inner, h);
        label.node.setPosition(0, 0, 0);
    }

    private dress(): void {
        const bg = this.bg;
        if (!bg) return;
        applySkin('toast', (frame) => { // 缺这张是正常的：打一条 warn、给内置白图
            if (!bg.isValid) return;
            bg.spriteFrame = frame;
            bg.sizeMode = Sprite.SizeMode.CUSTOM;
            bg.type = Sprite.Type.SLICED;
        });
    }
}

