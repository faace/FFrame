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

    // 字段本体。检查器改属性走 setter，改了就当场重派
    private _value = 0.5;
    private _text = PfGMBarText.off;
    private _current = 0; // 当前/总值的分子
    private _total = 0; // 当前/总值的分母。0 表示还没设

    @property({ min: 0, max: 1, step: 0.01 })
    get value(): number {
        return this._value;
    }
    set value(v: number) {
        const next = clamp01(v);
        if (this._value === next) return; // 跟引擎 Label.string 一样，值没变就不重排
        this._value = next;
        this.layout();
    }

    @property({ type: Enum(PfGMBarText) })
    get text(): PfGMBarText {
        return this._text;
    }
    set text(v: PfGMBarText) {
        if (this._text === v) return;
        this._text = v;
        this.layout();
    }

    @property
    get current(): number {
        return this._current;
    }
    set current(v: number) {
        if (this._current === v) return;
        this._current = v;
        this.layout();
    }

    @property
    get total(): number {
        return this._total;
    }
    set total(v: number) {
        if (this._total === v) return;
        this._total = v;
        this.layout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMBar] 需要子节点 bg 和 fill');
        this.dress(this.bg, 'bar_bg');
        this.dress(this.fill, 'bar_fill');
        this.layout();
        this.node.on(Node.EventType.SIZE_CHANGED, this.layout, this); // 宽被改时跟着重排
    }

    onRemove(): void {
        this.node.off(Node.EventType.SIZE_CHANGED, this.layout, this);
    }

    /** 改比例。当前/总值模式里分子跟着变。不发通知 */
    setValue(value: number): void {
        const next = clamp01(value);
        this._value = next;
        if (this._text === PfGMBarText.ratio && this._total > 0) this._current = Math.round(next * this._total);
        this.layout(); // 三个值一次写字段，只重排一次
    }

    /** 换字。不改比例 */
    setText(text: PfGMBarText): void {
        this.text = text;
    }

    /** 设定当前和总值，条长改为当前除以总值 */
    setRatio(current: number, total: number): void {
        const cap = Number.isFinite(total) ? total : 0;
        const cur = Number.isFinite(current) ? current : 0;
        this._total = cap;
        this._current = cap > 0 ? Math.min(cap, Math.max(0, cur)) : 0;
        this._value = cap > 0 ? clamp01(this._current / cap) : 0;
        this.layout(); // 三个值一次写字段，只重排一次
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
        if (!uit || !bg || !fill) return; // 反序列化时 setter 先跑，那会儿还没绑节点
        this._value = clamp01(this._value);
        const width = uit.width > 0 ? uit.width : PF_GM_BAR.defaultWidth;
        uit.setContentSize(width, PF_GM_BAR.height);
        bg.node.getComponent(UITransform)?.setContentSize(width, PF_GM_BAR.height);
        bg.node.setPosition(0, 0, 0);
        const pad = PF_GM_BAR.pad;
        const inner = Math.max(0, width - pad * 2);
        const fillW = inner * this._value;
        const node = fill.node;
        const show = this._value > 0 && fillW >= PF_GM_BAR.fillMin;
        node.active = show;
        if (show) {
            const fut = node.getComponent(UITransform);
            fut?.setAnchorPoint(0, 0.5); // 从左侧往右长。根锚点仍是中心
            fut?.setContentSize(fillW, PF_GM_BAR.height - pad * 2);
            node.setPosition(-width / 2 + pad, 0, 0);
        }
        this.paintText(width);
    }

    private paintText(width: number): void {
        const label = this.ensureLabel();
        if (!label) return;
        const node = label.node;
        const show = this._text !== PfGMBarText.off;
        node.active = show;
        if (!show) return;
        label.string = this._text === PfGMBarText.percent ? `${Math.round(this._value * 100)}%` : `${Math.round(this._current)}/${Math.round(this._total)}`;
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
