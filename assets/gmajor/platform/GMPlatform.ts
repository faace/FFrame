/** 平台身份；双窗方法后置 */
export type GMPlatformId = 'web' | 'electron' | 'wechat' | 'android' | 'ios';

export type GMPlatformParams = { [key: string]: string }; // 普通对象；Web/Electron 填 URL query

/** 从当前页 URL 取 query；无 location 则空表 */
export function readUrlParams(): GMPlatformParams {
    const href = (globalThis as { location?: { href?: string } }).location?.href;
    if (!href) return {};
    try {
        const out: GMPlatformParams = {};
        new URL(href).searchParams.forEach((v, k) => { out[k] = v; });
        return out;
    } catch {
        return {};
    }
}

/** 平台基类；游戏只握 gp，不认子类名 */
export class GMPlatform {
    constructor(
        readonly id: GMPlatformId,
        readonly params: GMPlatformParams,
        readonly hasWindow = false, // electron 才 true；双窗 API 后置
    ) {}
}
