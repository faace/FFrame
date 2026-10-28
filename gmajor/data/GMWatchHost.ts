import type { GMWatchCb, GMWatchRoot } from './GMStoreHub';

interface WatchRec {
    root: GMWatchRoot;
    name: string;
    key: string;
    cb: GMWatchCb;
}

/** 挂在 GMClassBase / GMComponent 上：记本实例 watch，退场时卸干净 */
export class GMWatchHost {
    private readonly recs: WatchRec[] = [];

    watch(root: GMWatchRoot, name: string, key: string, cb: GMWatchCb): this {
        root.watch(name, key, cb);
        this.recs.push({ root, name, key, cb });
        return this;
    }

    unwatch(root: GMWatchRoot, name: string, key: string, cb: GMWatchCb): this {
        root.unwatch(name, key, cb);
        const i = this.recs.findIndex((r) => r.root === root && r.name === name && r.key === key && r.cb === cb);
        if (i > -1) this.recs.splice(i, 1);
        return this;
    }

    removeAll(): void {
        for (const r of this.recs) r.root.unwatch(r.name, r.key, r.cb);
        this.recs.length = 0;
    }
}
