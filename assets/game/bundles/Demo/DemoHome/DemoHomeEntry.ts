import { GMBindContext, GMBundleEntryBase, registerBundleEntry } from '../../../../gmajor';

/** web 入口：只开场景。Alert / loading / 占用 unbind 等验收已过，不再自动跑 */
class DemoHomeEntry extends GMBundleEntryBase {
    constructor() {
        super('DemoHome');
    }

    async onBind(ctx: GMBindContext): Promise<void> {
        ctx.openScene('ScDemoHome', (err) => {
            if (err) return console.error('[DemoHome] openScene 失败', err);
        });
    }
}

registerBundleEntry('DemoHome', new DemoHomeEntry());
