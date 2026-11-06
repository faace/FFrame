import { _decorator, Node, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 道具格可调参数。改数字改这里。
 * 根和底 96。图标 52。选中框 108，比底每边多 6，不占排版。
 * 底和框按设置页现在的做法整张拉伸，不切九宫格。
 */
const PF_GM_ITEM_CELL = {
    size: 96,
    icon: 52,
    frame: 108,
};

/** 框架道具格。底、图标、选中框。图标按槽名取，selected 控制框。不接收点击 */
@ccclass('PfGMItemCell')
@executeInEditMode(true)
export class PfGMItemCell extends GMComponent {
    private bg: Sprite | null = null;
    private iconView: Sprite | null = null;
    private frame: Sprite | null = null;
    private dressed = '';
    private stamp = '';

    @property
    icon = ''; // 槽名，例如 icon_gold。空着不画

    @property
    selected = false;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMItemCell] 需要子节点 bg、icon 和 frame');
        this.dress(this.bg, 'slot_item');
        this.dress(this.frame, 'frame_select');
        this.sync();
    }

    update(): void { // 检查器改了图标或选中后重画。编辑态和运行态同一条
        if (!this.bg) return;
        const mark = `${this.icon}|${this.selected}`;
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

    private sync(): void {
        if (this.icon !== this.dressed) this.dressIcon();
        this.layout();
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.iconView = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        this.frame = this.node.getChildByName('frame')?.getComponent(Sprite) ?? null;
        return !!(this.bg && this.iconView && this.frame);
    }

    private layout(): void {
        const root = this.node.getComponent(UITransform);
        const bg = this.bg;
        const icon = this.iconView;
        const frame = this.frame;
        if (!root || !bg || !icon || !frame) return;
        const size = PF_GM_ITEM_CELL.size;
        root.setContentSize(size, size);
        this.place(bg.node, size);
        this.place(icon.node, PF_GM_ITEM_CELL.icon);
        this.place(frame.node, PF_GM_ITEM_CELL.frame);
        icon.node.active = this.icon.length > 0;
        frame.node.active = this.selected;
        this.stamp = `${this.icon}|${this.selected}`;
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
