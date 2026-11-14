import { _decorator, assetManager, CCObjectFlags, Color, Enum, Label, Node, Sprite, TTFFont, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 进度条可调参数。改数字改这里。
 * 宽读根节点，默认 320。高固定 64。四周留白 8，填充高 48。
 * 填充是胶囊，左右九宫格边之和是 40，窄于这个不画。0 不画。
 * 字在条正中。默认不显示。百分比取 value。当前/总值用 current、total。
 */
const PF_GM_BAR = {
    height: 64,
    pad: 8,
    defaultWidth: 320,
    fillMin: 40, // 胶囊左右圆头各 20
    fontSize: 24,
    outlineWidth: 3, // 白字描边跟按钮一样
    outline: [54, 78, 36] as const, // 深橄榄绿，白字两边都看得清
    font: 'ee40121d-0b21-4bb3-b95c-fa7d2df322b4', // db://gmajor/fonts/main.ttf
    dontSave: CCObjectFlags.DontSave, // 运行时生成的字不写进预制体
};

export enum PfGMBarText {
    off = 0, // 不显示
    percent = 1, // 25%
    ratio = 2, // 1/4
}
Enum(PfGMBarText);

function clamp01(n: number): number {
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
}

/** 框架进度条。槽和填充。value 为 0–1，不接收拖动。字用 text 切换 */
@ccclass('PfGMBar')
@executeInEditMode(true)
export class PfGMBar extends GMComponent {
    private bg: Sprite | null = null;
    private fill: Sprite | null = null;
    private label: Label | null = null;
    private stamp = '';

    @property({ min: 0, max: 1, step: 0.01 })
    value = 0.5;

    @property({ type: Enum(PfGMBarText) })
    text = PfGMBarText.off;

    @property
    current = 0; // 当前/总值的分子

    @property
    total = 0; // 当前/总值的分母。0 表示还没设

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMBar] 需要子节点 bg 和 fill');
        this.dress(this.bg, 'bar_bg');
        this.dress(this.fill, 'bar_fill');
        this.layout();
    }

    update(): void { // 检查器或拉宽后重排。编辑态和运行态同一条
        const uit = this.node.getComponent(UITransform);
        if (!uit || !this.bg) return;
        const mark = `${this.value}|${this.text}|${this.current}|${this.total}|${uit.width}|${uit.height}`;
        if (mark === this.stamp) return;
        this.value = clamp01(this.value);
        this.layout();
    }

    /** 改比例。当前/总值模式里分子跟着变。不发通知 */
    setValue(value: number): void {
        this.value = clamp01(value);
        if (this.text === PfGMBarText.ratio && this.total > 0) this.current = Math.round(this.value * this.total);
        this.layout();
    }

    /** 换字。不改比例 */
    setText(text: PfGMBarText): void {
        this.text = text;
        this.layout();
    }

    /** 设定当前和总值，条长改为当前除以总值 */
    setRatio(current: number, total: number): void {
        const cap = Number.isFinite(total) ? total : 0;
        const cur = Number.isFinite(current) ? current : 0;
        this.total = cap;
        this.current = cap > 0 ? Math.min(cap, Math.max(0, cur)) : 0;
        this.value = cap > 0 ? clamp01(this.current / cap) : 0;
        this.layout();
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.fill = this.node.getChildByName('fill')?.getComponent(Sprite) ?? null;
        return !!(this.bg && this.fill);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const bg = this.bg;
        const fill = this.fill;
        if (!uit || !bg || !fill) return;
        this.value = clamp01(this.value);
        const width = uit.width > 0 ? uit.width : PF_GM_BAR.defaultWidth;
        uit.setContentSize(width, PF_GM_BAR.height);
        bg.node.getComponent(UITransform)?.setContentSize(width, PF_GM_BAR.height);
        bg.node.setPosition(0, 0, 0);
        const pad = PF_GM_BAR.pad;
        const inner = Math.max(0, width - pad * 2);
        const fillW = inner * this.value;
        const node = fill.node;
        const show = this.value > 0 && fillW >= PF_GM_BAR.fillMin;
        node.active = show;
        if (show) {
            const fut = node.getComponent(UITransform);
            fut?.setAnchorPoint(0, 0.5); // 从左侧往右长。根锚点仍是中心
            fut?.setContentSize(fillW, PF_GM_BAR.height - pad * 2);
            node.setPosition(-width / 2 + pad, 0, 0);
        }
        this.paintText(width);
        this.stamp = `${this.value}|${this.text}|${this.current}|${this.total}|${uit.width}|${uit.height}`;
    }

    private paintText(width: number): void {
        const label = this.ensureLabel();
        if (!label) return;
        const node = label.node;
        const show = this.text !== PfGMBarText.off;
        node.active = show;
        if (!show) return;
        label.string = this.text === PfGMBarText.percent ? `${Math.round(this.value * 100)}%` : `${Math.round(this.current)}/${Math.round(this.total)}`;
        label.fontSize = PF_GM_BAR.fontSize;
        label.lineHeight = PF_GM_BAR.fontSize;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        label.enableOutline = true;
        label.outlineWidth = PF_GM_BAR.outlineWidth;
        label.outlineColor = new Color(PF_GM_BAR.outline[0], PF_GM_BAR.outline[1], PF_GM_BAR.outline[2], 255);
        node.setPosition(0, 0, 0);
        node.getComponent(UITransform)?.setContentSize(width, PF_GM_BAR.height);
        this.dressFont(label);
    }

    private ensureLabel(): Label | null {
        if (this.label?.isValid) return this.label;
        let node = this.node.getChildByName('label');
        if (!node) {
            node = new Node('label');
            node.layer = this.node.layer;
            node._objFlags |= PF_GM_BAR.dontSave;
            this.node.addChild(node);
        }
        this.label = node.getComponent(Label) ?? node.addComponent(Label);
        return this.label;
    }

    private dressFont(label: Label): void {
        if (label.font && !label.isSystemFontUsed) return;
        const hit = assetManager.assets.get(PF_GM_BAR.font) as TTFFont | undefined;
        if (hit) {
            label.font = hit;
            label.isSystemFontUsed = false;
            return;
        }
        assetManager.loadAny({ uuid: PF_GM_BAR.font }, (err: Error | null, font: TTFFont) => {
            if (err || !font || !label.isValid) return console.error('[PfGMBar] 没有 main.ttf');
            label.font = font;
            label.isSystemFontUsed = false;
        });
    }

    private dress(sprite: Sprite | null, name: string): void {
        if (!sprite) return;
        applySkin(name, (frame) => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SLICED;
        });
    }
}
