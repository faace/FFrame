import { FFBindContext, FFBundleEntryBase, registerBundleEntry } from '../../../fframe';

/** 示范功能：嵌套绑定 DemoChild，再切真场景并开一个 layer */
class DemoHomeEntry extends FFBundleEntryBase {
    constructor() {
        super('DemoHome');
    }

    onInit(): void {
        console.log('[DemoHome] onInit');
    }

    async onBind(ctx: FFBindContext): Promise<void> {
        console.log('[DemoHome] onBind', ctx.bindPath.join('/'));
        this.on('BindReady');
        await ctx.bindChild('DemoChild');
        ctx.openScene('ScDemoHome', (err) => {
            if (err) return console.error('[DemoHome] openScene 失败', err);
            ctx.showLayer('LyDemoPopup', (err2) => {
                if (err2) return console.error('[DemoHome] showLayer 失败', err2);
                console.info('[DemoHome] 场景与弹窗已打开');
            });
        });
    }

    onBindReady(e: { data?: unknown }): void {
        console.info('[DemoHome] 事件 BindReady', e.data);
    }

    onStart(): void {
        console.log('[DemoHome] onStart (Ready)');
    }

    async onUnbind(): Promise<void> {
        console.log('[DemoHome] onUnbind');
    }

    onRemove(): void {
        console.log('[DemoHome] onRemove');
    }
}

registerBundleEntry('DemoHome', new DemoHomeEntry());
