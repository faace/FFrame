import { _decorator } from 'cc';
import { GMLayer, gu } from 'db://gmajor/index';
import { loadSkin, redress } from '../../GameUI/SkinKit';

const { ccclass } = _decorator;

/** 按钮和弹窗展示。主题钮弹出主题名；大小钮对应确认框的弹法，含无标题、无关闭 */
@ccclass('LyButtons')
export class LyButtons extends GMLayer {
    onInit(): void {
        const panel = this.panel;
        if (!panel) return;
        const close = panel.getChildByName('btnClose');
        if (close) gu.addClick(close, () => gu.closeLayer('LyButtons'));
        this.click('btnPrimary', () => gu.alert('主色'));
        this.click('btnSecondary', () => gu.alert('次要'));
        this.click('btnWarning', () => gu.alert('醒目'));
        this.click('btnNeutral', () => gu.alert('中性'));
        this.click('btnInfo', () => gu.alert('信息'));
        this.click('btnLarge', () => gu.alert('仅确定'));
        this.click('btnSmall', () => gu.alert({ content: '带取消', cancel: {} }));
        this.click('btnNoTitle', () => gu.alert({ content: '无标题', showTitle: false }));
        this.click('btnLargeIcon', () => gu.alert({ content: '改确定', ok: { text: '领取' } }));
        this.click('btnSmallIcon', () => gu.alert({ content: '改两边', ok: { text: '领取' }, cancel: { text: '稍后' } }));
        this.click('btnNoClose', () => gu.alert({ content: '无关闭', showClose: false }));
        loadSkin((err) => {
            if (err) return console.error('[LyButtons] 皮加载失败', err);
            if (panel.isValid) redress(panel);
        });
    }

    private click(name: string, fn: () => void): void {
        const node = this.panel?.getChildByName(name);
        if (!node) return console.error('[LyButtons] 没有', name);
        gu.addClick(node, fn);
    }
}
