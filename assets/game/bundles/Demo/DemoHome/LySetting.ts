import { _decorator, assetManager, Node, Prefab, UITransform } from 'cc';
import { FRAME_EDGE, GMLayer, gu, PfGMBar, PfGMBarText, PfGMBtn, PfGMCheck, PfGMItemCell, PfGMStepper, PfGMSwitch, PfGMTitle, PfGMTitleSize } from 'db://gmajor/index';
import { addSkin, addText, dress, loadSkin, skinInk } from '../../GameUI/SkinKit';

const { ccclass } = _decorator;

/** 设置：音量、经验条、步进、道具格、开关和勾选，用 v7 皮 */
@ccclass('LySetting')
export class LySetting extends GMLayer {
    private readonly skins: Array<[Node, string]> = [];

    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        this.alignTitle();
        const plate = this.put(panel, 'panel', 0, 0, 600, 760);
        plate.setSiblingIndex(0); // 背板垫在预制体里的标题和按钮下面
        const close = panel.getChildByName('btnClose');
        const help = panel.getChildByName('btnHelp');
        if (close) gu.addClick(close, () => gu.closeLayer('LySetting'));
        if (help) gu.addClick(help, () => gu.alert('音乐、音效和语言都记在本机。'));
        this.caption(panel, 'icon_music', '音乐', 200);
        this.caption(panel, 'icon_sfx', '音效', 110);
        addText(panel, '经验', 22, skinInk, 80, 36).node.setPosition(-172, 16, 0);
        this.put(panel, 'icon_settings', -220, -80, 56, 56);
        addText(panel, '语言  中文', 26, skinInk, 220, 48).node.setPosition(20, -80, 0);
        this.bindBar(panel);
        this.bindStepper(panel);
        this.slot(panel, -312);
        this.bindSwitch(panel);
        this.bindCheck(panel);
        loadSkin((err) => {
            if (err) return console.error('[LySetting] 皮加载失败', err);
            for (const [node, name] of this.skins) dress(node, name);
        });
    }

    /** 标题铆钉、关闭钮和帮助钮压在面板棕色顶边上 */
    private alignTitle(): void {
        const panel = this.panel;
        const uit = panel?.getComponent(UITransform);
        if (!panel || !uit) return;
        const y = uit.height / 2 - FRAME_EDGE;
        panel.getChildByName('title')?.getComponent(PfGMTitle)?.setSize(PfGMTitleSize.small);
        for (const name of ['title', 'btnClose', 'btnHelp']) {
            const node = panel.getChildByName(name);
            if (node) node.setPosition(node.position.x, y, node.position.z);
        }
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
        const plus = panel.getChildByName('btnBar');
        const minus = panel.getChildByName('btnBarMinus');
        const mode = panel.getChildByName('btnBarText')?.getComponent(PfGMBtn) ?? null;
        if (!bar || !plus || !minus || !mode) return console.error('[LySetting] 进度条缺少调整按钮');
        gu.addClick(plus, () => bar.setValue(Math.min(1, bar.value + 0.25)));
        gu.addClick(minus, () => bar.setValue(Math.max(0, bar.value - 0.25)));
        gu.addClick(mode.node, () => this.cycleBarText(bar, mode));
    }

    private cycleBarText(bar: PfGMBar, btn: PfGMBtn): void {
        const modes = [PfGMBarText.off, PfGMBarText.percent, PfGMBarText.ratio];
        const names = ['不显示', '百分比', '当前/总值'];
        const next = modes[(modes.indexOf(bar.text) + 1) % modes.length];
        if (next === PfGMBarText.ratio) bar.setRatio(Math.round(bar.value * 4), 4);
        bar.setText(next);
        btn.setText(names[modes.indexOf(next)] ?? '不显示');
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
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LySetting] 没有 GMUI');
        bundle.load('PfGMItemCell', Prefab, (err, prefab) => {
            if (err || !prefab) return console.error('[LySetting] 道具格加载失败', err);
            if (!parent.isValid) return;
            const star = gu.createTs(prefab, { parent, x: -180, y });
            const gold = gu.createTs(prefab, { parent, x: -50, y });
            const diamond = gu.createTs(prefab, { parent, x: 80, y });
            const chest = gu.createTs(prefab, { parent, x: 210, y });
            if (!(star instanceof PfGMItemCell && gold instanceof PfGMItemCell && diamond instanceof PfGMItemCell && chest instanceof PfGMItemCell)) return console.error('[LySetting] 道具格没有挂上');
            star.setIcon('icon_star');
            star.setCount(999);
            gold.setIcon('icon_gold');
            gold.setCount(12);
            diamond.setIcon('icon_diamond');
            diamond.setSelected(true);
            diamond.setCount(3);
            chest.setIcon('icon_chest');
            chest.setCount(1000);
        });
    }

    /** 演示页自己注册点击，控件不包点击 */
    private bindSwitch(panel: Node): void {
        const sw = panel.getChildByName('switch')?.getComponent(PfGMSwitch) ?? null;
        if (!sw) return console.error('[LySetting] 没有开关');
        addText(panel, '开关', 24, skinInk, 80, 40).node.setPosition(-76, -230, 0);
        gu.addClick(sw.node, () => sw.setValue(!sw.value));
    }

    private bindCheck(panel: Node): void {
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LySetting] 没有 GMUI');
        bundle.load('PfGMCheck', Prefab, (err, prefab) => {
            if (err || !prefab) return console.error('[LySetting] 勾选框加载失败', err);
            if (!panel.isValid) return;
            const check = gu.createTs(prefab, { parent: panel, x: 80, y: -230 });
            if (!(check instanceof PfGMCheck)) return console.error('[LySetting] 勾选框没有挂上');
            addText(panel, '勾选', 24, skinInk, 72, 40).node.setPosition(156, -230, 0);
            gu.addClick(check.node, () => check.setValue(!check.value));
        });
    }
}
