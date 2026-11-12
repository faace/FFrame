import { _decorator, Label, Node, UITransform } from 'cc';
import { GMFrame, GMOptionItem, gu, PfGMBar, PfGMBtn, PfGMCheck, PfGMItemCell, PfGMSelect, PfGMSlider, PfGMStepper, PfGMSwitch, PfGMTabs } from 'db://gmajor/index';
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
    private pickPage: Node | null = null; // 选择页。insert 后不在 panel 下了，留引用给回调写字
    private noteView: Label | null = null;

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
        this.pickPage = pages[1] ?? null;
        this.noteView = pages[1]?.getChildByName('pickNote')?.getComponent(Label) ?? null;
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

    /** 滑条自己听拖动；步进的加减、开关、勾选和四个下拉都由这里注册 */
    private bindPicks(page: Node | undefined): void {
        if (!page) return;
        const slider = page.getChildByName('ctlSlider')?.getComponent(PfGMSlider) ?? null;
        if (slider) slider.setOnChange((v) => this.note(`滑条 → ${v.toFixed(2)}`));
        else console.error('[LyControls] 没有滑条');

        const stepperRoot = page.getChildByName('ctlStepper');
        const stepper = stepperRoot?.getComponent(PfGMStepper) ?? null;
        const minus = stepperRoot?.getChildByName('btnMinus');
        const plus = stepperRoot?.getChildByName('btnPlus');
        if (stepper && minus && plus) {
            stepper.setOnChange((v) => this.note(`步进 → ${v}`));
            gu.addClick(minus, () => stepper.stepBy(-stepper.step));
            gu.addClick(plus, () => stepper.stepBy(stepper.step));
        } else console.error('[LyControls] 步进缺少节点');

        const sw = page.getChildByName('ctlSwitch')?.getComponent(PfGMSwitch) ?? null;
        if (sw) {
            sw.setOnChange((v) => this.note(`开关 → ${v ? '开' : '关'}`));
            gu.addClick(sw.node, () => sw.toggle());
        } else console.error('[LyControls] 没有开关');

        const check = page.getChildByName('ctlCheck')?.getComponent(PfGMCheck) ?? null;
        if (check) {
            check.setOnChange((v) => this.note(`勾选 → ${v ? '勾上' : '取消'}`));
            gu.addClick(check.node, () => check.toggle());
        } else console.error('[LyControls] 没有勾选框');

        this.bindSelect(page.getChildByName('ctlSelectText')?.getComponent(PfGMSelect) ?? null,
            [this.option('简单'), this.option('普通'), this.option('困难')], 1, '下拉');
        this.bindSelect(page.getChildByName('ctlSelectIcon')?.getComponent(PfGMSelect) ?? null, [
            this.option('星星', 'icon_star'),
            this.option('金币', 'icon_gold'),
            this.option('钻石', 'icon_diamond'),
        ], 0, '物品');
        this.bindSelect(page.getChildByName('ctlSelectUp')?.getComponent(PfGMSelect) ?? null,
            [this.option('上'), this.option('中'), this.option('下')], 2, '向上');

        const many: GMOptionItem[] = []; // 50 项：验滚动和长列表，放页面顶部必然向下弹
        for (let i = 1; i <= 50; i++) many.push(this.option(`选项 ${i}`));
        this.bindSelect(page.getChildByName('ctlSelectMany')?.getComponent(PfGMSelect) ?? null, many, 0, '50 项');
    }

    /** 造一项。检查器里是 GMOptionItem，代码里也用它，别用裸对象 */
    private option(text: string, icon = ''): GMOptionItem {
        const item = new GMOptionItem();
        item.text = text;
        item.icon = icon;
        return item;
    }

    /** 下拉：选项在代码里给，盒子点击由这里注册，点选结果写进说明行 */
    private bindSelect(sel: PfGMSelect | null, items: GMOptionItem[], index: number, tag: string): void {
        if (!sel) return console.error('[LyControls] 没有下拉框', tag);
        sel.setItems(items);
        sel.setIndex(index);
        sel.setOnChange((at) => this.note(`${tag} → ${items[at]?.text ?? at}`));
        gu.addClick(sel.node, () => sel.toggle());
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

    /** 选择页的回调结果写到页面底部，不弹窗 */
    private note(text: string): void {
        if (this.noteView?.isValid) this.noteView.string = text;
    }
}
