import { _decorator, Node, Sprite, UITransform } from 'cc';
import { GMScene, gu, PfGMTabs } from 'db://gmajor/index';
import { addPaper } from '../../GameUI/SkinKit';
import { PfDemoTabPage } from './PfDemoTabPage';

const { ccclass } = _decorator;

/** 首页。节点在 ScDemoHome.scene 的 Canvas/home 里，这里只铺底和注册点击 */
@ccclass('ScDemoHome')
export class ScDemoHome extends GMScene {
    private tabsRoot: Node | null = null;

    onInit(): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) return console.error('[ScDemoHome] 没有 Canvas');
        addPaper(canvas);
        const home = canvas.getChildByName('home');
        if (!home) return console.error('[ScDemoHome] 没有 home');
        this.click(home, 'btnStart', () => gu.alert({ content: '今天先从这里开始。', cancel: {} }));
        this.click(home, 'btnAd', () => gu.alert({ content: '看完可以领一份奖励。', ok: { text: '领取' } }));
        this.click(home, 'btnGold', () => gu.alert('用金币买下这一格。'));
        this.click(home, 'btnDiamond', () => gu.alert('用钻石买下这一格。'));
        this.click(home, 'btnSetting', () => this.openSetting());
        this.click(home, 'tabSetting', () => this.openSetting());
        this.click(home, 'tabHome', () => this.toggleTabs(home));
    }

    private click(parent: Node, name: string, fn: () => void): void {
        const node = parent.getChildByName(name);
        if (!node) return console.error('[ScDemoHome] 没有', name);
        gu.addClick(node, fn);
    }

    private openSetting(): void {
        gu.showLayer('LySetting', { bundle: 'DemoHome' });
    }

    /** 再点一次关掉。记录页会等两秒 */
    private toggleTabs(home: Node): void {
        if (this.tabsRoot?.isValid) {
            this.tabsRoot.destroy();
            this.tabsRoot = null;
            return;
        }
        const root = new Node('PfGMTabs');
        root.layer = home.layer;
        home.addChild(root);
        root.setSiblingIndex(home.children.length - 1);
        root.setPosition(0, -160, 0);
        const uit = root.addComponent(UITransform);
        uit.setAnchorPoint(0.5, 0.5);
        uit.setContentSize(640, 480);
        const panel = new Node('panel');
        panel.layer = root.layer;
        root.addChild(panel);
        panel.addComponent(UITransform);
        panel.addComponent(Sprite);
        const tabs = new Node('tabs');
        tabs.layer = root.layer;
        root.addChild(tabs);
        tabs.addComponent(UITransform);
        const view = root.addComponent(PfGMTabs);
        for (const title of ['概况', '背包', '记录']) {
            const node = new Node(title);
            node.layer = root.layer;
            const page = node.addComponent(PfDemoTabPage);
            page.text = title;
            view.insert(node);
        }
        view.setOnChange((index) => console.info('[ScDemoHome] 页签', index));
        view.setIndex(0);
        this.tabsRoot = root;
    }
}
