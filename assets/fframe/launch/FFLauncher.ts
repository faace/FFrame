import { FFBinder } from '../bind/FFBinder';
import type { IFFBundleEntry } from '../bind/FFBundleEntryBase';
import { FFBundleRegistry } from '../bind/FFBundleRegistry';
import { FFCocosResource } from '../resource/FFCocosResource';
import { bindFFEvents } from '../event/FFEventHost';
import { FFEventManager } from '../event/FFEventManager';
import type { IFFResource } from '../resource/IFFResource';

/** 全局核心句柄（模块加载时创建；用法 ff.binder / ff.events …） */
export interface FFCore {
    readonly events: FFEventManager;
    readonly resource: IFFResource;
    readonly registry: FFBundleRegistry;
    readonly binder: FFBinder;
}

const events = new FFEventManager();
bindFFEvents(events);

const resource = new FFCocosResource();
const registry = new FFBundleRegistry();
const binder = new FFBinder(registry, resource, events);

/** FFrame 全局单例 */
export const ff: FFCore = { events, resource, registry, binder };

/** Bundle 入口自登记（写到 ff.registry） */
export function registerBundleEntry(name: string, entry: IFFBundleEntry): void {
    ff.registry.register(name, entry);
}

console.info('[fframe] 核心已就绪');
