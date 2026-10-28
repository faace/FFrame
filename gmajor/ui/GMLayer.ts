import { _decorator, instantiate, Node, tween, Tween, UIOpacity, UITransform, Vec3, view } from 'cc';
import { GMComponent } from './GMComponent';

const { ccclass } = _decorator;

const ENTER_TOTAL = 0.5; // 与 panel 0.35+0.15 对齐
const LEAVE_TOTAL = 0.33; // 与 panel 0.13+0.2 对齐

let layerMaskTpl: Node | null = null; // Overlay 上的隐藏模板

/** Overlay 建好后挂上 mask 模板，供 layer 克隆 */
export function bindLayerMaskTpl(node: Node): void {
    layerMaskTpl = node;
}

/**
 * Layer 脚本基类。`Ly*` 关联脚本继承本类（不要直接 extends Component / GMComponent）。
 * 根下必须有 panel；mask 运行时克隆。场景 GMScene 不走这套。
 */
@ccclass('GMLayer')
export class GMLayer extends GMComponent {
    protected useLayerChrome = true; // GMScene 关掉
    protected panel: Node | null = null;
    protected mask: Node | null = null;

    onLoad(): void { // 先搭 mask/panel，再 onInit（业务挂 panel）
        if (this.useLayerChrome) this.ensureLayerChrome();
        super.onLoad();
    }

    onEnter(done: () => void): void {
        if (!this.panel) return done();
        let left = this.mask ? 2 : 1;
        const tick = (): void => { if (--left <= 0) done(); };
        this.animateEnter(this.panel, tick);
        if (this.mask) this.fadeMask(255, ENTER_TOTAL, tick);
    }

    onLeave(done: () => void): void {
        if (!this.panel) return done();
        let left = this.mask ? 2 : 1;
        const tick = (): void => { if (--left <= 0) done(); };
        this.animateLeave(this.panel, tick);
        if (this.mask) this.fadeMask(0, LEAVE_TOTAL, tick);
    }

    /** Alert 等只动面板时复用同一套时长 */
    protected animateEnter(target: Node, done: () => void): void {
        Tween.stopAllByTarget(target);
        target.setScale(0, 0, 1);
        tween(target)
            .to(0.35, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.15, { scale: Vec3.ONE })
            .call(done)
            .start();
    }

    protected animateLeave(target: Node, done: () => void): void {
        Tween.stopAllByTarget(target);
        const s = target.scale;
        tween(target)
            .to(0.13, { scale: new Vec3(1.1 * s.x, 1.1 * s.y, 1) })
            .to(0.2, { scale: new Vec3(0, 0, 1) })
            .call(done)
            .start();
    }

    private ensureLayerChrome(): void {
        const panel = this.node.getChildByName('panel');
        if (!panel) {
            const msg = `[gm.ui] layer 缺少 panel：${this.node.name}（Ly 预制体生成时就必须带 panel，见 tools/create-ly-prefab.mjs）`;
            console.error(msg);
            throw new Error(msg);
        }
        this.panel = panel;
        panel.setScale(0, 0, 1);

        const size = view.getVisibleSize();
        const w = size.width;
        const h = size.height;
        const uit = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        uit.setContentSize(w, h);

        if (!layerMaskTpl?.isValid) {
            console.error('[gm.ui] layer mask 模板未就绪', this.node.name);
            return;
        }
        const mask = instantiate(layerMaskTpl);
        mask.name = 'mask';
        mask.active = true;
        mask.parent = this.node;
        mask.setSiblingIndex(0);
        this.applyNodeLayer(mask, this.node.layer);
        this.fitMask(mask, w, h);
        this.mask = mask;
    }

    private fitMask(mask: Node, w: number, h: number): void {
        const uit = mask.getComponent(UITransform) ?? mask.addComponent(UITransform);
        uit.setContentSize(w, h);
        const op = mask.getComponent(UIOpacity) ?? mask.addComponent(UIOpacity);
        op.opacity = 0;
        Tween.stopAllByTarget(op);
    }

    private fadeMask(to: number, duration: number, done: () => void): void {
        if (!this.mask?.isValid) return done();
        const op = this.mask.getComponent(UIOpacity) ?? this.mask.addComponent(UIOpacity);
        Tween.stopAllByTarget(op);
        tween(op).to(duration, { opacity: to }).call(done).start();
    }

    private applyNodeLayer(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyNodeLayer(child, layer);
    }
}
