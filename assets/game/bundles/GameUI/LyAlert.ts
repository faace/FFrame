import { _decorator, Color, Graphics, Label, Node, UITransform } from 'cc';
import { GMAlert } from '../../../gmajor';

const { ccclass } = _decorator;

/** Demo 皮：脚本画灰底；正式游戏改预制体节点即可，不必走这里 */
@ccclass('LyAlert')
export class LyAlert extends GMAlert {
    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        const uit = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        uit.setContentSize(480, 280);
        const pg = panel.getComponent(Graphics) ?? panel.addComponent(Graphics);
        pg.clear();
        pg.fillColor = new Color(20, 20, 20, 240);
        pg.roundRect(-240, -140, 480, 280, 16);
        pg.fill();
        this.body = this.makeLabel(panel, 'body', 32, 0, 40, 400, 120);
        this.btnCancel = this.makeBtn(panel, 'btnCancel', -110, -80);
        this.btnOk = this.makeBtn(panel, 'btnOk', 110, -80);
        this.cancelLabel = this.btnCancel.getChildByName('label')?.getComponent(Label) ?? null;
        this.okLabel = this.btnOk.getChildByName('label')?.getComponent(Label) ?? null;
        console.info('[LyAlert] onInit');
    }

    onRemove(): void {
        console.info('[LyAlert] onRemove');
    }

    private makeBtn(parent: Node, name: string, x: number, y: number): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = parent.layer;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(160, 56);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(50, 90, 160, 255);
        g.roundRect(-80, -28, 160, 56, 8);
        g.fill();
        this.makeLabel(node, 'label', 26, 0, 0, 160, 56);
        return node;
    }

    private makeLabel(parent: Node, name: string, fontSize: number, x: number, y: number, w: number, h: number): Label {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = parent.layer;
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(w, h);
        const label = node.addComponent(Label);
        label.string = '';
        label.fontSize = fontSize;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return label;
    }
}
