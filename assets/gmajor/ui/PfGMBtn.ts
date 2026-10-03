import { _decorator, Button, Color, Label, Sprite, SpriteFrame, UITransform } from 'cc';
import { GMComponent } from './GMComponent';

const { ccclass } = _decorator;

/**
 * 按钮可调参数。改数字改这里。
 * 字体资源：assets/gmajor/fonts/main.ttf，挂在子节点 label 上。
 * 小档、大档以后在 sizes 里加一行，并把 size 指过去。
 */
const PF_GM_BTN = {
    disabledMul: 0.55, // 禁用时底板、图标、字和描边一起乘。按下的缩小和压暗在 gu.addClick
    outlineWidth: 4,
    size: 'medium' as const,
    sizes: {
        medium: { width: 380, height: 176, square: 176, icon: 110, padX: 16, fontSize: 48 },
    },
    styles: {
        primary: { fill: [255, 255, 255], outline: [30, 80, 16] }, // 绿底白字
        secondary: { fill: [92, 64, 32], outline: [62, 40, 18] }, // 奶油底深字
        ad: { fill: [92, 48, 8], outline: [120, 60, 0] }, // 黄底深字
        gold: { fill: [92, 64, 32], outline: [110, 70, 20] }, // 金底深字
        diamond: { fill: [255, 255, 255], outline: [16, 60, 110] }, // 蓝底白字
    },
};

export type PfGMBtnStyle = keyof typeof PF_GM_BTN.styles;

type RGB = readonly [number, number, number];

function rgb(c: RGB): Color {
    return new Color(c[0], c[1], c[2], 255);
}

function mul(c: Color, k: number): Color {
    return new Color(Math.round(c.r * k), Math.round(c.g * k), Math.round(c.b * k), c.a);
}

/** 框架按钮。有字是宽钮，只有图标是方钮。点击由外层 gu.addClick 注册 */
@ccclass('PfGMBtn')
export class PfGMBtn extends GMComponent {
    private label: Label | null = null;
    private icon: Sprite | null = null;
    private plate: Sprite | null = null;
    private style: PfGMBtnStyle = 'primary';
    private _interactive = true;
    private preferredWidth = PF_GM_BTN.sizes.medium.width;

    get interactive(): boolean { // addClick 新建 Button 时读这个
        return this._interactive;
    }

    onInit(): void {
        this.plate = this.getComponent(Sprite);
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        this.icon = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        if (!this.plate || !this.label || !this.icon) return console.error('[PfGMBtn] 需要底板 Sprite、子节点 label 和 icon');
        if (this.label.isSystemFontUsed || !this.label.font) console.error('[PfGMBtn] label 未挂 assets/gmajor/fonts/main.ttf');
        this.layout();
    }

    /** 换底板，并套上该档的字色和描边 */
    setSkin(frame: SpriteFrame | null, style: PfGMBtnStyle): void {
        this.style = style;
        const uit = this.node.getComponent(UITransform);
        if (!this.plate || !uit) return;
        const w = uit.width;
        const h = uit.height;
        this.plate.spriteFrame = frame;
        this.plate.sizeMode = Sprite.SizeMode.CUSTOM;
        this.plate.type = Sprite.Type.SLICED;
        uit.setContentSize(w, h);
        this.applyColors();
    }

    /** 只换图标帧。空帧则藏起图标 */
    setIcon(frame: SpriteFrame | null): void {
        if (!this.icon) return;
        const tier = this.tier();
        this.icon.spriteFrame = frame;
        this.icon.sizeMode = Sprite.SizeMode.CUSTOM;
        this.icon.type = Sprite.Type.SIMPLE;
        this.icon.node.getComponent(UITransform)?.setContentSize(tier.icon, tier.icon);
        this.layout();
    }

    /** 空字符串藏起 label。只有图标时改成方钮 */
    setText(text: string): void {
        if (!this.label) return;
        this.label.string = text;
        this.layout();
    }

    /** 禁用时压暗，并关掉 Button.interactable */
    setEnabled(on: boolean): void {
        this._interactive = on;
        const btn = this.node.getComponent(Button);
        if (btn) btn.interactable = on;
        this.applyColors();
    }

    private tier() {
        return PF_GM_BTN.sizes[PF_GM_BTN.size];
    }

    private layout(): void {
        const tier = this.tier();
        const uit = this.node.getComponent(UITransform);
        if (!uit || !this.label || !this.icon) return;
        const hasText = this.label.string.length > 0;
        const hasIcon = !!this.icon.spriteFrame;
        this.icon.node.active = hasIcon;
        this.label.node.active = hasText;
        if (hasIcon && !hasText) {
            uit.setContentSize(tier.square, tier.square);
            this.icon.node.setPosition(0, 0, 0);
            this.applyColors();
            return;
        }
        if (uit.height === tier.height && uit.width >= tier.width) this.preferredWidth = uit.width;
        const width = Math.max(tier.width, this.preferredWidth);
        uit.setContentSize(width, tier.height);
        this.place(width, tier, hasText, hasIcon);
        this.applyColors();
    }

    private place(width: number, tier: { height: number; icon: number; padX: number; fontSize: number }, hasText: boolean, hasIcon: boolean): void {
        if (hasIcon && this.icon) {
            this.icon.node.setPosition(-width / 2 + tier.padX + tier.icon / 2, 0, 0);
        }
        if (!hasText || !this.label) return;
        this.label.fontSize = tier.fontSize;
        this.label.lineHeight = tier.fontSize;
        this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.label.verticalAlign = Label.VerticalAlign.CENTER;
        this.label.overflow = Label.Overflow.SHRINK;
        this.label.enableWrapText = false;
        this.label.enableOutline = true;
        this.label.outlineWidth = PF_GM_BTN.outlineWidth;
        const node = this.label.node;
        const lut = node.getComponent(UITransform);
        if (hasIcon) {
            const left = -width / 2 + tier.padX + tier.icon;
            const right = width / 2 - tier.padX;
            lut?.setContentSize(Math.max(0, right - left), tier.height);
            node.setPosition((left + right) / 2, 0, 0);
            return;
        }
        lut?.setContentSize(width, tier.height);
        node.setPosition(0, 0, 0);
    }

    private applyColors(): void {
        const style = PF_GM_BTN.styles[this.style];
        const k = this._interactive ? 1 : PF_GM_BTN.disabledMul;
        const white = mul(Color.WHITE, k);
        if (this.plate) this.plate.color = white;
        if (this.icon) this.icon.color = white;
        if (!this.label) return;
        this.label.color = mul(rgb(style.fill as RGB), k);
        this.label.outlineColor = mul(rgb(style.outline as RGB), k);
    }
}
