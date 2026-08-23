import { _decorator } from 'cc';
import { GMScene, gm, gp } from '../gmajor';
import { config } from './config';

const { ccclass } = _decorator;

/** ScMain.scene 关联脚本；挂 Canvas 下同名空节点；只点火，不写游戏名 */
@ccclass('ScMain')
export class ScMain extends GMScene {
    onStart(): void {
        const role = gp.params.role || 'web';
        console.info('[ScMain] 版本', 'gmajor', gm.config.version, 'app', config.version.app, 'platform', gp.id, 'role', role);
        gm.boot(config, (err) => {
            if (err) return console.error('[ScMain] boot 失败', err);
            console.info('[ScMain] 入口完成', '绑定树', gm.binder.dumpTree());
        }, (finished, total) => {
            console.info('[ScMain] boot 进度', finished, total);
        });
    }
}
