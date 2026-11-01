import { _decorator, UITransform } from 'cc';
import { FRAME_EDGE, GMAlert, PfGMBtn, gu, type GMAlertInit } from 'db://gmajor/index';
import { loadSkin, redress } from './SkinKit';

const { ccclass } = _decorator;

/** 确认框。节点在预制体里，这里只改文案，并把关闭钮接到取消 */
@ccclass('LyAlert')
export class LyAlert extends GMAlert {
    onInit(): void {
        console.info('[LyAlert] onInit');
        this.alignTitle();
    }

    /** 标题和关闭钮与普通弹窗同一条棕色边。其余布局不动 */
    private alignTitle(): void {
        const panel = this.panel;
        const uit = panel?.getComponent(UITransform);
        if (!panel || !uit) return;
        const y = uit.height / 2 - FRAME_EDGE;
        const title = panel.getChildByName('title');
        const close = panel.getChildByName('btnClose');
        if (title) title.setPosition(title.position.x, y, title.position.z);
        if (close) close.setPosition(close.position.x, y, close.position.z);
    }

    init(parm?: GMAlertInit): void {
        super.init(parm);
        if (!parm) return;
        this.panel?.getChildByName('btnOk')?.getComponent(PfGMBtn)?.setText(parm.okText);
        if (parm.showCancel) this.panel?.getChildByName('btnCancel')?.getComponent(PfGMBtn)?.setText(parm.cancelText);
        const closeBtn = this.panel?.getChildByName('btnClose');
        if (parm.showClose && closeBtn) gu.addClick(closeBtn, () => { parm.onCancel?.(); parm.close(); });
        loadSkin((err) => {
            if (err) return console.error('[LyAlert] 皮加载失败', err);
            if (this.node.isValid) redress(this.node);
        });
    }

    onRemove(): void {
        console.info('[LyAlert] onRemove');
    }
}
