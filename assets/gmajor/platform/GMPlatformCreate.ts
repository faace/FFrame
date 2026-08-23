import { sys } from 'cc';
import { GMPlatform } from './GMPlatform';
import { GMPlatformAndroid } from './GMPlatformAndroid';
import { GMPlatformElectron } from './GMPlatformElectron';
import { GMPlatformIos } from './GMPlatformIos';
import { GMPlatformWeb } from './GMPlatformWeb';
import { GMPlatformWechat } from './GMPlatformWechat';

/** 先壳、再 sys、其余 web；不认 process.versions.electron */
export function createPlatform(): GMPlatform {
    if (GMPlatformElectron.hasShell()) return new GMPlatformElectron();
    const plat = String(sys.platform).toLowerCase();
    const os = String(sys.os).toLowerCase();
    if (plat === 'wechat_game' || plat === 'wechat_mini_program') return new GMPlatformWechat();
    if (sys.isNative) {
        if (plat === 'android' || os === 'android') return new GMPlatformAndroid();
        if (plat === 'ios' || os === 'ios') return new GMPlatformIos();
    }
    return new GMPlatformWeb();
}
