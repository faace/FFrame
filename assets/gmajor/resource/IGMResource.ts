/**
 * 资源门面：只提供能力，是否下载/加载由上层逻辑决定。
 * @see GMCocosResource
 */
import type { Asset, AssetManager } from 'cc';
import type { GMAsyncComplete, GMAsyncCompleteWith, GMAsyncProgress } from './GMAsyncCallback';

export interface IGMResource {
    hasBundle(name: string): boolean; // Bundle 是否已可用
    getBundle(name: string): AssetManager.Bundle | null; // 已加载的 Bundle；未加载返回 null
    /** 加载 Bundle；成功后脚本应已自登记。进度可选（本地包可能几乎无回调） */
    loadBundle(name: string, onComplete: GMAsyncComplete, onProgress?: GMAsyncProgress): void;
    /** 从已加载 Bundle 加载资源；path 为包内路径（不含扩展名） */
    load<T extends Asset>(bundleName: string, path: string, type: new (...args: any[]) => T, onComplete: GMAsyncCompleteWith<T>, onProgress?: GMAsyncProgress): void;
    releaseBundle(name: string): Promise<void>; // 释放（失败回滚默认会调）
}
