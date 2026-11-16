import { _decorator, assetManager, Color, Label, Node, Prefab, TTFFont, UITransform } from 'cc';
import { GMFrame, GMListDir, GMOptionItem, gu, PfGMBadge, PfGMBar, PfGMBtn, PfGMBtnSize, PfGMBtnStyle, PfGMBtnTheme, PfGMCheck, PfGMEditBox, PfGMItemCell, PfGMList, PfGMRadioGroup, PfGMSelect, PfGMSlider, PfGMStepper, PfGMSwitch, PfGMTabs } from 'db://gmajor/index';
import { loadSkin } from '../../GameUI/SkinKit';
import { PfControlPage } from './PfControlPage';
import { PfListDemoItem } from './PfListDemoItem';

const { ccclass } = _decorator;

/** 轻提示那三颗按钮、标题和结果行在展示页的 y。放在道具格那排下面 */
const TOAST_HEAD_Y = -212; // 标题「轻提示　PfGMToast」
const TOAST_ROW_Y = -280;
const TOAST_NOTE_Y = -330; // 比原来 -352 上提 22，给角标那行腾地方
const TOAST_BTN_X = 200; // 小档宽 180，三颗中心在 -200 / 0 / 200，相邻边距 20

/** 角标那两行在展示页的 y。挤在轻提示说明行和页底边之间 */
const BADGE_HEAD_Y = -376; // 标题「角标　PfGMBadge」
const BADGE_ROW_Y = -416; // 五颗示例

/** 角标五颗示例的 x。根固定 40×24 居中，按最大宽再留间隙 */
const BADGE_X = [-190, -100, -10, 80, 185];

/** 页节点名与页签标题。节点在预制体里是 panel 的子节点，运行时收进页签 */
const PAGES: Array<[string, string]> = [
    ['pageBtn', '按钮'],
    ['pagePick', '选择'],
    ['pageShow', '显示'],
];

/** 控件展示：三页平铺已完成的控件，再加一页空的「更多」。页签按三个字宽。尺寸与默认 620×800 不同 */
@ccclass('LyControls')
export class LyControls extends GMFrame {
    width = 640;
    height = 1120;
    private started = false;
    private pickPage: Node | null = null; // 选择页。insert 后不在 panel 下了，留引用给回调写字
    private noteView: Label | null = null;
    private listView: PfGMList | null = null;
    private listItem: Prefab | null = null;
    private listNote: Label | null = null;
    private listDir = GMListDir.vertical;
    private listLine = 1;
    private listCount = 30;
    private listCenter = false;

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

    /** 尺寸按骨架的 body 走，再把页面交给页签收编。字数设成 3，看窄页签 */
    private bindTabs(panel: Node, pages: Node[]): void {
        const ts = panel.getChildByName('tabs')?.getComponent(PfGMTabs) ?? null;
        if (!ts) return console.error('[LyControls] 没有页签');
        const uit = this.body?.getComponent(UITransform) ?? null;
        const width = uit?.width ?? 592;
        const height = uit?.height ?? 1021;
        ts.node.getComponent(UITransform)?.setContentSize(width, height);
        ts.node.setPosition(0, this.body?.position.y ?? 0, 0);
        ts.setChars(3);
        for (let i = 0; i < pages.length; i++) ts.insert(pages[i], PAGES[i][1]);
        const more = new Node('pageMore');
        more.layer = panel.layer;
        more.addComponent(PfControlPage);
        ts.insert(more, '更多');
        const panelUt = ts.node.getChildByName('panel')?.getComponent(UITransform) ?? null;
        const pageUt = more.getComponent(UITransform) ?? more.addComponent(UITransform);
        pageUt.setAnchorPoint(0.5, 0.5);
        if (panelUt) pageUt.setContentSize(panelUt.contentSize);
        ts.setIndex(0);
        this.bindList(more);
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

        const radio = page.getChildByName('ctlRadio')?.getComponent(PfGMRadioGroup) ?? null;
        if (radio) {
            const names = ['低', '中', '高'];
            radio.setOnChange((at) => this.note(`单选 → ${names[at] ?? at}`));
        } else console.error('[LyControls] 没有单选');

        this.bindSelect(page.getChildByName('ctlSelectDown')?.getComponent(PfGMSelect) ?? null, [
            this.option('星星', 'icon_star'),
            this.option('金币', 'icon_gold'),
            this.option('钻石', 'icon_diamond'),
            this.option('宝箱', 'icon_chest'),
            this.option('礼物', 'icon_gift'),
            this.option('钥匙', 'icon_key'),
            this.option('船票', 'icon_ticket'),
            this.option('奖杯', 'icon_trophy'),
            this.option('皇冠', 'icon_crown'),
            this.option('锁', 'icon_lock'),
            this.option('商店', 'icon_shop'),
            this.option('邮件', 'icon_mail'),
            this.option('背包', 'icon_bag'),
            this.option('地图', 'icon_map'),
            this.option('木头', 'icon_wood'),
            this.option('叶子', 'icon_leaf'),
            this.option('肉', 'icon_meat'),
            ...Array.from({ length: 33 }, (_, i) => this.option(`选项 ${i + 18}`)),
        ], 0, '向下');

        this.bindSelect(page.getChildByName('ctlSelectUp')?.getComponent(PfGMSelect) ?? null,
            [this.option('上'), this.option('中'), this.option('下')], 2, '向上');

        this.bindEditBox(page);
    }

