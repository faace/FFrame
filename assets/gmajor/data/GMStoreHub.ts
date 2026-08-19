import type { GMAsyncComplete } from '../resource/GMAsyncCallback';
import { GMKvStore } from './GMKvStore';
import { GMRemoteAdapter } from './GMRemoteAdapter';

const SCHEMA = 1; // 第一刀各树默认 version

interface TreeRec {
    name: string;
    schema: number;
    writable: boolean; // gl 可赋值；gd 只能 apply
    persist: boolean; // 写 LocalStore（仅 gl）
    data: Record<string, unknown>;
    proxy: Record<string, unknown>;
}

/** 数据枢纽：gd / gl 两根 + bind 建树 / unbind 拆树 */
export class GMStoreHub {
    readonly gd: GMDataRoot;
    readonly gl: GMLocalRoot;

    private readonly dataTrees = new Map<string, TreeRec>();
    private readonly localTrees = new Map<string, TreeRec>();
    private readonly localKv = new GMKvStore('gm.gl');
    private readonly remote = new GMRemoteAdapter(new GMKvStore('gm.remote'));

    constructor() {
        this.gd = this.makeDataRoot();
        this.gl = this.makeLocalRoot();
    }

    onBind(name: string): void {
        this.ensureTree(this.dataTrees, name, false, false);
        this.ensureTree(this.localTrees, name, true, true);
    }

    onUnbind(name: string): void {
        this.dropTree(this.dataTrees, name, false);
        this.dropTree(this.localTrees, name, true);
    }

    apply(name: string, patch: Record<string, unknown>): void {
        const rec = this.dataTrees.get(name);
        if (!rec) return console.error('[gd] apply 无此树', name);
        Object.assign(rec.data, patch);
    }

    sync(name: string, onComplete: GMAsyncComplete): void {
        const rec = this.dataTrees.get(name);
        if (!rec) return onComplete(new Error(`[gd] sync 无此树: ${name}`));
        this.remote.pull(name, (err, pack) => {
            if (err) return onComplete(err);
            if (!pack) return onComplete(new Error(`[gd] sync 空包: ${name}`));
            if (pack.v !== rec.schema) {
                console.warn('[gd] version 不符，丢弃', name, pack.v, rec.schema);
                this.clearData(rec);
                return onComplete(null);
            }
            this.apply(name, pack.data);
            onComplete(null);
        });
    }

    private ensureTree(map: Map<string, TreeRec>, name: string, writable: boolean, persist: boolean): TreeRec {
        const old = map.get(name);
        if (old) return old;
        const data: Record<string, unknown> = {};
        const rec: TreeRec = { name, schema: SCHEMA, writable, persist, data, proxy: data };
        rec.proxy = this.makeTreeProxy(rec);
        if (persist) this.hydrateLocal(rec);
        map.set(name, rec);
        return rec;
    }

    private dropTree(map: Map<string, TreeRec>, name: string, wipeStore: boolean): void {
        if (!map.has(name)) return;
        map.delete(name);
        if (wipeStore) this.localKv.remove(name);
    }

    private hydrateLocal(rec: TreeRec): void {
        const pack = this.localKv.read(rec.name);
        if (!pack) return;
        if (pack.v !== rec.schema) {
            console.warn('[gl] version 不符，丢弃', rec.name, pack.v, rec.schema);
            this.localKv.remove(rec.name);
            return;
        }
        Object.assign(rec.data, pack.data);
    }

    private persistLocal(rec: TreeRec): void {
        if (!rec.persist) return;
        this.localKv.write(rec.name, { v: rec.schema, data: { ...rec.data } });
    }

    private clearData(rec: TreeRec): void {
        for (const key of Object.keys(rec.data)) delete rec.data[key];
    }

    private makeTreeProxy(rec: TreeRec): Record<string, unknown> {
        const self = this;
        return new Proxy(rec.data, {
            get(t, key) {
                return t[key as string];
            },
            set(t, key, value) {
                if (!rec.writable) throw new Error(`[gd] 不能直接写 ${rec.name}.${String(key)}，请用 apply/sync`);
                t[key as string] = value;
                self.persistLocal(rec);
                return true;
            },
        });
    }

    private makeDataRoot(): GMDataRoot {
        const self = this;
        const api = {
            apply: (name: string, patch: Record<string, unknown>) => self.apply(name, patch),
            sync: (name: string, onComplete: GMAsyncComplete) => self.sync(name, onComplete),
        };
        return new Proxy(api, {
            get(t, key) {
                if (key in t) return t[key as keyof typeof t];
                return self.dataTrees.get(key as string)?.proxy;
            },
        }) as GMDataRoot;
    }

    private makeLocalRoot(): GMLocalRoot {
        const self = this;
        return new Proxy({} as GMLocalRoot, {
            get(_, key) {
                return self.localTrees.get(key as string)?.proxy;
            },
        });
    }
}

export type GMDataRoot = {
    apply(name: string, patch: Record<string, unknown>): void;
    sync(name: string, onComplete: GMAsyncComplete): void;
    [name: string]: unknown;
};

export type GMLocalRoot = {
    [name: string]: Record<string, unknown> | undefined;
};
