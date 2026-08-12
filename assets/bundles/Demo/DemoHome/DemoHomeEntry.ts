import { find, Node } from 'cc';
import { FFBindContext, FFBundleEntryBase, registerBundleEntry } from '../../../fframe';
import { PfDemoPanel } from './PfDemoPanel';

/** 示范功能：嵌套绑定 DemoChild + 挂一个 FFComponent UI */
class DemoHomeEntry extends FFBundleEntryBase {
    private panelNode: Node | null = null;

    constructor() {
        super('DemoHome');
    }

    async onLoad(): Promise<void> {
        console.log('[DemoHome] onLoad');
    }

    async onBind(ctx: FFBindContext): Promise<void> {
        console.log('[DemoHome] onBind', ctx.bindPath.join('/'));
        this.on('BindReady');
        this.mountDemoPanel(); // 先挂 UI，才能收到后续 BindReady
        await ctx.bindChild('DemoChild');
    }

    onBindReady(e: { data?: unknown }): void {
        console.info('[DemoHome] 事件 BindReady', e.data);
    }

    async start(): Promise<void> {
        console.log('[DemoHome] start (Ready)');
    }

    async onUnbind(): Promise<void> {
        console.log('[DemoHome] onUnbind');
        this.unmountDemoPanel();
    }

    async onDestroy(): Promise<void> {
        console.log('[DemoHome] onDestroy');
    }

    private mountDemoPanel(): void {
        const canvas = find('Canvas');
        if (!canvas) return console.warn('[DemoHome] 未找到 Canvas，跳过 PfDemoPanel');
        const node = new Node('PfDemoPanel');
        node.addComponent(PfDemoPanel);
        canvas.addChild(node);
        this.panelNode = node;
        console.info('[DemoHome] 已挂 PfDemoPanel（FFComponent）');
    }

    private unmountDemoPanel(): void {
        if (!this.panelNode?.isValid) {
            this.panelNode = null;
            return;
        }
        this.panelNode.destroy();
        this.panelNode = null;
    }
}

registerBundleEntry('DemoHome', new DemoHomeEntry());
