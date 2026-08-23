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
import { createPlatform } from '../platform/GMPlatformCreate';
import type { GMPlatform } from '../platform/GMPlatform';
import type { GMAsyncComplete, GMAsyncProgress } from '../resource/GMAsyncCallback';
import type { GMBootOpts, GMGameConfig } from './GMBoot';

/** 全局核心句柄（模块加载时创建；用法 gm.binder / gm.events / gm.ui / gd / gl / gu / gp …） */
export interface GMCore {
    readonly events: GMEventManager;
    readonly resource: IGMResource;
    readonly registry: GMBundleRegistry;
    readonly binder: GMBinder;
    readonly ui: GMUIManager;
    readonly data: GMDataRoot; // === gd
    readonly local: GMLocalRoot; // === gl
    readonly platform: GMPlatform; // === gp
    readonly config: typeof config; // 框架配置（版本等）
    boot(game: GMGameConfig, onComplete: GMAsyncComplete, onProgress?: GMAsyncProgress): void;
    boot(game: GMGameConfig, opts: GMBootOpts, onComplete: GMAsyncComplete, onProgress?: GMAsyncProgress): void;
}

const events = new GMEventManager();
bindGMEvents(events);

const resource = new GMCocosResource();
const registry = new GMBundleRegistry();
const binder = new GMBinder(registry, resource, events);
const ui = new GMUIManager(resource);
ui.bindPixelFit(); // 窗多大，逻辑分辨率就多大
const store = new GMStoreHub();
binder.attachUI(ui);
binder.attachStore(store);

export const gd = store.gd; // === gm.data；全是 server
export const gl = store.gl; // === gm.local；全是本地
export const gu = ui; // === gm.ui
export const gp = createPlatform(events); // === gm.platform；import 时认环境；推送进 events

function boot(game: GMGameConfig, onComplete: GMAsyncComplete, onProgress?: GMAsyncProgress): void;
function boot(game: GMGameConfig, opts: GMBootOpts, onComplete: GMAsyncComplete, onProgress?: GMAsyncProgress): void;
function boot(game: GMGameConfig, a: GMBootOpts | GMAsyncComplete, b?: GMAsyncComplete | GMAsyncProgress, c?: GMAsyncProgress): void {
    const hasOpts = typeof a !== 'function';
    const opts = hasOpts ? a as GMBootOpts : undefined;
    const onComplete = (hasOpts ? b : a) as GMAsyncComplete;
    const onProgress = (hasOpts ? c : b) as GMAsyncProgress | undefined;
    const role = opts?.role || gp.params.role || 'web';
    const entry = game.entry[role];
    if (!entry) return onComplete(new Error(`[gm.boot] 无入口 role=${role}`));
    const names = game.boot.slice();
    if (names.indexOf(entry) < 0) names.push(entry);
    console.info('[gm.boot] role', role, 'packs', names.join(','));
    binder.bindInOrder(names, onComplete, onProgress);
}

/** GMajor 全局单例 */
export const gm: GMCore = { events, resource, registry, binder, ui, data: gd, local: gl, platform: gp, config, boot };

declare global {
    interface Window {
        gm: GMCore;
        gd: GMDataRoot;
        gl: GMLocalRoot;
        gu: GMUIManager;
        gp: GMPlatform;
    }
}

const w = globalThis as unknown as Window;
w.gm = gm; // 预览控制台可直接敲
w.gd = gd;
w.gl = gl;
w.gu = gu;
w.gp = gp;

/** Bundle 入口自登记（写到 gm.registry） */
export function registerBundleEntry(name: string, entry: IGMBundleEntry): void {
    gm.registry.register(name, entry);
}

console.info('[gmajor] 核心已就绪', config.version);
console.info('[gp]', gp.id, 'hasWindow', gp.hasWindow, 'role', gp.params.role || 'web');
