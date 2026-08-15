import { GMBindContext, GMBundleEntryBase, gm, registerBundleEntry } from '../../../gmajor';

/** 示范功能：嵌套绑定 DemoChild，再切真场景并开一个 layer */
class DemoHomeEntry extends GMBundleEntryBase {
    constructor() {
        super('DemoHome');
    }

    onInit(): void {
        console.log('[DemoHome] onInit');
    }

    async onBind(ctx: GMBindContext): Promise<void> {
        console.log('[DemoHome] onBind', ctx.bindPath.join('/'));
        this.on('BindReady');
        await ctx.bindChild('DemoChild');
        ctx.openScene('ScDemoHome', (err) => {
            if (err) return console.error('[DemoHome] openScene 失败', err);
            ctx.showLayer('LyDemoPopup', (err2) => {
                if (err2) return console.error('[DemoHome] showLayer 失败', err2);
                console.info('[DemoHome] 场景与弹窗已打开');
                this.demoOccupyAndClose(ctx);
            });
        });
    }

    /** 故意 unbind（应拒绝）→ closeLayer → 再 unbind（场景仍占，仍拒绝） */
    private demoOccupyAndClose(ctx: GMBindContext): void {
        void gm.binder.unbind('DemoHome').then(
            () => console.error('[DemoHome] 占用中 unbind 却成功了'),
            (e) => {
                console.info('[DemoHome] 占用中 unbind 已拒绝（预期）', e);
                ctx.closeLayer('LyDemoPopup', (err) => {
                    if (err) return console.error('[DemoHome] closeLayer 失败', err);
                    console.info('[DemoHome] closeLayer 完成');
                    void gm.binder.unbind('DemoHome').then(
                        () => console.error('[DemoHome] 关弹窗后 unbind 却成功了'),
                        (e2) => console.info('[DemoHome] 关弹窗后仍占场景，unbind 已拒绝（预期）', e2),
                    );
                });
            },
        );
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
