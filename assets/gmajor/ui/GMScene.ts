import { _decorator, tween, Tween, UIOpacity } from 'cc';
import { GMLayer } from './GMLayer';

const { ccclass } = _decorator;

/**
 * 场景关联脚本基类。`Sc*` 脚本继承本类。
 * 入场/退场默认改 Canvas 整体 opacity（不是 layer 的 scale）。
 */
@ccclass('GMScene')
export class GMScene extends GMLayer {
    protected useLayerChrome = false; // 场景不套 mask/panel
    onEnter(done: () => void): void { // 默认 opacity 0 → 255
        const op = this.ensureCanvasOpacity();
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(0.3, { opacity: 255 }).call(done).start();
    }

    onLeave(done: () => void): void { // 默认 opacity 255 → 0
        const op = this.ensureCanvasOpacity();
        Tween.stopAllByTarget(op);
        tween(op).to(0.3, { opacity: 0 }).call(done).start();
    }

    private ensureCanvasOpacity(): UIOpacity {
        const canvas = this.node.scene?.getChildByName('Canvas') ?? this.node;
        return canvas.getComponent(UIOpacity) ?? canvas.addComponent(UIOpacity);
    }
}
