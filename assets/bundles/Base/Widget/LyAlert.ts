import { _decorator, BlockInputEvents, Color, Graphics, Label, Node, UITransform, view, Widget } from 'cc';
import { GMLayer, gu } from '../../../gmajor';

const { ccclass } = _decorator;

/** 系统确认框：全屏挡点击，动效只打在 panel 上（与 layer 同一套 scale） */
@ccclass('LyAlert')
export class LyAlert extends GMLayer {
    private panel: Node | null = null;
    private body: Label | null = null;
    private okLabel: Label | null = null;
    private cancelLabel: Label | null = null;
    private btnOk: Node | null = null;
    private btnCancel: Node | null = null;
    private onOk: (() => void) | undefined;
    private onCancel: (() => void) | undefined;
    private close: (() => void) | undefined;

    onInit(): void {
        const size = view.getVisibleSize();
        const uit = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        uit.setContentSize(size.width, size.height);
        const widget = this.node.getComponent(Widget) ?? this.node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.alignMode = Widget.AlignMode.ALWAYS;
        if (!this.node.getComponent(BlockInputEvents)) this.node.addComponent(BlockInputEvents);

        const dim = new Node('dim');
        this.node.addChild(dim);
        dim.layer = this.node.layer;
        dim.addComponent(UITransform).setContentSize(size.width, size.height);
        const dg = dim.addComponent(Graphics);
        dg.fillColor = new Color(0, 0, 0, 160);
        dg.rect(-size.width / 2, -size.height / 2, size.width, size.height);
        dg.fill();

        this.panel = new Node('panel');
        this.node.addChild(this.panel);
        this.panel.layer = this.node.layer;
        this.panel.addComponent(UITransform).setContentSize(480, 280);
        this.panel.setScale(0, 0, 1);
        const pg = this.panel.addComponent(Graphics);
        pg.fillColor = new Color(20, 20, 20, 240);
        pg.roundRect(-240, -140, 480, 280, 16);
        pg.fill();

        this.body = this.makeLabel(this.panel, 'body', 32, 0, 40, 400, 120);
        this.btnCancel = this.makeBtn(this.panel, 'btnCancel', -110, -80);
        this.btnOk = this.makeBtn(this.panel, 'btnOk', 110, -80);
        this.cancelLabel = this.btnCancel.getChildByName('label')?.getComponent(Label) ?? null;
        this.okLabel = this.btnOk.getChildByName('label')?.getComponent(Label) ?? null;
        console.info('[LyAlert] onInit');
    }

    init(parm?: {
        content: string;
        okText: string;
        cancelText: string;
        showCancel: boolean;
        onOk?: () => void;
        onCancel?: () => void;
        close: () => void;
    }): void {
        if (!parm) return;
        if (this.body) this.body.string = parm.content;
        if (this.okLabel) this.okLabel.string = parm.okText;
        if (this.cancelLabel) this.cancelLabel.string = parm.cancelText;
        this.onOk = parm.onOk;
        this.onCancel = parm.onCancel;
        this.close = parm.close;
        if (this.btnCancel) this.btnCancel.active = parm.showCancel;
        if (this.btnOk) {
            this.btnOk.setPosition(parm.showCancel ? 110 : 0, -80, 0);
            gu.addClick(this.btnOk, () => { this.onOk?.(); this.close?.(); });
        }
        if (parm.showCancel && this.btnCancel) {
            gu.addClick(this.btnCancel, () => { this.onCancel?.(); this.close?.(); });
        }
    }

    onEnter(done: () => void): void {
        if (!this.panel) return done();
        this.animateEnter(this.panel, done);
    }

    onLeave(done: () => void): void {
        if (!this.panel) return done();
        this.animateLeave(this.panel, done);
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
