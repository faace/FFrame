import { _decorator, Color, Graphics, UITransform } from 'cc';
import { GMScene } from '../../../../gmajor';

const { ccclass } = _decorator;

/** DemoHome 真场景；Canvas 涂色方便看见。连点/createTs 验收已过，不再自动加 */
@ccclass('ScDemoHome')
export class ScDemoHome extends GMScene {
    onInit(): void {
        this.paintBg();
    }

    private paintBg(): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        const uit = canvas?.getComponent(UITransform);
        if (!canvas || !uit) return;
        const g = canvas.getComponent(Graphics) ?? canvas.addComponent(Graphics);
        g.clear();
        g.fillColor = new Color(32, 96, 140, 255);
        g.rect(-uit.width / 2, -uit.height / 2, uit.width, uit.height);
        g.fill();
    }
}
