import { GMPlatform, readUrlParams } from './GMPlatform';

/** Creator 预览 / 纯浏览器 */
export class GMPlatformWeb extends GMPlatform {
    constructor() {
        super('web', readUrlParams(), false);
    }
}
