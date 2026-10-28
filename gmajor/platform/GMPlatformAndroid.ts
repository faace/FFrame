import { GMPlatform } from './GMPlatform';

/** 安卓原生；schema 参数后补，本轮空表 */
export class GMPlatformAndroid extends GMPlatform {
    constructor() {
        super('android', {}, false);
    }
}
