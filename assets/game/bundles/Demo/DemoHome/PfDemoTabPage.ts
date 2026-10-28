import { _decorator, assetManager, Color, Label, Node, TTFFont, UITransform } from 'cc';
import { GMTabPage } from 'db://gmajor/index';

const { ccclass } = _decorator;

const FONT = 'ee40121d-0b21-4bb3-b95c-fa7d2df322b4'; // assets/gmajor/fonts/main.ttf
const INK = new Color(92, 64, 32, 255);

/** 首页页签示例里的一页。记录页会等两秒，用来看到 loading */
@ccclass('PfDemoTabPage')
export class PfDemoTabPage extends GMTabPage {
    private label: Label | null = null;

    onInit(): void {
        const node = new Node('label');
        node.layer = this.node.layer;
        this.node.addChild(node);
        node.addComponent(UITransform).setContentSize(560, 120);
        this.label = node.addComponent(Label);
        this.label.fontSize = 28;
        this.label.lineHeight = 36;
        this.label.color = INK;
        this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.label.verticalAlign = Label.VerticalAlign.CENTER;
        this.label.overflow = Label.Overflow.SHRINK;
        this.label.enableWrapText = true;
        this.label.string = this.line();
        const hit = assetManager.assets.get(FONT) as TTFFont | undefined;
        if (hit) this.label.font = hit;
    }

    onShow(done: () => void): void {
        if (this.label) this.label.string = this.line();
        if (this.text !== '记录') return done();
        this.scheduleOnce(() => done(), 2);
    }

    private line(): string {
        if (this.text === '记录') return '记录\n这一页会等两秒';
        return this.text + '\n点上面的页签切换';
    }
}
