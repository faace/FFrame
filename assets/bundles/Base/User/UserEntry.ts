import { GMBundleEntryBase, gd, registerBundleEntry } from '../../../../gmajor';

/** 基础包：账号树 gd.User */
class UserEntry extends GMBundleEntryBase {
    constructor() {
        super('User');
    }

    onBind(): Promise<void> {
        return new Promise((resolve, reject) => {
            gd.sync('User', (err) => {
                if (err) return reject(err);
                console.info('[User] 就绪', gd.User);
                resolve();
            });
        });
    }
}

registerBundleEntry('User', new UserEntry());