    /** 输入框：打字时写一条，离开时写最终值。和上面几个控件共用页面底部那行说明 */
    private bindEditBox(page: Node): void {
        const edit = page.getChildByName('ctlInput')?.getComponent(PfGMEditBox) ?? null;
        if (!edit) return console.error('[LyControls] 没有输入框');
        edit.setOnChange((text) => this.note(text ? `输入中 → ${text}` : '输入中 → 空'));
        edit.setOnDone((text) => this.note(text ? `输入完 → ${text}` : '输入完 → 空'));
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
        this.bindToast(page);
        this.bindBadge(page);
    }

    /**
     * 角标五颗，全部静态不接收点击。第 2 颗开着动效，运行时一直在呼吸，
     * 是为了在网页上能直接看出 setAnim(true) 生效了。其余四颗：点、5、12、99+。
     * 节点运行时建：预制体里手写嵌套实例容易被 Creator 丢掉（轻提示那颗已踩过）。
     */
    private bindBadge(page: Node): void {
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LyControls] 没有 GMUI，角标建不出来');
        bundle.load('PfGMBadge', Prefab, (err, prefab) => {
            if (err || !prefab) return console.error('[LyControls] 角标预制体加载失败', err);
            if (!page.isValid) return;
            this.makeHead(page, BADGE_HEAD_Y, '角标　PfGMBadge');
            // 五种模式：点、点+动效、一位、两位、超上限
            const plan: Array<[(b: PfGMBadge) => void, string]> = [
                [(b) => b.setDot(), 'dot'],
                [(b) => { b.setDot(); b.setAnim(true); }, 'dotAnim'],
                [(b) => b.setCount(5), 'n5'],
                [(b) => b.setCount(12), 'n12'],
                [(b) => b.setCount(128), 'n99'],
            ];
            plan.forEach(([apply, name], i) => {
                const ts = gu.createTs(prefab, { parent: page, x: BADGE_X[i], y: BADGE_ROW_Y });
                if (!(ts instanceof PfGMBadge)) return console.error('[LyControls] 角标没挂上', name);
                ts.node.name = 'badge_' + name;
                apply(ts);
            });
        });
    }

    /** 建一行说明字。轻提示和角标各一行，同一套写法 */
    private makeHead(page: Node, y: number, text: string): Label | null {
        const node = new Node('head');
        node.layer = page.layer;
        page.addChild(node);
        node.setPosition(0, y, 0);
        node.addComponent(UITransform).setContentSize(480, 30);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = 22;
        label.lineHeight = 30;
        label.color = new Color(92, 64, 32, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        const font = assetManager.assets.get('ee40121d-0b21-4bb3-b95c-fa7d2df322b4') as TTFFont | undefined;
        if (font) {
            label.font = font;
            label.isSystemFontUsed = false;
        }
        return label;
    }

    /** 轻提示三颗：各弹一句，内容不同。节点运行时建（预制体里手写嵌套实例会被 Creator 丢掉） */
    private bindToast(page: Node): void {
        const bundle = assetManager.getBundle('GMUI');
        if (!bundle) return console.error('[LyControls] 没有 GMUI，轻提示按钮建不出来');
        bundle.load('PfGMBtn', Prefab, (err, prefab) => {
            if (err || !prefab) return console.error('[LyControls] 按钮预制体加载失败', err);
            if (!page.isValid) return;
            const note = this.makeNote(page);
            const say = (msg: string): void => {
                if (note?.isValid) note.string = msg;
            };
            // 标题：说清这三颗在测什么（和下面「角标」那行同一个位置风格）
            this.makeHead(page, TOAST_HEAD_Y, '轻提示　PfGMToast');
            const items: Array<[number, string, PfGMBtnTheme, () => void]> = [
                [-TOAST_BTN_X, '棋盘已满', PfGMBtnTheme.primary, () => {
                    gu.toast('棋盘已满，请先整理');
                    say('弹了一条：棋盘已满，请先整理');
                }],
                [0, '不适用', PfGMBtnTheme.info, () => {
                    gu.toast('提示不适用');
                    say('弹了一条：提示不适用');
                }],
                [TOAST_BTN_X, '园景素材', PfGMBtnTheme.warning, () => {
                    gu.toast('完成合成任务获得园景素材');
                    say('弹了一条：完成合成任务获得园景素材');
                }],
            ]; // 左 / 中 / 右三颗，各发一次，小档 180×64
            items.forEach(([x, text, theme, cb], i) => {
                // 尺寸只交给 setSize，绝不再改 contentSize：PfGMBtn 里 width = Math.max(档位宽, 当前宽)，
                // 改了会被它拉回去，三颗就会撞在一起。
                const ts = gu.createTs(prefab, { parent: page, x, y: TOAST_ROW_Y });
                if (!(ts instanceof PfGMBtn)) return console.error('[LyControls] 轻提示按钮没挂上', text);
                ts.setStyle(PfGMBtnStyle.text);
                ts.setSize(PfGMBtnSize.small);
                ts.setTheme(theme);
                ts.setText(text);
                ts.node.name = 'btnToast' + i;
                gu.addClick(ts.node, cb);
            });
        });
    }

    /** 展示页底部那行说明。运行时建，跟着轻提示按钮一起出现 */
    private makeNote(page: Node): Label | null {
        const node = new Node('toastNote');
        node.layer = page.layer;
        page.addChild(node);
        node.setPosition(0, TOAST_NOTE_Y, 0);
        node.getComponent(UITransform) ?? node.addComponent(UITransform);
        node.getComponent(UITransform)!.setContentSize(560, 40);
        const label = node.addComponent(Label);
        label.string = '每颗只弹一条，内容各不相同';
        label.fontSize = 20;
        label.lineHeight = 24;
        label.color = new Color(132, 112, 88, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        const font = assetManager.assets.get('ee40121d-0b21-4bb3-b95c-fa7d2df322b4') as TTFFont | undefined;
        if (font) {
            label.font = font;
            label.isSystemFontUsed = false;
        }
        return label;
    }

    /** 选择页的回调结果写到页面底部，不弹窗 */
    private note(text: string): void {
        if (this.noteView?.isValid) this.noteView.string = text;
    }

    /** 第 4 页一个列表。按钮换排法、项数和居中。页节点是运行时建的，控件也运行时建 */
    private bindList(page: Node): void {
        const ui = assetManager.getBundle('GMUI');
        const home = assetManager.getBundle('DemoHome');
        if (!ui || !home) return console.error('[LyControls] 没有包，列表建不出来');
        ui.load('PfGMList', Prefab, (err, listPrefab) => {
            if (err || !listPrefab) return console.error('[LyControls] 列表预制体加载失败', err);
            if (!page.isValid) return;
            home.load('PfListDemoItem', Prefab, (err2, itemPrefab) => {
                if (err2 || !itemPrefab) return console.error('[LyControls] 列表行预制体加载失败', err2);
                if (!page.isValid) return;
                ui.load('PfGMBtn', Prefab, (err3, btnPrefab) => {
                    if (err3 || !btnPrefab) return console.error('[LyControls] 列表按钮加载失败', err3);
                    if (!page.isValid) return;
                    this.placeList(page, listPrefab, itemPrefab, btnPrefab);
                });
            });
        });
    }

    /** 三行按钮在上，列表 480×400 在中，说明字贴在列表下面。左右都落在内沿 ±276 里 */
    private placeList(page: Node, listPrefab: Prefab, itemPrefab: Prefab, btnPrefab: Prefab): void {
        const pageUt = page.getComponent(UITransform);
        const pageH = pageUt?.height ?? 900;
        const top = pageH / 2 - 48;
        const rowH = 72;
        const rows = [top - 32, top - 32 - rowH, top - 32 - rowH * 2];
        const xs = [-186, 0, 186]; // 小档宽 180，三颗贴着内沿 ±276，相邻留 6
        const buttons: Array<[number, number, string, () => void]> = [
            [0, 0, '上下', () => this.useList(GMListDir.vertical, 1, this.listCount, this.listCenter)],
            [0, 1, '左右', () => this.useList(GMListDir.horizontal, 1, this.listCount, this.listCenter)],
            [0, 2, '网格下', () => this.useList(GMListDir.vertical, 4, this.listCount, this.listCenter)],
            [1, 0, '网格横', () => this.useList(GMListDir.horizontal, 4, this.listCount, this.listCenter)],
            [1, 1, '项少', () => this.useList(this.listDir, this.listLine, 3, this.listCenter)],
            [1, 2, '项多', () => this.useList(this.listDir, this.listLine, 30, this.listCenter)],
            [2, 1, '居中', () => this.useList(this.listDir, this.listLine, this.listCount, !this.listCenter)],
        ];
        for (const [row, col, text, fn] of buttons) {
            const ts = gu.createTs(btnPrefab, { parent: page, x: xs[col], y: rows[row] });
            if (!(ts instanceof PfGMBtn)) return console.error('[LyControls] 列表按钮没挂上', text);
            ts.setStyle(PfGMBtnStyle.text);
            ts.setSize(PfGMBtnSize.small);
            ts.setTheme(PfGMBtnTheme.secondary);
            ts.setText(text);
            ts.node.name = 'btnList' + text;
            gu.addClick(ts.node, fn);
        }
        const listH = 400;
        const listTop = rows[2] - 32 - 16;
        const listY = listTop - listH / 2;
        const list = gu.createTs(listPrefab, { parent: page, x: 0, y: listY });
        if (!(list instanceof PfGMList)) return console.error('[LyControls] 列表没挂上');
        list.node.name = 'pfList';
        list.node.getComponent(UITransform)?.setContentSize(480, listH);
        this.listView = list;
        this.listItem = itemPrefab;
        this.listNote = this.makeHead(page, listY - listH / 2 - 28, '');
        PfListDemoItem.onPick = (index) => {
            if (this.listNote?.isValid) this.listNote.string = '点了第 ' + index + ' 项';
        };
        this.useList(GMListDir.vertical, 1, 30, false);
    }

    /** 换排法或项数。居中再点一次就关掉 */
    private useList(dir: GMListDir, line: number, count: number, center: boolean): void {
        this.listDir = dir;
        this.listLine = line;
        this.listCount = count;
        this.listCenter = center;
        const list = this.listView;
        const prefab = this.listItem;
        if (!list || !prefab) return;
        list.setDir(dir);
        list.setLineCount(line);
        list.setCenter(center);
        list.setItems(prefab, count);
        if (this.listNote?.isValid) this.listNote.string = this.listCaption();
    }

    private listCaption(): string {
        const across = this.listDir === GMListDir.horizontal ? '左右' : '上下';
        const kind = this.listLine > 1 ? '网格' : '单列';
        const place = this.listCenter ? '居中' : '靠起点';
        return kind + across + ' · ' + this.listCount + ' 项 · ' + place;
    }
}
