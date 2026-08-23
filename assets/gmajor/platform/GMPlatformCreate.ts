import { sys } from 'cc';
import type { GMEventManager } from '../event/GMEventManager';
import { GMPlatform } from './GMPlatform';
import { GMPlatformAndroid } from './GMPlatformAndroid';
import { GMPlatformElectron } from './GMPlatformElectron';
import { GMPlatformIos } from './GMPlatformIos';
import { GMPlatformWeb } from './GMPlatformWeb';
import { GMPlatformWechat } from './GMPlatformWechat';

/** 先壳、再 sys、其余 web；不认 process.versions.electron */
export function createPlatform(events: GMEventManager): GMPlatform {
    let p: GMPlatform;
    if (GMPlatformElectron.hasShell()) p = new GMPlatformElectron();
    else {
        const plat = String(sys.platform).toLowerCase();
        const os = String(sys.os).toLowerCase();
        if (plat === 'wechat_game' || plat === 'wechat_mini_program') p = new GMPlatformWechat();
        else if (sys.isNative && (plat === 'android' || os === 'android')) p = new GMPlatformAndroid();
        else if (sys.isNative && (plat === 'ios' || os === 'ios')) p = new GMPlatformIos();
        else p = new GMPlatformWeb();
    }
    p.attachEvents(events);
    return p;
}
