import { Prefab } from 'cc';
import { GMBindContext, GMBundleEntryBase, gm, registerBundleEntry } from '../../../gmajor';
import { config } from '../../config';

/** 本游戏常驻壳：开机预载确认框皮 */
class GameUIEntry extends GMBundleEntryBase {
    constructor() {
        super('GameUI');
    }

    onBind(ctx: GMBindContext): Promise<void> {
        const { bundle, prefab } = config.alert;
        return new Promise((resolve, reject) => {
            ctx.resource.load(bundle, prefab, Prefab, (err, asset) => {
                if (err || !asset) return reject(err ?? new Error('[GameUI] 预载 Alert 失败'));
                gm.ui.setAlertPrefab(asset);
                resolve();
            });
        });
    }
}

registerBundleEntry('GameUI', new GameUIEntry());
