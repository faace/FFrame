import type { GMAsyncCompleteWith } from '../resource/GMAsyncCallback';
import { GMKvStore, type GMStorePack } from './GMKvStore';

const USER_SEED: GMStorePack = {
    v: 1,
    data: { id: 'u-1001', nickname: 'Farmer', level: 1, exp: 0, gold: 1000, energy: 100, lastOfflineAt: 0 },
};

/** RemoteAdapter：调用形态像真服；web 用 localStorage 当假服 */
export class GMRemoteAdapter {
    constructor(private readonly kv: GMKvStore) {}

    pull(tree: string, onComplete: GMAsyncCompleteWith<GMStorePack>): void {
        let pack = this.kv.read(tree);
        if (!pack && tree === 'User') {
            this.kv.write('User', USER_SEED);
            pack = USER_SEED;
        }
        onComplete(null, pack ?? { v: 1, data: {} });
    }
}
