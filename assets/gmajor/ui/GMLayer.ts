import { _decorator, Node, tween, Tween, Vec3 } from 'cc';
import { GMComponent } from './GMComponent';

const { ccclass } = _decorator;

/**
 * Layer 脚本基类。`Ly*` 关联脚本继承本类（不要直接 extends Component / GMComponent）。
 * `onEnter`/`onLeave` 由 gm.ui 在带进/带出画面时调用；默认 scale 动效，子类可整段覆盖。
 */
@ccclass('GMLayer')
export class GMLayer extends GMComponent {
    onEnter(done: () => void): void { // 默认 0 → 1.1 → 1
        this.animateEnter(this.node, done);
    }

    onLeave(done: () => void): void { // 默认 1 → 1.1 → 0
        this.animateLeave(this.node, done);
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
}
