import { _decorator, assetManager, Node, Prefab, Sprite, SpriteFrame, UITransform } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { GMLayer } from './GMLayer';
import { gu } from '../launch/GMLauncher';
import { applySkin } from './GMSkin';
import { PfGMBtn, PfGMBtnSize, PfGMBtnStyle, PfGMBtnTheme } from './PfGMBtn';
import { PfGMTitle } from './PfGMTitle';

const { ccclass } = _decorator;

const editing = EDITOR && !PREVIEW;

/** 铆钉在标题条垂直正中。面板棕色框中线约在外沿往里 7（源图木色带 6–23，显示尺寸减半） */
export const FRAME_EDGE = 7;
const TITLE_H = 85; // PfGMTitle 中档高
const PAD = 24; // 内容距左右、底边，以及标题下沿
const FRAME_INNER = 20; // panel 九宫格上边（显示尺寸）。没标题时内容从这里起
const SIDE = 15; // 钮中心距左右边缘

/**
 * 普通弹窗骨架。子类只写和默认不同的字段，标题用 setTitle，左上角用 setLeft。
 * 确认框不走这套。
 */
@ccclass('GMFrame')
export class GMFrame extends GMLayer {
    width = 620;
    height = 800;
    showTitle = true; // 显式关掉才没有标题条
    showClose = true; // 默认点了关自己
    showPlate = true; // 底框。关掉仍留遮罩
    protected body: Node | null = null;

    private titleText = '';
    private titleView: PfGMTitle | null = null;
    private leftCb: (() => void) | null = null;
    private leftIcon: SpriteFrame | null = null; // null 表示用 icon_help
    private leftBtn: PfGMBtn | null = null;
    private btnPrefab: Prefab | null = null;

    /** 换标题字。不要标题时设 showTitle = false，不是靠不调用这里 */
    setTitle(text: string): void {
        this.titleText = text;
        this.titleView?.setText(text);
    }

    /** 传入回调才出现左上角。icon 不传则用 icon_help */
    setLeft(cb: () => void, icon?: SpriteFrame | null): void {
        this.leftCb = cb;
        this.leftIcon = icon ?? null;
        if (this.leftBtn) {
            this.dressLeft(this.leftBtn);
            if (!editing) gu.addClick(this.leftBtn.node, cb);
        } else if (this.btnPrefab && this.panel) this.makeLeft(this.btnPrefab);
    }

    /** 子类在这里填内容和标题。开关、尺寸用字段，在这之前已经生效 */
    protected onLayerInit(): void {}

