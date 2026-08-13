import { assetManager, AssetManager } from 'cc';
import type { Asset } from 'cc';
import type { FFAsyncComplete, FFAsyncCompleteWith, FFAsyncProgress } from './FFAsyncCallback';
import type { IFFResource } from './IFFResource';

/** 基于 assetManager 的 Bundle 加载/释放 */
export class FFCocosResource implements IFFResource {
    private readonly cache = new Map<string, AssetManager.Bundle>();

    hasBundle(name: string): boolean {
        return !!assetManager.getBundle(name) || this.cache.has(name);
    }

    getBundle(name: string): AssetManager.Bundle | null {
        return assetManager.getBundle(name) ?? this.cache.get(name) ?? null;
    }

    loadBundle(name: string, onComplete: FFAsyncComplete, onProgress?: FFAsyncProgress): void {
        const existing = assetManager.getBundle(name);
        if (existing) {
            this.cache.set(name, existing);
            onComplete(null);
            return;
        }

        console.info('[fframe] loadBundle', name);
        // 对外 onProgress；对接引擎时映射为 onFileProgress
        assetManager.loadBundle(name, { onFileProgress: onProgress } as never, (err, bundle) => {
            if (err || !bundle) {
                onComplete(err ?? new Error(`[FFCocosResource] loadBundle 失败: ${name}`));
                return;
            }
            this.cache.set(name, bundle);
            onComplete(null);
        });
    }

    load<T extends Asset>(bundleName: string, path: string, type: new (...args: any[]) => T, onComplete: FFAsyncCompleteWith<T>, onProgress?: FFAsyncProgress): void {
        const bundle = this.getBundle(bundleName);
        if (!bundle) return onComplete(new Error(`[FFCocosResource] Bundle 未加载: ${bundleName}`));
        const done = (err: Error | null, asset?: T) => {
            if (err || !asset) return onComplete(err ?? new Error(`[FFCocosResource] load 失败: ${bundleName}/${path}`));
            onComplete(null, asset);
        };
        if (onProgress) bundle.load(path, type, onProgress, done);
        else bundle.load(path, type, done);
    }

    async releaseBundle(name: string): Promise<void> {
        const bundle = assetManager.getBundle(name) ?? this.cache.get(name);
        if (!bundle) return;
        console.info('[fframe] releaseBundle', name);
        assetManager.removeBundle(bundle);
        this.cache.delete(name);
    }
}
