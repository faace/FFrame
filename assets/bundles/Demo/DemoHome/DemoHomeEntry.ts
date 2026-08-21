import { GMBindContext, GMBundleEntryBase, GMClassBase, gd, gl, gm, gu, registerBundleEntry } from '../../../gmajor';

/** 示范 spawn：包拆时走 onRemove */
class DemoHomeWatchProbe extends GMClassBase {
    constructor() {
        super('DemoHome');
    }

    init(parm?: { tag?: string }): void {
        console.info('[DemoHomeWatchProbe] init', parm?.tag);
    }

    onRemove(): void {
        console.log('[DemoHomeWatchProbe] onRemove');
    }
}

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
        this.demoData();
        this.on('BindReady');
        await ctx.bindChild('DemoChild');
        ctx.openScene('ScDemoHome', (err) => {
            if (err) return console.error('[DemoHome] openScene 失败', err);
            ctx.showLayer('LyDemoPopup', (err2) => {
                if (err2) return console.error('[DemoHome] showLayer 失败', err2);
                console.info('[DemoHome] 场景与弹窗已打开');
                this.demoAlert();
                this.demoLoading(() => this.demoOccupyAndClose(ctx));
            });
        });
    }

    /** 本地立刻落盘；watch 当场喊；server 只许 sync/apply */
    private demoData(): void {
        const home = gl.DemoHome;
        const setting = gl.Setting;
        if (!home) return console.error('[DemoHome] gl.DemoHome 未建树');
        if (!setting) return console.error('[DemoHome] gl.Setting 未建树（基础包未开？）');
        this.spawn(new DemoHomeWatchProbe(), { tag: 'demoData' });
        this.watch(gl, 'Setting', 'bgmVolume', (n, o) => console.info('[DemoHome] watch bgmVolume', o, '→', n));
        const next = setting.bgmVolume === 0.8 ? 0.7 : 0.8;
        setting.bgmVolume = next;
        home.lastTab = 'play';
        console.info('[DemoHome] gl.Setting.bgmVolume', setting.bgmVolume, 'gl.DemoHome.lastTab', home.lastTab);
        const user = gd.User as Record<string, unknown> | undefined;
        console.info('[DemoHome] gd.User.gold', user?.gold);
    }

    /** 单按钮 + 同参去重日志 + 带取消叠在上面 */
    private demoAlert(): void {
        const one = { content: 'Demo 单按钮 Alert', ok: () => console.info('[DemoHome] alert 确定') };
        gu.alert(one);
        gu.alert(one); // 应打重复忽略
        gu.alert({
            content: 'Demo 带取消 Alert',
            ok: () => console.info('[DemoHome] alert2 确定'),
            cancel: () => console.info('[DemoHome] alert2 取消'),
        });
    }

    /** 验收 loading 显形：快关看不见字；慢关 1.5s 后看见。openScene/showLayer 已内嵌，这里只测手调 */
    private demoLoading(then: () => void): void {
        console.info('[DemoHome] loading 快关（应看不见字）');
        gm.ui.loadingShow('demo-fast');
        gm.ui.loadingHide('demo-fast');
        console.info('[DemoHome] loading 慢关（约 1.5s 后应看见字）');
        gm.ui.loadingShow('demo-slow');
        setTimeout(() => {
            gm.ui.loadingHide('demo-slow');
            console.info('[DemoHome] loading 慢关结束');
            then();
        }, 2500);
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
