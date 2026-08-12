import type { IFFBundleEntry } from './FFBundleEntryBase';

/** Bundle 标准入口注册表；由 Bundle 脚本 load 时自登记 */
export class FFBundleRegistry {
    private readonly entries = new Map<string, IFFBundleEntry>();

    register(name: string, entry: IFFBundleEntry): void {
        if (this.entries.has(name)) {
            throw new Error(`[FFBundleRegistry] 重复登记: ${name}`);
        }
        this.entries.set(name, entry);
    }

    unregister(name: string): void {
        this.entries.delete(name);
    }

    get(name: string): IFFBundleEntry | undefined {
        return this.entries.get(name);
    }

    has(name: string): boolean {
        return this.entries.has(name);
    }

    list(): string[] {
        return [...this.entries.keys()];
    }

    clear(): void {
        this.entries.clear();
    }
}
