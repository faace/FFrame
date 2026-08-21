import { _decorator, Color, Graphics, Label, Node, UITransform } from 'cc';
import { GMScene, gu } from '../../../gmajor';

const { ccclass } = _decorator;

/** DemoHome 真场景；Canvas 涂色方便看见 opacity 入场 */
@ccclass('ScDemoHome')
export class ScDemoHome extends GMScene {
    onInit(): void {
        this.paintBg();
        this.makeClickDemo();
        console.info('[ScDemoHome] onInit');
    }

    onStart(): void {
        console.info('[ScDemoHome] onStart');
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

    /** 弹窗关掉后可点：连点不锁；上锁 0.3s。必须挂 Canvas 且跟它同层，否则 UI 相机看不见 */
    private makeClickDemo(): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) return console.error('[ScDemoHome] 无 Canvas，无法加按钮');
        const rapid = this.makeBtn(canvas, 'btnRapid', '连点', -120, -40);
        const locked = this.makeBtn(canvas, 'btnLock', '上锁', 120, -40);
        gu.addClick(rapid, () => console.info('[ScDemoHome] 连点 点后', Date.now()));
        gu.addClick(locked, () => console.info('[ScDemoHome] 上锁 点后', Date.now()), { lockTime: 0.3 });
        console.info('[ScDemoHome] 已加连点/上锁按钮');
    }

    private makeBtn(parent: Node, name: string, text: string, x: number, y: number): Node {
        const node = new Node(name);
        parent.addChild(node);
        node.layer = parent.layer; // Canvas 是 UI_2D；默认 DEFAULT 相机不画
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(180, 64);
        const g = node.addComponent(Graphics);
        g.fillColor = new Color(40, 40, 40, 220);
        g.roundRect(-90, -32, 180, 64, 8);
        g.fill();
        const title = new Node('label');
        node.addChild(title);
        title.layer = parent.layer;
        title.addComponent(UITransform).setContentSize(180, 64);
        const label = title.addComponent(Label);
        label.string = text;
        label.fontSize = 28;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return node;
    }
}
