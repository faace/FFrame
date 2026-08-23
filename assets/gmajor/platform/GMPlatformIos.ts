import { GMPlatform } from './GMPlatform';

/** 苹果原生；schema 参数后补，本轮空表 */
export class GMPlatformIos extends GMPlatform {
    constructor() {
        super('ios', {}, false);
    }
}
