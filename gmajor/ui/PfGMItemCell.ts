import { _decorator, Color, Label, Node, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 道具格可调参数。改数字改这里。
 * 根和底 96。图标 52。选中框 96，和底一样大，绿线贴在深色描边上。
 * 数量锚点在右下，比格子外缘收进 4。超过 999 显示 999+。字号固定 20，不随字数缩小。白字，描边 3。
 * 底和框按设置页现在的做法整张拉伸，不切九宫格。
 * 字体：db://gmajor/fonts/main.ttf，挂在子节点 label 上。
 */
const PF_GM_ITEM_CELL = {
    size: 96,
    icon: 52,
    frame: 96,
    fontSize: 20, // 跟现在的 999+ 一样大，不再按字数缩小
    outlineWidth: 3, // 白字描边跟按钮一样
    outline: [54, 78, 36] as const, // 木格深橄榄绿
    countMax: 999, // 再大显示 999+
    countX: 41, // 贴边后再向左 4
    countY: -45, // 再向下 1
    countW: 56,
    countH: 36, // 画布加高，上沿描边才有地方。单行时行高不改变这一圈
};

function whole(n: number): number {
    const r = Math.round(n);
    return Number.isFinite(r) ? r : 0;
}

function countText(n: number): string {
    if (n > PF_GM_ITEM_CELL.countMax) return `${PF_GM_ITEM_CELL.countMax}+`;
    return String(n);
}

/** 框架道具格。底、图标、选中框、数量。图标按槽名取，selected 控制框。不接收点击 */
@ccclass('PfGMItemCell')
@executeInEditMode(true)
export class PfGMItemCell extends GMComponent {
    private bg: Sprite | null = null;
    private iconView: Sprite | null = null;
    private frame: Sprite | null = null;
    private label: Label | null = null;
    private dressed = '';
    private stamp = '';

    @property
    icon = ''; // 槽名，例如 icon_gold。空着不画

    @property
    selected = false;

    @property
    count = 0; // 大于 0 才显示。超过 999 显示 999+

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMItemCell] 需要子节点 bg、icon、frame 和 label');
        if (this.label!.isSystemFontUsed || !this.label!.font) console.error('[PfGMItemCell] label 未挂 db://gmajor/fonts/main.ttf');
        this.dress(this.bg, 'slot_item');
        this.dress(this.frame, 'frame_select');
        this.sync();
    }

    update(): void { // 检查器改了图标、选中或数量后重画。编辑态和运行态同一条
        if (!this.bg) return;
        const mark = `${this.icon}|${this.selected}|${this.count}`;
        if (mark === this.stamp) return;
        this.sync();
    }

    /** 换物品图。空字符串把图标藏起来 */
    setIcon(name: string): void {
        this.icon = name;
        this.sync();
    }

    /** 选中时显示框 */
    setSelected(on: boolean): void {
        this.selected = on;
        this.sync();
    }

    /** 设置数量。0 或负数把数字藏起来 */
    setCount(count: number): void {
        this.count = count;
        this.sync();
    }

    private sync(): void {
        if (this.icon !== this.dressed) this.dressIcon();
        this.layout();
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.iconView = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        this.frame = this.node.getChildByName('frame')?.getComponent(Sprite) ?? null;
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        return !!(this.bg && this.iconView && this.frame && this.label);
    }

    private layout(): void {
        const root = this.node.getComponent(UITransform);
        const bg = this.bg;
        const icon = this.iconView;
        const frame = this.frame;
        const label = this.label;
        if (!root || !bg || !icon || !frame || !label) return;
        this.count = whole(this.count);
        if (this.count < 0) this.count = 0;
        const size = PF_GM_ITEM_CELL.size;
        root.setContentSize(size, size);
        this.place(bg.node, size);
        this.place(icon.node, PF_GM_ITEM_CELL.icon);
        this.place(frame.node, PF_GM_ITEM_CELL.frame);
        this.placeCount(label);
        icon.node.active = this.icon.length > 0;
        frame.node.active = this.selected;
        label.node.active = this.count > 0;
        this.stamp = `${this.icon}|${this.selected}|${this.count}`;
    }

    private placeCount(label: Label): void {
        const ink = PF_GM_ITEM_CELL.outline;
        label.string = countText(this.count);
        label.fontSize = PF_GM_ITEM_CELL.fontSize;
        label.lineHeight = PF_GM_ITEM_CELL.fontSize; // 单行描边靠节点高度留空，不靠把行高改小
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.RIGHT;
        label.verticalAlign = Label.VerticalAlign.BOTTOM;
        label.overflow = Label.Overflow.CLAMP; // 字号固定，不按字数缩小
        label.enableWrapText = false;
        label.enableOutline = true;
        label.outlineWidth = PF_GM_ITEM_CELL.outlineWidth;
        label.outlineColor = new Color(ink[0], ink[1], ink[2], 255);
        const lut = label.node.getComponent(UITransform);
        lut?.setContentSize(PF_GM_ITEM_CELL.countW, PF_GM_ITEM_CELL.countH);
        lut?.setAnchorPoint(1, 0);
        label.node.setPosition(PF_GM_ITEM_CELL.countX, PF_GM_ITEM_CELL.countY, 0);
    }

    private place(node: Node, size: number): void {
        node.getComponent(UITransform)?.setContentSize(size, size);
        node.setPosition(0, 0, 0);
    }

    private dressIcon(): void {
        const sprite = this.iconView;
        if (!sprite) return;
        const name = this.icon;
        this.dressed = name;
        if (!name) {
            sprite.spriteFrame = null;
            return;
        }
        this.dress(sprite, name);
    }

    private dress(sprite: Sprite | null, name: string): void {
        if (!sprite) return;
        applySkin(name, (frame) => {
            if (!sprite.isValid || (sprite === this.iconView && this.icon !== name)) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
