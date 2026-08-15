import type { GMAsyncComplete, GMAsyncProgress } from '../resource/GMAsyncCallback';
import type { GMBinder } from './GMBinder';
import type { GMEventManager } from '../event/GMEventManager';
import type { IGMResource } from '../resource/IGMResource';
import type { GMUIManager } from '../ui/GMUIManager';

/**
 * 绑定驱动上下文：给入口用的核心能力子集。
 * 不含万能服务定位器。openScene/showLayer 自动带本 Bundle 名。
 */
export class GMBindContext {
    constructor(public readonly bundleName: string, public readonly events: GMEventManager, public readonly resource: IGMResource, private readonly binder: GMBinder, public readonly parentPath: readonly string[] = [], private readonly ui: GMUIManager | null = null) {}

    get bindPath(): readonly string[] { // 只读绑定路径，便于排障
        return [...this.parentPath, this.bundleName];
    }

    /** 嵌套绑定子 Bundle；子随父解绑/回滚 */
    bindChild(name: string): Promise<void> {
        return this.binder.bind(name, { parentPath: this.bindPath, parentName: this.bundleName });
    }

    openScene(sceneName: string, onComplete?: GMAsyncComplete, onProgress?: GMAsyncProgress): void {
        if (!this.ui) return console.error('[GMBindContext] 无 ui');
        this.ui.openScene(sceneName, { bundle: this.bundleName }, onComplete, onProgress);
    }

    showLayer(layerName: string, onComplete?: GMAsyncComplete): void {
        if (!this.ui) return console.error('[GMBindContext] 无 ui');
        this.ui.showLayer(layerName, { bundle: this.bundleName }, onComplete);
    }

    closeLayer(layerName: string, onComplete?: GMAsyncComplete): void {
        if (!this.ui) return console.error('[GMBindContext] 无 ui');
        this.ui.closeLayer(layerName, onComplete);
    }
}
