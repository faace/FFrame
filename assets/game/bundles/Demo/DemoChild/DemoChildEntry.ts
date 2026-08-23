import { GMBindContext, GMBundleEntryBase, registerBundleEntry } from '../../../../gmajor';

/** 示范子功能：被 DemoHome 嵌套绑定 */
class DemoChildEntry extends GMBundleEntryBase {
    constructor() {
        super('DemoChild');
    }

    onInit(): void {
        console.log('[DemoChild] onInit');
    }

    async onBind(ctx: GMBindContext): Promise<void> {
        console.log('[DemoChild] onBind', ctx.bindPath.join('/'));
    }

    onStart(): void {
        console.log('[DemoChild] onStart (Ready)');
    }

    async onUnbind(): Promise<void> {
        console.log('[DemoChild] onUnbind');
    }

    onRemove(): void {
        console.log('[DemoChild] onRemove');
    }
}

registerBundleEntry('DemoChild', new DemoChildEntry());
