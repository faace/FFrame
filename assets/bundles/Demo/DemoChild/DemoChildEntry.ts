import { FFBindContext, FFBundleEntryBase, registerBundleEntry } from '../../../fframe';

/** 示范子功能：被 DemoHome 嵌套绑定 */
class DemoChildEntry extends FFBundleEntryBase {
    constructor() {
        super('DemoChild');
    }

    async onLoad(): Promise<void> {
        console.log('[DemoChild] onLoad');
    }

    async onBind(ctx: FFBindContext): Promise<void> {
        console.log('[DemoChild] onBind', ctx.bindPath.join('/'));
    }

    async start(): Promise<void> {
        console.log('[DemoChild] start (Ready)');
    }

    async onUnbind(): Promise<void> {
        console.log('[DemoChild] onUnbind');
    }

    async onDestroy(): Promise<void> {
        console.log('[DemoChild] onDestroy');
    }
}

registerBundleEntry('DemoChild', new DemoChildEntry());
