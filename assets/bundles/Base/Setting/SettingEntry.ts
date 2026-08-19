import { GMBundleEntryBase, gl, registerBundleEntry } from '../../../../gmajor';

/** 基础包：本地设置 gl.Setting */
class SettingEntry extends GMBundleEntryBase {
    constructor() {
        super('Setting');
    }

    onBind(): void {
        const setting = gl.Setting;
        if (!setting) return console.error('[Setting] gl.Setting 未建树');
        if (setting.bgmVolume === undefined) setting.bgmVolume = 1;
        if (setting.sfxVolume === undefined) setting.sfxVolume = 1;
        if (setting.language === undefined) setting.language = 'zh';
        console.info('[Setting] 就绪', setting);
    }
}

registerBundleEntry('Setting', new SettingEntry());
