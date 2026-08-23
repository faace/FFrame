import { GMPlatform, type GMPlatformParams } from './GMPlatform';

type WxLaunch = { query?: { [key: string]: string } };

function readWxParams(): GMPlatformParams {
    const wx = (globalThis as { wx?: { getLaunchOptionsSync?: () => WxLaunch } }).wx;
    const query = wx?.getLaunchOptionsSync?.()?.query;
    if (!query) return {};
    const out: GMPlatformParams = {};
    for (const k in query) out[k] = String(query[k]);
    return out;
}

/** 微信小游戏 / 小程序；启动参数只在本类读 wx */
export class GMPlatformWechat extends GMPlatform {
    constructor() {
        super('wechat', readWxParams(), false);
    }
}
