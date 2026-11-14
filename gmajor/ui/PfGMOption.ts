import { _decorator, Color, Label, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 下拉行可调参数。改数字改这里。
 * 高固定 64，宽由 PfGMSelect 按列表宽写进来。图标 36，字 26 号。
 * 选中是草地绿底白字描边 3；未选中不画底板，只有奶油底上的深墨字。
 */
const PF_GM_OPTION = {
    height: 64,
    iconSize: 36,
    padX: 20, // 左内边
    gap: 10, // 图标和字之间
    fontSize: 26,
    outlineWidth: 3, // 白字描边跟按钮一样
    ink: [92, 64, 32] as const, // 奶油底上的深墨，不描边
    onInk: [255, 255, 255] as const, // 草地绿底上的白字
    outline: [30, 80, 16] as const, // 和按钮 primary 同一套
    width: 320, // 还没被父写宽时的占位
};

/** 框架下拉行。底、图标、字。selected 换绿底白字。点击由外层 gu.addClick 注册 */
@ccclass('PfGMOption')
@executeInEditMode(true)
export class PfGMOption extends GMComponent {
    private bg: Sprite | null = null;
    private iconView: Sprite | null = null;
    private labelView: Label | null = null;
    private dressed = '';

    // 字段本体。检查器改属性走 setter，改了就当场重派
    private _text = '';
    private _icon = ''; // 物品槽名，例如 icon_star。空着只显示文字
    private _selected = false;

    @property
    get text(): string {
        return this._text;
    }
    set text(v: string) {
        const next = String(v ?? '');
        if (this._text === next) return;
        this._text = next;
        this.layout(); // 字只影响 label，不用重新取图
    }

    @property
    get icon(): string {
        return this._icon;
    }
    set icon(v: string) {
        const next = String(v ?? '');
        if (this._icon === next) return;
        this._icon = next;
        this.sync();
    }

    @property
    get selected(): boolean {
        return this._selected;
    }
    set selected(v: boolean) {
        const next = !!v;
        if (this._selected === next) return;
        this._selected = next;
        this.layout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMOption] 需要子节点 bg、icon 和 label');
        if (this.labelView!.isSystemFontUsed || !this.labelView!.font) console.error('[PfGMOption] label 未挂 db://gmajor/fonts/main.ttf');
        this.dressBg();
        this.sync();
    }

    /** 换字 */
    setText(text: string): void {
        this.text = text;
    }

    /** 换图标。空字符串把图标藏起来 */
    setIcon(name: string): void {
        this.icon = name;
    }

    /** 选中时画绿底、字转白加描边 */
    setSelected(on: boolean): void {
        this.selected = !!on;
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.iconView = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        this.labelView = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        return !!(this.bg && this.iconView && this.labelView);
    }

    /** 图标名变了才重新取图，其余交给 layout */
    private sync(): void {
        if (this._icon !== this.dressed) this.dressIcon();
        this.layout();
    }

    private layout(): void {
        const root = this.node.getComponent(UITransform);
        const bg = this.bg;
        const icon = this.iconView;
        const label = this.labelView;
        if (!root || !bg || !icon || !label) return; // 反序列化时 setter 先跑，那会儿还没绑节点
        const width = root.width > 0 ? root.width : PF_GM_OPTION.width;
        const height = PF_GM_OPTION.height;
        root.setContentSize(width, height);
        bg.node.getComponent(UITransform)?.setContentSize(width, height);
        bg.node.setPosition(0, 0, 0);
        bg.node.active = this._selected;
        const hasIcon = this._icon.length > 0;
        icon.node.active = hasIcon;
        icon.node.getComponent(UITransform)?.setContentSize(PF_GM_OPTION.iconSize, PF_GM_OPTION.iconSize);
        const left = -width / 2 + PF_GM_OPTION.padX;
        if (hasIcon) icon.node.setPosition(left + PF_GM_OPTION.iconSize / 2, 0, 0);
        const textLeft = hasIcon ? left + PF_GM_OPTION.iconSize + PF_GM_OPTION.gap : left;
        const textRight = width / 2 - PF_GM_OPTION.padX;
        this.placeLabel(label, textLeft, textRight, height);
    }

    private placeLabel(label: Label, left: number, right: number, height: number): void {
        const ink = this._selected ? PF_GM_OPTION.onInk : PF_GM_OPTION.ink;
        const outline = PF_GM_OPTION.outline;
        label.string = this._text;
        label.fontSize = PF_GM_OPTION.fontSize;
        label.lineHeight = PF_GM_OPTION.fontSize;
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP; // 字号固定，不按字数缩小
        label.enableWrapText = false;
        label.enableOutline = this._selected; // 奶油底上的深色字不描边
        label.outlineWidth = this._selected ? PF_GM_OPTION.outlineWidth : 0;
        label.outlineColor = new Color(outline[0], outline[1], outline[2], 255);
        const lut = label.node.getComponent(UITransform);
        lut?.setAnchorPoint(0, 0.5);
        lut?.setContentSize(Math.max(0, right - left), height);
        label.node.setPosition(left, 0, 0);
    }

    private dressBg(): void {
        const bg = this.bg;
        if (!bg) return;
        applySkin('dropdown_item_on', (frame) => {
            if (!bg.isValid) return;
            bg.spriteFrame = frame;
            bg.sizeMode = Sprite.SizeMode.CUSTOM;
            bg.type = Sprite.Type.SLICED;
        });
    }

    private dressIcon(): void {
        const sprite = this.iconView;
        if (!sprite) return;
        const name = this._icon;
        this.dressed = name;
        if (!name) {
            sprite.spriteFrame = null;
            return;
        }
        applySkin(name, (frame) => {
            if (!sprite.isValid || this._icon !== name) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