    protected close(): void {
        gu.closeLayer(this.node.name);
    }

    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        this.layout(panel);
        this.onLayerInit();
        this.loadChrome(panel);
    }

    private edgeY(): number {
        return this.height / 2 - FRAME_EDGE;
    }

    private layout(panel: Node): void {
        const uit = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        uit.setContentSize(this.width, this.height);
        this.layoutPlate(panel, uit);
        this.layoutBody(panel);
    }

    private layoutPlate(panel: Node, uit: UITransform): void {
        let plate = panel.getComponent(Sprite);
        if (!this.showPlate) {
            if (plate) plate.enabled = false;
            return;
        }
        if (!plate) plate = panel.addComponent(Sprite);
        plate.enabled = true;
        plate.sizeMode = Sprite.SizeMode.CUSTOM;
        plate.type = Sprite.Type.SLICED;
        applySkin('panel', (frame) => {
            if (!plate.isValid) return;
            plate.spriteFrame = frame;
            plate.sizeMode = Sprite.SizeMode.CUSTOM;
            plate.type = Sprite.Type.SLICED;
            uit.setContentSize(this.width, this.height);
        });
    }

    private layoutBody(panel: Node): void {
        let body = panel.getChildByName('body');
        if (!body) {
            body = new Node('body');
            body.layer = panel.layer;
            panel.addChild(body);
        }
        const topInset = this.showTitle ? FRAME_EDGE + TITLE_H / 2 + PAD : FRAME_INNER;
        const top = this.height / 2 - topInset;
        const bottom = -this.height / 2 + PAD;
        const uit = body.getComponent(UITransform) ?? body.addComponent(UITransform);
        uit.setAnchorPoint(0.5, 0.5);
        uit.setContentSize(this.width - PAD * 2, top - bottom);
        body.setPosition(0, (top + bottom) / 2, 0);
        this.body = body;
    }

    private loadChrome(panel: Node): void {
        const needTitle = this.showTitle;
        const needBtn = this.showClose || this.leftCb !== null;
        if (!needTitle && !needBtn) {
            this.hide('title');
            this.hide('btnClose');
            this.hide('btnLeft');
            return;
        }
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[GMFrame] 没有 GMUI');
        const names: string[] = [];
        if (needTitle) names.push('PfGMTitle');
        if (needBtn) names.push('PfGMBtn');
        const got: Record<string, Prefab> = {};
        let left = names.length;
        for (const name of names) {
            bundle.load(name, Prefab, (err, prefab) => {
                if (err || !prefab) return console.error('[GMFrame] 加载失败', name, err);
                got[name] = prefab;
                if (--left > 0 || !panel.isValid) return;
                this.buildChrome(got);
            });
        }
    }

    private buildChrome(got: Record<string, Prefab>): void {
        const panel = this.panel;
        if (!panel?.isValid) return;
        if (!this.showTitle) this.hide('title');
        else if (got.PfGMTitle) this.makeTitle(got.PfGMTitle);
        if (!this.showClose) this.hide('btnClose');
        else if (got.PfGMBtn) this.makeClose(got.PfGMBtn);
        if (got.PfGMBtn) {
            this.btnPrefab = got.PfGMBtn;
            if (this.leftCb) this.makeLeft(got.PfGMBtn);
            else this.hide('btnLeft');
        }
    }

    private hide(name: string): void {
        const node = this.panel?.getChildByName(name);
        if (node) node.active = false;
    }

    private makeTitle(prefab: Prefab): void {
        const panel = this.panel;
        if (!panel) return;
        let view = panel.getChildByName('title')?.getComponent(PfGMTitle) ?? null;
        if (!view) {
            const ts = gu.createTs(prefab, { parent: panel, x: 0, y: this.edgeY() });
            if (!(ts instanceof PfGMTitle)) return console.error('[GMFrame] 标题没有挂上');
            ts.node.name = 'title';
            view = ts;
        } else {
            view.node.active = true;
            view.node.setPosition(0, this.edgeY(), 0);
        }
        this.titleView = view;
        view.setText(this.titleText);
    }

    private makeClose(prefab: Prefab): void {
        this.makeIconBtn(prefab, 'btnClose', this.width / 2 - SIDE, 'icon_close', null, () => this.close());
    }

    private makeLeft(prefab: Prefab): void {
        const cb = this.leftCb;
        if (!cb) return;
        const btn = this.makeIconBtn(prefab, 'btnLeft', -this.width / 2 + SIDE, null, this.leftIcon, cb);
        if (btn) this.leftBtn = btn;
        if (btn && !this.leftIcon) this.dressLeft(btn);
    }

    private dressLeft(btn: PfGMBtn): void {
        if (this.leftIcon) btn.setIcon(this.leftIcon);
        else applySkin('icon_help', (frame) => { if (btn.isValid) btn.setIcon(frame); });
    }

    private makeIconBtn(prefab: Prefab, name: string, x: number, skin: string | null, icon: SpriteFrame | null, cb: () => void): PfGMBtn | null {
        const panel = this.panel;
        if (!panel) return null;
        let btn = panel.getChildByName(name)?.getComponent(PfGMBtn) ?? null;
        if (!btn) {
            const ts = gu.createTs(prefab, { parent: panel, x, y: this.edgeY() });
            if (!(ts instanceof PfGMBtn)) return console.error('[GMFrame] 按钮没有挂上', name), null;
            ts.node.name = name;
            btn = ts;
        } else {
            btn.node.active = true;
            btn.node.setPosition(x, this.edgeY(), 0);
        }
        btn.setSize(PfGMBtnSize.medium);
        btn.setTheme(PfGMBtnTheme.secondary);
        btn.setStyle(PfGMBtnStyle.icon);
        btn.setText('');
        if (icon) btn.setIcon(icon);
        else if (skin) applySkin(skin, (frame) => { if (btn.isValid) btn.setIcon(frame); });
        if (!editing) gu.addClick(btn.node, cb);
        return btn;
    }
}
