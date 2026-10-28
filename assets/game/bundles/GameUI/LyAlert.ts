import { _decorator } from 'cc';
import { GMAlert, PfGMBtn, gu, type GMAlertInit } from 'db://gmajor/index';

const { ccclass } = _decorator;

/** 确认框。节点在预制体里，这里只改文案，并把关闭钮接到取消 */
@ccclass('LyAlert')
export class LyAlert extends GMAlert {
    onInit(): void {
        console.info('[LyAlert] onInit');
    }

    init(parm?: GMAlertInit): void {
        super.init(parm);
        if (!parm) return;
        this.panel?.getChildByName('btnOk')?.getComponent(PfGMBtn)?.setText(parm.okText);
        if (parm.showCancel) this.panel?.getChildByName('btnCancel')?.getComponent(PfGMBtn)?.setText(parm.cancelText);
        const closeBtn = this.panel?.getChildByName('btnClose');
        if (closeBtn) gu.addClick(closeBtn, () => { parm.onCancel?.(); parm.close(); });
    }

    onRemove(): void {
        console.info('[LyAlert] onRemove');
    }
}
