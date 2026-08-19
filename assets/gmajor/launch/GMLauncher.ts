import { GMBinder } from '../bind/GMBinder';
import type { IGMBundleEntry } from '../bind/GMBundleEntryBase';
import { GMBundleRegistry } from '../bind/GMBundleRegistry';
import { GMCocosResource } from '../resource/GMCocosResource';
import { bindGMEvents } from '../event/GMEventHost';
import { GMEventManager } from '../event/GMEventManager';
import type { IGMResource } from '../resource/IGMResource';
import { config } from '../config';
import { GMStoreHub, type GMDataRoot, type GMLocalRoot } from '../data/GMStoreHub';
import { GMUIManager } from '../ui/GMUIManager';

/** 全局核心句柄（模块加载时创建；用法 gm.binder / gm.events / gm.ui / gd / gl …） */
export interface GMCore {
    readonly events: GMEventManager;
    readonly resource: IGMResource;
    readonly registry: GMBundleRegistry;
    readonly binder: GMBinder;
    readonly ui: GMUIManager;
    readonly data: GMDataRoot; // === gd
    readonly local: GMLocalRoot; // === gl
    readonly config: typeof config; // 框架配置（版本等）
}

const events = new GMEventManager();
bindGMEvents(events);

const resource = new GMCocosResource();
const registry = new GMBundleRegistry();
const binder = new GMBinder(registry, resource, events);
const ui = new GMUIManager(resource);
const store = new GMStoreHub();
binder.attachUI(ui);
binder.attachStore(store);

export const gd = store.gd; // === gm.data；全是 server
export const gl = store.gl; // === gm.local；全是本地

/** GMajor 全局单例 */
export const gm: GMCore = { events, resource, registry, binder, ui, data: gd, local: gl, config };

declare global {
    interface Window {
        gm: GMCore;
        gd: GMDataRoot;
        gl: GMLocalRoot;
    }
}

const w = globalThis as unknown as Window;
w.gm = gm; // 预览控制台可直接敲
w.gd = gd;
w.gl = gl;

/** Bundle 入口自登记（写到 gm.registry） */
export function registerBundleEntry(name: string, entry: IGMBundleEntry): void {
    gm.registry.register(name, entry);
}

console.info('[gmajor] 核心已就绪', config.version);
