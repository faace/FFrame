import { _decorator, Label, Node, UITransform } from 'cc';
import { GMFrame, gu, PfGMBar, PfGMBtn, PfGMCheck, PfGMItemCell, PfGMSlider, PfGMStepper, PfGMSwitch, PfGMTabs } from 'db://gmajor/index';
import { loadSkin } from '../../GameUI/SkinKit';

const { ccclass } = _decorator;

/** 页节点名与页签标题。节点在预制体里是 panel 的子节点，运行时收进页签 */
const PAGES: Array<[string, string]> = [
    ['pageBtn', '按钮'],
    ['pagePick', '选择'],
    ['pageShow', '展示'],
];

/** 控件展示：三页平铺已完成的控件。尺寸与默认 620×800 不同 */
@ccclass('LyControls')
export class LyControls extends GMFrame {
    width = 640;
    height = 1120;
    private started = false;

    protected onLayerInit(): void {
        this.setTitle('控件展示');
    }

    /**
     * 收到 onStart 再做：页签组件的 onInit 比本脚本晚，
     * 它在 onInit 里会 clearMade 清空页面，提前 insert 会被清掉。
     */
    onStart(): void {
        if (this.started) return;
        this.started = true;
        const panel = this.panel;
        if (!panel) return console.error('[LyControls] 没有 panel');
        // 页面先抓住：insert 会把它们挪进页签，之后在 panel 下就找不到了
        const pages: Node[] = [];
        for (const [name] of PAGES) {
            const page = panel.getChildByName(name);
            if (!page) console.error('[LyControls] 没有页面', name);
            else pages.push(page);
        }
        this.bindButtons(pages[0]);
        this.bindPicks(pages[1]);
        this.bindShow(pages[2]);
        this.bindTabs(panel, pages);
        loadSkin((err) => {
            if (err) return console.error('[LyControls] 皮加载失败', err);
        });
    }

    /** 尺寸按骨架的 body 走，再把三页交给页签收编 */
    private bindTabs(panel: Node, pages: Node[]): void {
        const ts = panel.getChildByName('tabs')?.getComponent(PfGMTabs) ?? null;
        if (!ts) return console.error('[LyControls] 没有页签');
        const uit = this.body?.getComponent(UITransform) ?? null;
        const width = uit?.width ?? 592;
        const height = uit?.height ?? 1021;
        ts.node.getComponent(UITransform)?.setContentSize(width, height);
        ts.node.setPosition(0, this.body?.position.y ?? 0, 0);
        for (let i = 0; i < pages.length; i++) ts.insert(pages[i], PAGES[i][1]);
        ts.setIndex(0);
    }

    /** 按钮自己带着主题名，点一下把它写进页面底部的说明行，不弹窗 */
    private bindButtons(page: Node | undefined): void {
        if (!page) return;
        const result = page.getChildByName('result')?.getComponent(Label) ?? null;
        for (const child of page.children) {
            const btn = child.getComponent(PfGMBtn);
            if (!btn) continue;
            if (child.name === 'btnMediumOff') {
                btn.setEnabled(false);
                gu.addClick(child, () => console.error('[LyControls] 禁用钮不应进回调', child.name));
                continue;
            }
            gu.addClick(child, () => {
                if (!result) return;
                result.string = `点了 ${btn.text || child.name}　主题 ${btn.theme}　版式 ${btn.style}　档位 ${btn.size}`;
            });
        }
    }

    /** 滑条自己听拖动；步进的加减、开关和勾选都由这里注册 */
    private bindPicks(page: Node | undefined): void {
        if (!page) return;
        const slider = page.getChildByName('ctlSlider')?.getComponent(PfGMSlider) ?? null;
        if (!slider) console.error('[LyControls] 没有滑条');

        const stepperRoot = page.getChildByName('ctlStepper');
        const stepper = stepperRoot?.getComponent(PfGMStepper) ?? null;
        const minus = stepperRoot?.getChildByName('btnMinus');
        const plus = stepperRoot?.getChildByName('btnPlus');
        if (stepper && minus && plus) {
            gu.addClick(minus, () => stepper.setValue(stepper.value - stepper.step));
            gu.addClick(plus, () => stepper.setValue(stepper.value + stepper.step));
        } else console.error('[LyControls] 步进缺少节点');

        const sw = page.getChildByName('ctlSwitch')?.getComponent(PfGMSwitch) ?? null;
        if (sw) gu.addClick(sw.node, () => sw.setValue(!sw.value));
        else console.error('[LyControls] 没有开关');

        const check = page.getChildByName('ctlCheck')?.getComponent(PfGMCheck) ?? null;
        if (check) gu.addClick(check.node, () => check.setValue(!check.value));
        else console.error('[LyControls] 没有勾选框');
    }

    /** 进度条加减各 0.25；道具格四格都能点，各自切换选中框 */
    private bindShow(page: Node | undefined): void {
        if (!page) return;
        const bar = page.getChildByName('bar')?.getComponent(PfGMBar) ?? null;
        const plus = page.getChildByName('barPlus');
        const minus = page.getChildByName('barMinus');
        if (!bar || !plus || !minus) console.error('[LyControls] 进度条缺少节点');
        else {
            gu.addClick(plus, () => bar.setValue(Math.min(1, bar.value + 0.25)));
            gu.addClick(minus, () => bar.setValue(Math.max(0, bar.value - 0.25)));
        }
        for (const child of page.children) {
            const cell = child.getComponent(PfGMItemCell);
            if (!cell) continue;
            gu.addClick(child, () => cell.setSelected(!cell.selected));
        }
    }
}
