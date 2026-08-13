import { _decorator, tween, Tween, Vec3 } from 'cc';
import { FFComponent } from './FFComponent';

const { ccclass } = _decorator;

/**
 * Layer 脚本基类。`Ly*` 关联脚本继承本类（不要直接 extends Component / FFComponent）。
 * `onEnter`/`onLeave` 由 ff.ui 在带进/带出画面时调用；默认 scale 动效，子类可整段覆盖。
 */
@ccclass('FFLayer')
export class FFLayer extends FFComponent {
    onEnter(done: () => void): void { // 默认 0 → 1.1 → 1
        Tween.stopAllByTarget(this.node);
        this.node.setScale(0, 0, 1);
        tween(this.node)
            .to(0.35, { scale: new Vec3(1.1, 1.1, 1) })
            .to(0.15, { scale: Vec3.ONE })
            .call(done)
            .start();
    }

    onLeave(done: () => void): void { // 默认 1 → 1.1 → 0
        Tween.stopAllByTarget(this.node);
        const s = this.node.scale;
        tween(this.node)
            .to(0.13, { scale: new Vec3(1.1 * s.x, 1.1 * s.y, 1) })
            .to(0.2, { scale: new Vec3(0, 0, 1) })
            .call(done)
            .start();
    }
}
