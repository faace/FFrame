import { _decorator, Color, Graphics, Label, Node, UITransform } from 'cc';
import { GMComponent } from '../../../../gmajor';

const { ccclass } = _decorator;

/** Demo 列表项：握脚本句柄改 count，不握 node */
@ccclass('PfDemoItem')
export class PfDemoItem extends GMComponent {
    private count = 0;
    private label: Label | null = null;

    onInit(): void {
        const uit = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        uit.setContentSize(200, 56);
        const g = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(20, 80, 40, 230);
        g.roundRect(-100, -28, 200, 56, 8);
        g.fill();
        const title = new Node('label');
        this.node.addChild(title);
        title.layer = this.node.layer;
        title.addComponent(UITransform).setContentSize(200, 56);
        this.label = title.addComponent(Label);
        this.label.fontSize = 24;
        this.label.color = Color.WHITE;
        this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.label.verticalAlign = Label.VerticalAlign.CENTER;
        this.refresh();
        console.info('[PfDemoItem] onInit');
    }

    init(parm?: { count?: number }): void {
        this.setCount(parm?.count ?? 0);
        console.info('[PfDemoItem] init', this.count);
    }

    setCount(n: number): void {
        this.count = n;
        this.refresh();
        console.info('[PfDemoItem] setCount', this.count);
    }

    getCount(): number {
        return this.count;
    }

    private refresh(): void {
        if (this.label) this.label.string = '数量 ' + this.count + '（点我）';
    }
}
