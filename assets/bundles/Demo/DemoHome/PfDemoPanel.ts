import { _decorator } from 'cc';
import { FFComponent } from '../../../fframe';

const { ccclass } = _decorator;

/**
 * DemoHome 示范 UI：继承 FFComponent，验证实例事件。
 * 本刀由 Entry 动态挂节点；以后可改为同目录 PfDemoPanel.prefab 加载。
 */
@ccclass('PfDemoPanel')
export class PfDemoPanel extends FFComponent {
    onInit(): void {
        console.info('[PfDemoPanel] onInit');
        this.on('BindReady'); // listener=this → onBindReady
    }

    onBindReady(e: { data?: unknown }): void {
        console.info('[PfDemoPanel] 事件 BindReady', e.data);
    }

    onRemove(): void {
        console.info('[PfDemoPanel] onRemove');
    }
}
