import { _decorator, Node } from 'cc';
import { GMScene, gu } from 'db://gmajor/index';
import { addPaper, loadSkin } from '../../GameUI/SkinKit';

const { ccclass } = _decorator;

/** 首页。节点在 ScDemoHome.scene 的 Canvas/home 里，这里只铺底和注册点击 */
@ccclass('ScDemoHome')
export class ScDemoHome extends GMScene {
    onInit(): void {
        const canvas = this.node.scene?.getChildByName('Canvas');
        if (!canvas) return console.error('[ScDemoHome] 没有 Canvas');
        addPaper(canvas);
        const home = canvas.getChildByName('home');
        if (!home) return console.error('[ScDemoHome] 没有 home');
        this.click(home, 'btnStart', () => this.openSetting());
        this.click(home, 'btnAd', () => gu.alert({ content: '看完可以领一份奖励。', ok: { text: '领取' } }));
        this.click(home, 'btnGold', () => gu.showLayer('LyButtons', { bundle: 'DemoHome' }));
        this.click(home, 'btnDiamond', () => gu.alert('用钻石买下这一格。'));
        this.click(home, 'btnSetting', () => this.toggleTabs());
        loadSkin((err) => {
            if (err) return console.error('[ScDemoHome] 皮加载失败', err);
        });
    }

    private click(parent: Node, name: string, fn: () => void): void {
        const node = parent.getChildByName(name);
        if (!node) return console.error('[ScDemoHome] 没有', name);
        gu.addClick(node, fn);
    }

    private openSetting(): void {
        gu.showLayer('LySetting', { bundle: 'DemoHome' });
    }

    /** 最底下「页签设置」。开着再点一次关掉 */
    private toggleTabs(): void {
        const open = this.node.scene?.getChildByName('GMOverlay')?.getChildByName('layers')?.getChildByName('LyTabs');
        if (open?.isValid) gu.closeLayer('LyTabs');
        else gu.showLayer('LyTabs', { bundle: 'DemoHome' });
    }

}
