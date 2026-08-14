import { _decorator, Color, Graphics, Label, Node, UITransform } from 'cc';
import { FFLayer } from '../../../fframe';

const { ccclass } = _decorator;

/** Demo 弹窗：根节点 scale 入场；panel 自己画，不依赖贴图 */
@ccclass('LyDemoPopup')
export class LyDemoPopup extends FFLayer {
    onInit(): void {
        const uit = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        uit.setContentSize(520, 360);
        const g = this.node.addComponent(Graphics);
        g.fillColor = new Color(20, 20, 20, 230);
        g.roundRect(-260, -180, 520, 360, 16);
        g.fill();
        const title = new Node('title');
        this.node.addChild(title);
        title.addComponent(UITransform).setContentSize(400, 60);
        const label = title.addComponent(Label);
        label.string = 'LyDemoPopup';
        label.fontSize = 32;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        console.info('[LyDemoPopup] onInit');
    }

    onRemove(): void {
        console.info('[LyDemoPopup] onRemove');
    }
}
