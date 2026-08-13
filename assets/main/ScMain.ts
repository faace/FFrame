import { _decorator } from 'cc';
import { FFScene, ff } from '../fframe';

const { ccclass } = _decorator;

/** ScMain.scene 关联脚本；挂 Canvas 下同名空节点，一次性点火 + 入口逻辑 */
@ccclass('ScMain')
export class ScMain extends FFScene {
    onStart(): void {
        this.on('BindReady'); // 试基类事件：listener=this → onBindReady
        this.boot();
    }

    onBindReady(e: { data?: unknown }): void {
        console.info('[ScMain] 事件 BindReady', e.data);
    }

    /** load/bind Demo；切场景由 DemoHome.onBind 调 ff.ui */
    private boot(): void {
        ff.binder.loadBundle('DemoChild', (err) => {
            if (err) return console.error('[ScMain] load DemoChild 失败', err);
            ff.binder.loadBundle('DemoHome', (err2) => {
                if (err2) return console.error('[ScMain] load DemoHome 失败', err2);
                void ff.binder.bind('DemoHome').then(
                    () => { console.info('[ScMain] 入口完成，绑定树', ff.binder.dumpTree()); },
                    (bindErr) => { console.error('[ScMain] bind DemoHome 失败', bindErr); },
                );
            }, (finished, total) => {
                console.info('[ScMain] DemoHome 进度', finished, total);
            });
        });
    }
}
