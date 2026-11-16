import { _decorator, Color, Graphics, Label, UITransform } from 'cc';
import { GMListItem, gu } from 'db://gmajor/index';

const { ccclass } = _decorator;

/** 列表演示行。画出格子，字是序号。点一下交给页面上的 onPick */
@ccclass('PfListDemoItem')
export class PfListDemoItem extends GMListItem {
    static onPick: ((index: number) => void) | null = null;

    private labelView: Label | null = null;

    onInit(): void {
        this.labelView = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        if (!this.labelView) return console.error('[PfListDemoItem] 需要子节点 label');
        this.draw();
        this.show();
    }

    setIndex(index: number): void {
        super.setIndex(index);
        this.show();
        gu.addClick(this.node, () => PfListDemoItem.onPick?.(this.index));
    }

    /** 列表把这一格拉满之后重画格子，字也跟着拉满 */
    onLayout(): void {
        const uit = this.node.getComponent(UITransform);
        const labelUt = this.labelView?.node.getComponent(UITransform);
        if (uit && labelUt) labelUt.setContentSize(uit.contentSize);
        this.draw();
    }

    private show(): void {
        const label = this.labelView;
        if (!label) return;
        label.string = String(this.index);
        label.fontSize = 26;
        label.lineHeight = 26;
        label.color = new Color(92, 64, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
    }

    /** 奶油底加一圈深墨线，格子挨在一起也能分开 */
    private draw(): void {
        const uit = this.node.getComponent(UITransform);
        const w = uit?.width ?? 100;
        const h = uit?.height ?? 72;
        const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        g.clear();
        g.lineWidth = 2;
        g.fillColor = new Color(255, 248, 230, 255);
        g.strokeColor = new Color(92, 64, 32, 255);
        g.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 8);
        g.fill();
        g.stroke();
    }
}
