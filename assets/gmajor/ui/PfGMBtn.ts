import { _decorator, Button, Color, Enum, Label, Sprite, SpriteFrame, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 按钮可调参数。改数字改这里。
 * 字体资源：assets/gmajor/fonts/main.ttf，挂在子节点 label 上。
 * 小档、大档以后在 sizes 里加一行，并把 size 指过去。
 * 底板按 theme 从 Skin 包取同名文件，不序列化在这个组件上。
 */
const PF_GM_BTN = {
    disabledMul: 0.55, // 禁用时底板、图标、字和描边一起乘。按下的缩小和压暗在 gu.addClick
    outlineWidth: 4,
    iconScale: 0.8, // 图标相对档位尺寸
    size: 'medium' as const,
    sizes: {
        medium: { width: 380, height: 120, square: 120, icon: 110, padX: 16, fontSize: 48 },
    },
    outline: {
        primary: [30, 80, 16],
        secondary: [62, 40, 18],
        warning: [120, 60, 0],
        neutral: [110, 70, 20],
        info: [16, 60, 110],
    },
};

export enum PfGMBtnTheme {
    primary = 0, // 主操作：确定、开始
    secondary = 1, // 次操作：取消、关闭、设置、报警
    warning = 2, // 醒目：看广告
    neutral = 3, // 中性：花金币
    info = 4, // 蓝：花钻石
}
Enum(PfGMBtnTheme);

export enum PfGMBtnStyle {
    iconText = 0, // 图标加文字
    text = 1, // 纯文字
    icon = 2, // 纯图标，正方形
}
Enum(PfGMBtnStyle);

type RGB = readonly [number, number, number];

function rgb(c: RGB): Color {
    return new Color(c[0], c[1], c[2], 255);
}

function mul(c: Color, k: number): Color {
    return new Color(Math.round(c.r * k), Math.round(c.g * k), Math.round(c.b * k), c.a);
}

/** 框架按钮。theme 定底板和描边，style 定版式。点击由外层 gu.addClick 注册 */
@ccclass('PfGMBtn')
@executeInEditMode(true)
export class PfGMBtn extends GMComponent {
    private labelView: Label | null = null;
    private iconView: Sprite | null = null;
    private plate: Sprite | null = null;
    private _interactive = true;
    private stamp = '';
    private preferredWidth = PF_GM_BTN.sizes.medium.width;

    @property({ type: Enum(PfGMBtnTheme) })
    theme = PfGMBtnTheme.primary;

    @property({ type: Enum(PfGMBtnStyle) })
    style = PfGMBtnStyle.text;

    @property(SpriteFrame)
    icon: SpriteFrame | null = null;

    @property
    text = '';

    get interactive(): boolean { // addClick 新建 Button 时读这个
        return this._interactive;
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMBtn] 需要底板 Sprite、子节点 label 和 icon');
        if (this.labelView!.isSystemFontUsed || !this.labelView!.font) console.error('[PfGMBtn] label 未挂 assets/gmajor/fonts/main.ttf');
        this.refresh();
    }

    update(): void { // 检查器改了属性，编辑态和运行态都重排
        if (this.mark() === this.stamp) return;
        this.refresh();
    }

    /** 换主题：底板和描边一起换。字保持白色 */
    setTheme(theme: PfGMBtnTheme): void {
        this.theme = theme;
        this.refresh();
    }

    /** 换版式。纯文字不画图标，纯图标不画文字，并改成方钮 */
    setStyle(style: PfGMBtnStyle): void {
        this.style = style;
        this.refresh();
    }

    /** 换图标帧。纯文字版式下不显示 */
    setIcon(frame: SpriteFrame | null): void {
        this.icon = frame;
        this.refresh();
    }

    /** 换文字。纯图标版式下不显示 */
    setText(text: string): void {
        this.text = text;
        this.refresh();
    }

    /** 禁用时压暗，并关掉 Button.interactable */
    setEnabled(on: boolean): void {
        this._interactive = on;
        const btn = this.node.getComponent(Button);
        if (btn) btn.interactable = on;
        this.applyColors();
    }

    private mark(): string {
        return `${this.theme}|${this.style}|${this.text}|${this.icon?.uuid ?? ''}`;
    }

    private bindNodes(): boolean {
        this.plate = this.getComponent(Sprite);
        this.labelView = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        this.iconView = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        return !!(this.plate && this.labelView && this.iconView);
    }

    private tier() {
        return PF_GM_BTN.sizes[PF_GM_BTN.size];
    }

    private refresh(): void {
        if (!this.bindNodes()) return;
        const name = PfGMBtnTheme[this.theme] ?? 'primary';
        applySkin(name, (frame) => {
            if (!this.plate?.isValid) return;
            this.plate.spriteFrame = frame;
            this.plate.sizeMode = Sprite.SizeMode.CUSTOM;
            this.plate.type = Sprite.Type.SLICED;
        });
        this.layout();
        this.stamp = this.mark();
    }

    private layout(): void {
        const tier = this.tier();
        const uit = this.node.getComponent(UITransform);
        const label = this.labelView;
        const icon = this.iconView;
        if (!uit || !label || !icon) return;
        const showIcon = this.style === PfGMBtnStyle.icon || this.style === PfGMBtnStyle.iconText;
        const showText = this.style === PfGMBtnStyle.text || this.style === PfGMBtnStyle.iconText;
        icon.node.active = showIcon;
        label.node.active = showText;
        icon.spriteFrame = this.icon;
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.type = Sprite.Type.SIMPLE;
        const iconSize = tier.icon * PF_GM_BTN.iconScale;
        icon.node.getComponent(UITransform)?.setContentSize(iconSize, iconSize);
        label.string = this.text;
        if (this.style === PfGMBtnStyle.icon) {
            uit.setContentSize(tier.square, tier.square);
            icon.node.setPosition(0, 0, 0);
            this.applyColors();
            return;
        }
        if (uit.height === tier.height && uit.width >= tier.width) this.preferredWidth = uit.width;
        const width = Math.max(tier.width, this.preferredWidth);
        uit.setContentSize(width, tier.height);
        this.place(width, tier, showText, showIcon);
        this.applyColors();
    }

    private place(width: number, tier: { height: number; icon: number; padX: number; fontSize: number }, showText: boolean, showIcon: boolean): void {
        const icon = this.iconView;
        const label = this.labelView;
        if (showIcon && icon) icon.node.setPosition(-width / 2 + tier.padX + tier.icon / 2, 0, 0);
        if (!showText || !label) return;
        label.fontSize = tier.fontSize;
        label.lineHeight = tier.fontSize;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        label.enableOutline = true;
        label.outlineWidth = PF_GM_BTN.outlineWidth;
        const node = label.node;
        const lut = node.getComponent(UITransform);
        if (showIcon) {
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
        const outline = PF_GM_BTN.outline[PfGMBtnTheme[this.theme] as keyof typeof PF_GM_BTN.outline];
        const k = this._interactive ? 1 : PF_GM_BTN.disabledMul;
        const white = mul(Color.WHITE, k);
        if (this.plate) this.plate.color = white;
        if (this.iconView) this.iconView.color = white;
        if (!this.labelView || !outline) return;
        this.labelView.color = white;
        this.labelView.outlineColor = mul(rgb(outline as RGB), k);
    }
}
