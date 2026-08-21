import { _decorator, Color, Graphics, Label, Node, UITransform } from 'cc';
import { GMLayer } from '../../../gmajor';

const { ccclass } = _decorator;

/** Demo 弹窗：内容画在 panel 上；mask 由 GMLayer 克隆 */
@ccclass('LyDemoPopup')
export class LyDemoPopup extends GMLayer {
    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        const uit = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        uit.setContentSize(520, 360);
        const g = panel.getComponent(Graphics) ?? panel.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(20, 20, 20, 230);
        g.roundRect(-260, -180, 520, 360, 16);
        g.fill();
        const title = new Node('title');
        panel.addChild(title);
        title.layer = panel.layer;
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
