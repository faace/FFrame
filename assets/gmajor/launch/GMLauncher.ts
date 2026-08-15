import { GMBinder } from '../bind/GMBinder';
import type { IGMBundleEntry } from '../bind/GMBundleEntryBase';
import { GMBundleRegistry } from '../bind/GMBundleRegistry';
import { GMCocosResource } from '../resource/GMCocosResource';
import { bindGMEvents } from '../event/GMEventHost';
import { GMEventManager } from '../event/GMEventManager';
import type { IGMResource } from '../resource/IGMResource';
import { GMUIManager } from '../ui/GMUIManager';

/** 全局核心句柄（模块加载时创建；用法 gm.binder / gm.events / gm.ui …） */
export interface GMCore {
    readonly events: GMEventManager;
    readonly resource: IGMResource;
    readonly registry: GMBundleRegistry;
    readonly binder: GMBinder;
    readonly ui: GMUIManager;
}

const events = new GMEventManager();
bindGMEvents(events);

const resource = new GMCocosResource();
const registry = new GMBundleRegistry();
const binder = new GMBinder(registry, resource, events);
const ui = new GMUIManager(resource);
binder.attachUI(ui);

/** GMajor 全局单例 */
export const gm: GMCore = { events, resource, registry, binder, ui };

/** Bundle 入口自登记（写到 gm.registry） */
export function registerBundleEntry(name: string, entry: IGMBundleEntry): void {
    gm.registry.register(name, entry);
}

console.info('[gmajor] 核心已就绪');
