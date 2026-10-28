import { _decorator, Node } from 'cc';
import { GMLayer, gu, PfGMBar, PfGMStepper } from 'db://gmajor/index';
import { addSkin, addText, dress, loadSkin, skinInk } from '../../GameUI/SkinKit';

const { ccclass } = _decorator;

/** 设置：音量、经验条、步进和道具格，用 v7 皮 */
@ccclass('LySetting')
export class LySetting extends GMLayer {
    private readonly skins: Array<[Node, string]> = [];

    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        const plate = this.put(panel, 'panel', 0, 0, 600, 760);
        plate.setSiblingIndex(0); // 背板垫在预制体里的标题和按钮下面
        const close = panel.getChildByName('btnClose');
        const help = panel.getChildByName('btnHelp');
        if (close) gu.addClick(close, () => gu.closeLayer('LySetting'));
        if (help) gu.addClick(help, () => gu.alert('音乐、音效和语言都记在本机。'));
        this.caption(panel, 'icon_music', '音乐', 200);
        this.caption(panel, 'icon_sfx', '音效', 110);
        addText(panel, '经验', 22, skinInk, 80, 36).node.setPosition(-220, 16, 0);
        this.put(panel, 'icon_settings', -220, -80, 56, 56);
        addText(panel, '语言  中文', 26, skinInk, 220, 48).node.setPosition(20, -80, 0);
        this.bindBar(panel);
        this.bindStepper(panel);
        this.slot(panel, -290);
        loadSkin((err) => {
            if (err) return console.error('[LySetting] 皮加载失败', err);
            for (const [node, name] of this.skins) dress(node, name);
        });
    }

    private put(parent: Node, name: string, x: number, y: number, w: number, h: number): Node {
        const node = addSkin(parent, name, x, y, w, h);
        this.skins.push([node, name]);
        return node;
    }

    private caption(parent: Node, icon: string, text: string, y: number): void {
        this.put(parent, icon, -230, y, 56, 56);
        addText(parent, text, 24, skinInk, 80, 40).node.setPosition(-150, y, 0);
    }

    private bindBar(panel: Node): void {
        const bar = panel.getChildByName('bar')?.getComponent(PfGMBar) ?? null;
        const btn = panel.getChildByName('btnBar');
        if (!bar || !btn) return console.error('[LySetting] 进度条缺少调整按钮');
        gu.addClick(btn, () => bar.setValue(bar.value >= 1 ? 0 : bar.value + 0.25));
    }

    private bindStepper(panel: Node): void {
        const root = panel.getChildByName('stepper');
        const stepper = root?.getComponent(PfGMStepper) ?? null;
        const minus = root?.getChildByName('btnMinus');
        const plus = root?.getChildByName('btnPlus');
        if (!stepper || !minus || !plus) return console.error('[LySetting] 步进预制体缺少按钮');
        gu.addClick(minus, () => stepper.setValue(stepper.value - stepper.step));
        gu.addClick(plus, () => stepper.setValue(stepper.value + stepper.step));
    }

    private slot(parent: Node, y: number): void {
        this.put(parent, 'slot_item', -50, y, 96, 96);
        this.put(parent, 'icon_gold', -50, y, 52, 52);
        this.put(parent, 'frame_select', 80, y, 108, 108);
        this.put(parent, 'icon_diamond', 80, y, 52, 52);
    }
}
