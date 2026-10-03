import { _decorator, Color, Label, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode } = _decorator;

/**
 * 标题可调参数。改数字改这里。
 * 字体资源：assets/gmajor/fonts/main.ttf，挂在子节点 label 上。
 * 九宫格边距在 title_bar 图上：左 40、右 40、上 22、下 20。只拉宽，不拉高。
 * 小档、大档以后在 sizes 里加一行，并把 size 指过去。
 */
const PF_GM_TITLE = {
    outlineWidth: 0, // 0 不描边
    outline: [62, 40, 18] as const, // 仅 outlineWidth > 0 时使用
    fill: [92, 64, 32] as const, // 深墨
    size: 'medium' as const,
    sizes: {
        medium: { height: 85, fontSize: 36, padX: 56, minWidth: 320, maxWidth: 680 },
    },
};

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

    onInit(): void {
        this.plate = this.getComponent(Sprite);
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        if (!this.plate || !this.label) return console.error('[PfGMTitle] 需要底板 Sprite、子节点 label');
        if (this.label.isSystemFontUsed || !this.label.font) console.error('[PfGMTitle] label 未挂 assets/gmajor/fonts/main.ttf');
        applySkin('title_bar', (frame) => {
            if (!this.plate?.isValid) return;
            this.plate.spriteFrame = frame;
            this.plate.sizeMode = Sprite.SizeMode.CUSTOM;
            this.plate.type = Sprite.Type.SLICED;
        });
        this.layout();
    }

    /** 按字宽重排。短于最小宽停在最小宽，长于最大宽则在两侧留白里缩小 */
    setText(text: string): void {
        if (!this.label) return;
        this.label.string = text;
        this.layout();
    }

    private tier() {
        return PF_GM_TITLE.sizes[PF_GM_TITLE.size];
    }

    private layout(): void {
        const tier = this.tier();
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
