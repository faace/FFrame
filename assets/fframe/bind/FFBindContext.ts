import type { FFAsyncComplete, FFAsyncProgress } from '../resource/FFAsyncCallback';
import type { FFBinder } from './FFBinder';
import type { FFEventManager } from '../event/FFEventManager';
import type { IFFResource } from '../resource/IFFResource';
import type { FFUIManager } from '../ui/FFUIManager';

/**
 * 绑定驱动上下文：给入口用的核心能力子集。
 * 不含万能服务定位器。openScene/showLayer 自动带本 Bundle 名。
 */
export class FFBindContext {
    constructor(public readonly bundleName: string, public readonly events: FFEventManager, public readonly resource: IFFResource, private readonly binder: FFBinder, public readonly parentPath: readonly string[] = [], private readonly ui: FFUIManager | null = null) {}

    get bindPath(): readonly string[] { // 只读绑定路径，便于排障
        return [...this.parentPath, this.bundleName];
    }

    /** 嵌套绑定子 Bundle；子随父解绑/回滚 */
    bindChild(name: string): Promise<void> {
        return this.binder.bind(name, { parentPath: this.bindPath, parentName: this.bundleName });
    }

    openScene(sceneName: string, onComplete?: FFAsyncComplete, onProgress?: FFAsyncProgress): void {
        if (!this.ui) return console.error('[FFBindContext] 无 ui');
        this.ui.openScene(sceneName, { bundle: this.bundleName }, onComplete, onProgress);
    }

    showLayer(layerName: string, onComplete?: FFAsyncComplete): void {
        if (!this.ui) return console.error('[FFBindContext] 无 ui');
        this.ui.showLayer(layerName, { bundle: this.bundleName }, onComplete);
    }

    closeLayer(layerName: string, onComplete?: FFAsyncComplete): void {
        if (!this.ui) return console.error('[FFBindContext] 无 ui');
        this.ui.closeLayer(layerName, onComplete);
    }
}
