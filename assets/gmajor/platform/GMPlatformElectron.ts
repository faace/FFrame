import { GMPlatform, readUrlParams } from './GMPlatform';

/** Electron 游戏壳；window.desktop 只在本类探测，其它模块走 gp */
export class GMPlatformElectron extends GMPlatform {
    constructor() {
        super('electron', readUrlParams(), true);
    }

    static hasShell(): boolean {
        return !!(globalThis as { desktop?: unknown }).desktop;
    }
}
