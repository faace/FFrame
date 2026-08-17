import { sys } from 'cc';

export interface GMStorePack {
    v: number; // 该树 schemaVersion
    data: Record<string, unknown>;
}

const ENVELOPE = 1; // 整仓格式；变了才升

/** localStorage 信封读写（LocalStore / web 假服共用） */
export class GMKvStore {
    constructor(private readonly prefix: string) {}

    read(tree: string): GMStorePack | null {
        const raw = this.ls()?.getItem(this.key(tree));
        if (!raw) return null;
        try {
            const pack = JSON.parse(raw) as GMStorePack & { envelope?: number };
            if (pack.envelope !== undefined && pack.envelope !== ENVELOPE) return null;
            if (typeof pack.v !== 'number' || !pack.data || typeof pack.data !== 'object') return null;
            return { v: pack.v, data: pack.data };
        } catch {
            return null;
        }
    }

    write(tree: string, pack: GMStorePack): void {
        this.ls()?.setItem(this.key(tree), JSON.stringify({ envelope: ENVELOPE, v: pack.v, data: pack.data }));
    }

    remove(tree: string): void {
        this.ls()?.removeItem(this.key(tree));
    }

    private key(tree: string): string {
        return `${this.prefix}.${tree}`;
    }

    private ls(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } | null {
        return sys.localStorage ?? null;
    }
}
