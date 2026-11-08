import { _decorator, Color, Enum, Label, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 标题可调参数。改数字改这里。
 * 字体资源：db://gmajor/fonts/main.ttf，挂在子节点 label 上。
 * 三档的高、字号跟同名按钮档。宽仍随字数，高不跟字数变。
 * 九宫格在 title_bar 上：左 48、右 48、上 20、下 20。
 */
const PF_GM_TITLE = {
    outlineWidth: 0, // 0 不描边
    outline: [62, 40, 18] as const, // 仅 outlineWidth > 0 时使用
    fill: [92, 64, 32] as const, // 深墨
    sizes: {
        small: { height: 64, fontSize: 28, padX: 48, minWidth: 240, maxWidth: 480 }, // 高、字号 = 按钮小档。padX 不低于九宫格左右 48
        medium: { height: 88, fontSize: 36, padX: 56, minWidth: 320, maxWidth: 680 }, // 高、字号 = 按钮中档
        large: { height: 120, fontSize: 48, padX: 76, minWidth: 440, maxWidth: 920 }, // 高、字号 = 按钮大档
    },
};

export enum PfGMTitleSize {
    medium = 0, // 普通弹窗默认。高 88
    large = 1, // 高 120
    small = 2, // 高 64
}
Enum(PfGMTitleSize);

type TitleTier = (typeof PF_GM_TITLE.sizes)[keyof typeof PF_GM_TITLE.sizes];

function tierOf(size: PfGMTitleSize): TitleTier {
    const name = PfGMTitleSize[size] as keyof typeof PF_GM_TITLE.sizes;
    return PF_GM_TITLE.sizes[name] ?? PF_GM_TITLE.sizes.medium;
}

/** 这一档的条高。GMFrame 用它给正文让位，不必等标题预制体进来 */
export function pfGMTitleHeight(size: PfGMTitleSize): number {
    return tierOf(size).height;
}

type RGB = readonly [number, number, number];

function rgb(c: RGB): Color {
    return new Color(c[0], c[1], c[2], 255);
}

/** 框架标题。宽随字数在最小和最大之间变，锚点在整条中心。点击由外层注册 */
@ccclass('PfGMTitle')
@executeInEditMode(true)
export class PfGMTitle extends GMComponent {
    private label: Label | null = null;
    private plate: Sprite | null = null;
    private laidSize = -1;

    @property({ type: Enum(PfGMTitleSize) })
    size = PfGMTitleSize.medium;

    /** 换档。高和字号跟同名按钮档 */
    setSize(size: PfGMTitleSize): void {
        this.size = size;
        this.layout();
    }

    onInit(): void {
        this.plate = this.getComponent(Sprite);
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        if (!this.plate || !this.label) return console.error('[PfGMTitle] 需要底板 Sprite、子节点 label');
        if (this.label.isSystemFontUsed || !this.label.font) console.error('[PfGMTitle] label 未挂 db://gmajor/fonts/main.ttf');
        applySkin('title_bar', (frame) => {
            if (!this.plate?.isValid) return;
            const uit = this.node.getComponent(UITransform);
            const w = uit?.width ?? 0;
            const h = uit?.height ?? 0;
            this.plate.sizeMode = Sprite.SizeMode.CUSTOM;
            this.plate.type = Sprite.Type.SLICED;
            this.plate.spriteFrame = frame;
            if (uit && w > 0 && h > 0) uit.setContentSize(w, h);
            this.layout();
        });
    }

    update(): void { // 检查器改了档位，编辑态和运行态都重排
        if (this.laidSize === this.size) return;
        this.layout();
    }

    /** 按字宽重排。短于最小宽停在最小宽，长于最大宽则在两侧留白里缩小 */
    setText(text: string): void {
        if (!this.label) return;
        this.label.string = text;
        this.layout();
    }

    private layout(): void {
        const tier = tierOf(this.size);
        const label = this.label;
        const uit = this.node.getComponent(UITransform);
        const lut = label?.node.getComponent(UITransform);
        if (!label || !uit || !lut) return;
        uit.setAnchorPoint(0.5, 0.5);
        lut.setAnchorPoint(0.5, 0.5);
        label.node.setPosition(0, 0, 0);
        label.fontSize = tier.fontSize;
        label.lineHeight = tier.fontSize;
        label.color = rgb(PF_GM_TITLE.fill);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = false;
        label.enableOutline = PF_GM_TITLE.outlineWidth > 0;
        label.outlineWidth = PF_GM_TITLE.outlineWidth;
        label.outlineColor = rgb(PF_GM_TITLE.outline);
        const textW = this.measure(label);
        const wanted = textW + tier.padX * 2;
        const width = Math.min(tier.maxWidth, Math.max(tier.minWidth, wanted));
        if (this.plate) {
            this.plate.sizeMode = Sprite.SizeMode.CUSTOM;
            this.plate.type = Sprite.Type.SLICED;
        }
        uit.setContentSize(width, tier.height);
        this.laidSize = this.size;
        const shrink = wanted > tier.maxWidth || (label.string.length > 0 && textW <= 0);
        if (!shrink) return;
        label.overflow = Label.Overflow.SHRINK;
        lut.setContentSize(Math.max(0, width - tier.padX * 2), tier.height);
        label.updateRenderData(true);
    }

    /** 先按不缩放排出字宽。排不出时当 0，由 layout 收进最小宽里缩小 */
    private measure(label: Label): number {
        label.overflow = Label.Overflow.NONE;
        label.updateRenderData(true);
        return label.node.getComponent(UITransform)?.width ?? 0;
    }
}
