import { _decorator, Label, Node } from 'cc';
import { GMLayer } from './GMLayer';
import { gu } from '../launch/GMLauncher';

const { ccclass } = _decorator;

export type GMAlertInit = {
    content: string;
    okText: string;
    cancelText: string;
    showCancel: boolean;
    onOk?: () => void;
    onCancel?: () => void;
    close: () => void;
};

/** 确认框基类：按节点名填字/点按；皮由本游戏预制体提供（缺节点时由子类 onInit 画） */
@ccclass('GMAlert')
export class GMAlert extends GMLayer {
    protected body: Label | null = null;
    protected okLabel: Label | null = null;
    protected cancelLabel: Label | null = null;
    protected btnOk: Node | null = null;
    protected btnCancel: Node | null = null;
    private onOk: (() => void) | undefined;
    private onCancel: (() => void) | undefined;
    private close: (() => void) | undefined;

    protected bindAlertNodes(): void { // 约定：panel 下 body / btnOk / btnCancel
        const panel = this.panel;
        if (!panel) return;
        this.body = panel.getChildByName('body')?.getComponent(Label) ?? this.body;
        this.btnOk = panel.getChildByName('btnOk') ?? this.btnOk;
        this.btnCancel = panel.getChildByName('btnCancel') ?? this.btnCancel;
        this.okLabel = this.btnOk?.getChildByName('label')?.getComponent(Label) ?? this.btnOk?.getComponent(Label) ?? this.okLabel;
        this.cancelLabel = this.btnCancel?.getChildByName('label')?.getComponent(Label) ?? this.btnCancel?.getComponent(Label) ?? this.cancelLabel;
    }

    init(parm?: GMAlertInit): void {
        if (!parm) return;
        this.bindAlertNodes();
        if (this.body) this.body.string = parm.content;
        if (this.okLabel) this.okLabel.string = parm.okText;
        if (this.cancelLabel) this.cancelLabel.string = parm.cancelText;
        this.onOk = parm.onOk;
        this.onCancel = parm.onCancel;
        this.close = parm.close;
        if (this.btnCancel) this.btnCancel.active = parm.showCancel;
        if (this.btnOk) {
            if (parm.showCancel === false) this.btnOk.setPosition(0, this.btnOk.position.y, 0);
            gu.addClick(this.btnOk, () => { this.onOk?.(); this.close?.(); });
        }
        if (parm.showCancel && this.btnCancel) {
            gu.addClick(this.btnCancel, () => { this.onCancel?.(); this.close?.(); });
        }
    }
}
