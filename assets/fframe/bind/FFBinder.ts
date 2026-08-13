import type { FFAsyncComplete, FFAsyncProgress } from '../resource/FFAsyncCallback';
import { FFBindContext } from './FFBindContext';
import { FFBindState } from './FFBindState';
import type { FFBundleRegistry } from './FFBundleRegistry';
import type { FFEventManager } from '../event/FFEventManager';
import type { IFFResource } from '../resource/IFFResource';
import type { FFUIManager } from '../ui/FFUIManager';

export interface FFBindOptions {
    loadIfNeeded?: boolean; // true=bind 前自动 load；默认 false（逻辑显式 load）
    parentPath?: readonly string[];
    parentName?: string;
    releaseOnRollback?: boolean; // 失败回滚是否 release Bundle，默认 true
}

interface BindNode {
    name: string;
    children: string[];
    parent?: string;
}

/** 调用者编排：load/bind/unbind、嵌套树、失败回滚 */
export class FFBinder {
    private readonly nodes = new Map<string, BindNode>();
    private readonly roots = new Set<string>();
    private ui: FFUIManager | null = null;

    constructor(private readonly registry: FFBundleRegistry, private readonly resource: IFFResource, private readonly events: FFEventManager) {}

    attachUI(ui: FFUIManager): void {
        this.ui = ui;
    }

    /** 当前绑定树（父 → 子名列表） */
    dumpTree(): Record<string, string[]> {
        const out: Record<string, string[]> = {};
        for (const [name, node] of this.nodes) {
            out[name] = [...node.children];
        }
        return out;
    }

    listBound(): string[] {
        return [...this.nodes.keys()];
    }

    /** 显式加载 Bundle；成功后注册表中必须已有入口。onProgress 可选 */
    loadBundle(name: string, onComplete: FFAsyncComplete, onProgress?: FFAsyncProgress): void {
        this.resource.loadBundle(name, (err) => {
            if (err) return onComplete(err);
            if (!this.registry.has(name)) {
                return onComplete(new Error(`[FFBinder] Bundle 已加载但未登记入口: ${name}`));
            }
            onComplete(null);
        }, onProgress);
    }

    /** bind(loadIfNeeded) 内部用：把回调式 load 收成 Promise */
    private loadBundleAsync(name: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.loadBundle(name, (err) => (err ? reject(err) : resolve()));
        });
    }

    /**
     * 绑定至就绪。默认要求已 load；失败则对称回滚。
     */
    async bind(name: string, options: FFBindOptions = {}): Promise<void> {
        if (this.nodes.has(name)) {
            const entry = this.registry.get(name);
            if (entry?.getState() === FFBindState.Ready) {
                console.debug('[FFBinder] 已就绪，跳过绑定', name);
                return;
            }
        }

        const releaseOnRollback = options.releaseOnRollback !== false;
        const parentPath = options.parentPath ?? [];

        try {
            if (options.loadIfNeeded) {
                await this.loadBundleAsync(name);
            } else if (!this.resource.hasBundle(name)) {
                throw new Error(`[FFBinder] Bundle 未加载: ${name}。请先由逻辑调用 loadBundle 后再 bind`);
            }

            const entry = this.registry.get(name);
            if (!entry) {
                throw new Error(`[FFBinder] 未找到标准入口: ${name}`);
            }

            const node: BindNode = { name, children: [], parent: options.parentName };
            this.nodes.set(name, node);
            if (options.parentName) {
                const parent = this.nodes.get(options.parentName);
                if (parent && !parent.children.includes(name)) {
                    parent.children.push(name);
                }
            } else {
                this.roots.add(name);
            }

            const ctx = new FFBindContext(name, this.events, this.resource, this, parentPath, this.ui);

            console.info('[FFBinder] bind →', ctx.bindPath.join(' / '));
            await entry.bind(ctx);
            this.events.emit({ name: 'BindReady', data: { name, bindPath: ctx.bindPath } });
            console.info('[FFBinder] ready', name);
        } catch (err) {
            console.error('[FFBinder] bind 失败，开始回滚', name, err);
            await this.rollback(name, releaseOnRollback);
            throw err;
        }
    }

    /**
     * 解绑；先逆序解绑子节点。releaseBundle 默认 true。
     */
    async unbind(name: string, releaseBundle = true): Promise<void> {
        const node = this.nodes.get(name);
        if (!node) {
            console.debug('[FFBinder] 未绑定，跳过解绑', name);
            return;
        }

        const blockers = this.ui?.getUnbindBlockers(this.collectFamily(name)) ?? [];
        if (blockers.length) {
            const msg = `[FFBinder] 不能 unbind ${name}：仍占用 ${blockers.join('；')}`;
            console.error(msg);
            throw new Error(msg);
        }

        // 子随父：逆序级联
        for (const child of [...node.children].reverse()) {
            await this.unbind(child, releaseBundle);
        }

        const entry = this.registry.get(name);
        const parentPath = this.buildPath(node.parent);
        const ctx = new FFBindContext(name, this.events, this.resource, this, parentPath, this.ui);

        console.info('[FFBinder] unbind →', name);
        if (entry) {
            await entry.unbind(ctx);
        }

        if (node.parent) {
            const parent = this.nodes.get(node.parent);
            if (parent) {
                parent.children = parent.children.filter((c) => c !== name);
            }
        } else {
            this.roots.delete(name);
        }
        this.nodes.delete(name);

        if (releaseBundle) {
            await this.resource.releaseBundle(name);
            this.registry.unregister(name);
        }

        this.events.emit({ name: 'BindUnbound', data: { name } });
    }

    private async rollback(name: string, releaseBundle: boolean): Promise<void> {
        try {
            await this.unbind(name, releaseBundle);
        } catch (e) {
            console.error('[FFBinder] 回滚时再次失败', name, e);
        }
    }

    private collectFamily(name: string): string[] {
        const out = [name];
        const node = this.nodes.get(name);
        if (!node) return out;
        for (const child of node.children) out.push(...this.collectFamily(child));
        return out;
    }

    private buildPath(parentName?: string): string[] {
        const path: string[] = [];
        let cur = parentName;
        while (cur) {
            path.unshift(cur);
            cur = this.nodes.get(cur)?.parent;
        }
        return path;
    }
}
