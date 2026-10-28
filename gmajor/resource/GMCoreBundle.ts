import { assetManager, settings } from 'cc';
import type { GMAsyncComplete } from './GMAsyncCallback';

/** 框架自带预制体所在 Bundle（源目录 gmajor/prefabs）。PfGM* 常被代码按 uuid 动态加载，不放进 Bundle 就不会被打进包 */
export const CORE_BUNDLE = 'GMUI';

let done = false;

/** 开机时加载。工程里没有这个 Bundle（旧版本、某些预览）就当已完成 */
export function loadCoreBundle(onComplete: GMAsyncComplete): void {
    if (done) return onComplete(null);
    const known = settings.querySettings<string[]>('assets', 'projectBundles');
    if (known && known.length && known.indexOf(CORE_BUNDLE) < 0) {
        done = true;
        return onComplete(null);
    }
    assetManager.loadBundle(CORE_BUNDLE, (err) => {
        if (err) return onComplete(err);
        done = true;
        onComplete(null);
    });
}
