import { _decorator, assetManager, Node, Prefab, Sprite, UITransform } from 'cc';
import { applySkin, GMLayer, gu, PfGMBtn, PfGMBtnSize, PfGMBtnStyle, PfGMBtnTheme, PfGMTabs, PfGMTitle } from 'db://gmajor/index';
import { PfDemoTabPage } from './PfDemoTabPage';

const { ccclass } = _decorator;

const PANEL_W = 640;
const PANEL_H = 480;
const TABS_W = 600;
const TABS_H = 380;

/** 页签例子。三页：概况、背包、记录 */
@ccclass('LyTabs')
export class LyTabs extends GMLayer {
    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        const uit = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        uit.setContentSize(PANEL_W, PANEL_H);
        const plate = panel.getComponent(Sprite) ?? panel.addComponent(Sprite);
        plate.sizeMode = Sprite.SizeMode.CUSTOM;
        plate.type = Sprite.Type.SLICED;
        applySkin('panel', (frame) => {
            if (!plate.isValid) return;
            plate.spriteFrame = frame;
            plate.sizeMode = Sprite.SizeMode.CUSTOM;
            plate.type = Sprite.Type.SLICED;
            uit.setContentSize(PANEL_W, PANEL_H);
        });
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LyTabs] 没有 GMUI');
        const names = ['PfGMTitle', 'PfGMBtn', 'PfGMTabs'];
        const got: Record<string, Prefab> = {};
        let left = names.length;
        for (const name of names) {
            bundle.load(name, Prefab, (err, prefab) => {
                if (err || !prefab) return console.error('[LyTabs] 加载失败', name, err);
                got[name] = prefab;
                if (--left === 0 && panel.isValid) this.build(panel, got);
            });
        }
    }

    private build(panel: Node, got: Record<string, Prefab>): void {
        const title = gu.createTs(got.PfGMTitle, { parent: panel, x: 0, y: PANEL_H / 2 - 15 });
        if (title instanceof PfGMTitle) title.setText('页签');
        const close = gu.createTs(got.PfGMBtn, { parent: panel, x: PANEL_W / 2 - 15, y: PANEL_H / 2 - 15 });
        if (close instanceof PfGMBtn) {
            close.setSize(PfGMBtnSize.medium);
            close.setTheme(PfGMBtnTheme.secondary);
            close.setStyle(PfGMBtnStyle.icon);
            close.setText('');
            applySkin('icon_close', (frame) => { if (close.isValid) close.setIcon(frame); });
            gu.addClick(close.node, () => gu.closeLayer('LyTabs'));
        }
        const tabs = gu.createTs(got.PfGMTabs, { parent: panel, x: 0, y: PANEL_H / 2 - 57.5 - 8 - TABS_H / 2 }); // 整块放在标题下面，留一条缝
        if (!(tabs instanceof PfGMTabs)) return console.error('[LyTabs] 页签控件没有挂上');
        tabs.node.getComponent(UITransform)?.setContentSize(TABS_W, TABS_H);
        for (const text of ['概况', '背包', '记录']) {
            const node = new Node(text);
            node.layer = panel.layer;
            const page = node.addComponent(PfDemoTabPage);
            page.text = text;
            tabs.insert(node);
        }
        tabs.setIndex(0);
    }
}
