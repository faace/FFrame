import { _decorator } from 'cc';
import { GMScene, gm } from '../gmajor';
import { config } from './config';

const { ccclass } = _decorator;

/** ScMain.scene 关联脚本；挂 Canvas 下同名空节点，一次性点火 + 入口逻辑 */
@ccclass('ScMain')
export class ScMain extends GMScene {
    onStart(): void {
        this.on('BindReady'); // 试基类事件：listener=this → onBindReady
        this.boot();
    }

    onBindReady(e: { data?: unknown }): void {
        console.info('[ScMain] 事件 BindReady', e.data);
    }

    /** 先按项目 boot 打开基础包，再开 Demo */
    private boot(): void {
        console.info('[ScMain] 版本', 'gmajor', gm.config.version, 'app', config.version.app);
        gm.binder.bindInOrder(config.boot, (err) => {
            if (err) return console.error('[ScMain] 基础包失败', err);
            this.bindDemo();
        });
    }

    private bindDemo(): void {
        gm.binder.loadBundle('DemoChild', (err) => {
            if (err) return console.error('[ScMain] load DemoChild 失败', err);
            gm.binder.loadBundle('DemoHome', (err2) => {
                if (err2) return console.error('[ScMain] load DemoHome 失败', err2);
                void gm.binder.bind('DemoHome').then(
                    () => { console.info('[ScMain] 入口完成，绑定树', gm.binder.dumpTree()); },
                    (bindErr) => { console.error('[ScMain] bind DemoHome 失败', bindErr); },
                );
            }, (finished, total) => {
                console.info('[ScMain] DemoHome 进度', finished, total);
            });
        });
    }
}
