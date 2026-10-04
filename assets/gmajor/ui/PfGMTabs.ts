import { _decorator, assetManager, BlockInputEvents, CCObjectFlags, Color, Enum, instantiate, Label, Node, Prefab, Sprite, SpriteFrame, TTFFont, UITransform } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { GMTabPage } from './GMTabPage';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 页签可调参数。改数字改这里。
 * 外框读根节点，预制体默认 640×480。页签高 72，和首页「页签 / 设置」一样。
 * 字号 26。宽按五个中文字不缩放来排。第一颗从 panel 顶边圆角之后开始，再往右挨着排。
 * 页签九宫格上 10、下 2、左 10、右 10。panel 四边 20。
 */
const PF_GM_TABS = {
    width: 640,
    tabH: 72, // 首页 tabHome / tabSetting 的高度
    corner: 12, // panel 顶边圆角。原图顶行从 x=12 才实心，第一颗从这里起
    fontSize: 26,
    padX: 12, // 五个字两侧留白，躲开左右圆角
    sample: '中中中中中', // 用来量一颗页签的宽
    ink: [92, 64, 32] as const, // 和标题同一套深墨
    fallback: 5, // 秒；页面忘了调用 done
    font: 'ee40121d-0b21-4bb3-b95c-fa7d2df322b4', // assets/gmajor/fonts/main.ttf
    dontSave: CCObjectFlags.DontSave, // 编辑器里生成的页签不写进预制体
};

const editing = EDITOR && !PREVIEW;

export enum GMTabSource {
    node = 0, // 拖场景里的节点
    prefab = 1, // 拖预制体资源
}
Enum(GMTabSource);

/** 编辑器里的一项。下拉框决定露出节点还是预制体 */
@ccclass('GMTabSlot')
export class GMTabSlot {
    @property({ type: Enum(GMTabSource) })
    source = GMTabSource.node;

    @property({ type: Node, visible(this: GMTabSlot) { return this.source === GMTabSource.node; } })
    page: Node | null = null;

    @property({ type: Prefab, visible(this: GMTabSlot) { return this.source === GMTabSource.prefab; } })
    prefab: Prefab | null = null;
}

type Entry = {
    page: GMTabPage;
    tab: Node;
    label: Label;
    plate: Sprite;
    made: boolean; // 预制体实例，移除时由这里拆
    wired: boolean;
};

function ink(): Color {
    const c = PF_GM_TABS.ink;
    return new Color(c[0], c[1], c[2], 255);
}

/** 框架页签。上面一排页签，下面 panel。根锚点在中心 */
@ccclass('PfGMTabs')
@executeInEditMode(true)
export class PfGMTabs extends GMComponent {
    private tabsNode: Node | null = null;
    private panelNode: Node | null = null;
    private panelSprite: Sprite | null = null;
    private pages: Entry[] = [];
    private current = -1; // 没有当前页
    private switching = false;
    private pending: number | null = null;
    private pendingClick = false;
    private onChange: ((index: number) => void) | null = null;
    private slotMark = '';
    private stepGen = 0;
    private hookName = '';
    private closeStep: (() => void) | null = null;
    private normal: SpriteFrame | null = null;
    private selected: SpriteFrame | null = null;
    private fixedW = 0; // 五个字量出来的页签宽。字库晚到就重测

    @property
    index = 0; // 和 setIndex 同一份。越界会夹紧

    @property({ type: [GMTabSlot] })
    slots: GMTabSlot[] = [];

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMTabs] 需要子节点 tabs 和 panel');
        this.dressPanel();
        this.loadFrames();
        this.syncSlots(true);
        if (editing) this.syncIndex();
        this.layout();
        if (editing || this.pages.length === 0) return;
        this.request(this.clamp(Math.round(this.index)), false);
    }

    onRemove(): void {
        this.stepGen++;
        this.unschedule(this.lateStep);
        this.closeStep = null;
        if (this.switching) gu.loadingHide(this.loadingKey());
    }

    update(): void { // 检查器改下标、拉宽、或 setText 之后重排
        if (!this.tabsNode) return;
        if (editing) this.syncSlots(false);
        this.syncIndex();
        this.layout();
    }

    /** 改当前页。和点页签同一套切换，但不调用 setOnChange */
    setIndex(index: number): void {
        if (this.pages.length === 0) {
            this.index = 0;
            this.current = -1;
            return;
        }
        this.request(this.clamp(Math.round(index)), false);
    }

    /** 只在用户点页签并且这次切换走完之后调用 */
    setOnChange(cb: ((index: number) => void) | null): void {
        this.onChange = cb;
    }

    /** 插入一页。不传下标就加到末尾。留在当前页 */
    insert(content: Node | Prefab, index?: number): void {
        if (!content) return console.error('[PfGMTabs] insert 没有内容');
        if (!editing && this.switching) return console.error('[PfGMTabs] 切换中不能插入');
        const at = index === undefined ? this.pages.length : index;
        const claimed = this.claim(content);
        if (!claimed) return;
        if (!Number.isInteger(at) || at < 0 || at > this.pages.length) {
            if (claimed.made && claimed.page.node.isValid) claimed.page.node.destroy();
            return console.error('[PfGMTabs] insert 下标不合法', index);
        }
        const entry = this.makeEntry(claimed.page, claimed.made);
        this.pages.splice(at, 0, entry);
        if (this.current >= at) this.current += 1;
        if (this.current >= 0) this.index = this.current;
        this.layout();
    }

    /** 删一页。下标必须是现有页。删当前页会切到相邻页 */
    remove(index: number): void {
        if (!Number.isInteger(index) || index < 0 || index >= this.pages.length) return console.error('[PfGMTabs] remove 下标不合法', index);
        if (!editing && this.switching) return console.error('[PfGMTabs] 切换中不能删除');
        if (!editing && index === this.current) return this.removeShown(index);
        const shown = this.current;
        this.destroyEntry(index);
        if (shown > index) this.current = shown - 1;
        else if (shown === index) this.current = this.pages.length ? Math.min(index, this.pages.length - 1) : -1;
        this.index = this.current < 0 ? 0 : this.current;
        this.layout();
    }

    /** GMTabPage.setText 调用。把页签上的字改掉 */
    noteText(): void {
        this.layout();
    }

    private bindNodes(): boolean {
        this.tabsNode = this.node.getChildByName('tabs');
        this.panelNode = this.node.getChildByName('panel');
        this.panelSprite = this.panelNode?.getComponent(Sprite) ?? null;
        if (!this.tabsNode || !this.panelNode || !this.panelSprite) return false;
        if (!this.panelNode.getComponent(BlockInputEvents)) this.panelNode.addComponent(BlockInputEvents);
        return true;
    }

    private syncSlots(force: boolean): void {
        const mark = this.slots.map((slot) => slot.source + ':' + (slot.source === GMTabSource.prefab ? slot.prefab?.uuid ?? '' : slot.page?.uuid ?? '')).join(',');
        if (!force && mark === this.slotMark) return;
        this.clearMade();
        this.slotMark = mark;
        for (const slot of this.slots) this.mountSlot(slot);
    }

    private syncIndex(): void {
        if (this.switching) return;
        if (this.pages.length === 0) {
            this.current = -1;
            this.index = 0;
            return;
        }
        const next = this.clamp(Math.round(this.index));
        if (next !== this.index) this.index = next;
        if (next === this.current) return;
        if (editing) {
            this.current = next;
            return;
        }
        this.request(next, false);
    }

    private mountSlot(slot: GMTabSlot): void {
        const content = slot.source === GMTabSource.prefab ? slot.prefab : slot.page;
        if (!content) return console.error('[PfGMTabs] 这一项是空的');
        const claimed = this.claim(content);
        if (!claimed) return;
        this.pages.push(this.makeEntry(claimed.page, claimed.made));
    }

    private claim(content: Node | Prefab): { page: GMTabPage; made: boolean } | null {
        if (content instanceof Prefab) {
            const node = instantiate(content);
            this.transient(node);
            const page = node.getComponent(GMTabPage);
            if (!page) {
                node.destroy();
                console.error('[PfGMTabs] 根上不是 GMTabPage');
                return null;
            }
            if (this.pages.some((item) => item.page === page)) {
                node.destroy();
                console.error('[PfGMTabs] 重复绑定');
                return null;
            }
            this.adopt(node);
            return { page, made: true };
        }
        const page = content.getComponent(GMTabPage);
        if (!page) return console.error('[PfGMTabs] 根上不是 GMTabPage'), null;
        if (this.pages.some((item) => item.page === page)) return console.error('[PfGMTabs] 重复绑定'), null;
        this.adopt(content);
        return { page, made: false };
    }

    private adopt(node: Node): void {
        const panel = this.panelNode;
        if (!panel) return;
        node.layer = panel.layer;
        node.active = false; // 先关掉再入树，onInit 留到第一次显示
        if (node.parent !== panel) panel.addChild(node);
    }

    private makeEntry(page: GMTabPage, made: boolean): Entry {
        const tabs = this.tabsNode;
        const tab = new Node('tab');
        const host = tabs ?? this.node;
        tab.layer = host.layer;
        host.addChild(tab);
        const tabUt = tab.addComponent(UITransform); // 先于 Sprite，避免后补的变换把尺寸留在默认 100
        tabUt.setAnchorPoint(0.5, 0.5);
        const plate = tab.addComponent(Sprite);
        plate.sizeMode = Sprite.SizeMode.CUSTOM; // 贴图前锁住，原图 56×32 不能改节点宽高
        plate.type = Sprite.Type.SLICED;
        const labelNode = new Node('label');
        labelNode.layer = tab.layer;
        tab.addChild(labelNode);
        labelNode.addComponent(UITransform);
        const label = labelNode.addComponent(Label);
        this.dressLabel(label);
        this.transient(tab);
        const entry: Entry = { page, tab, label, plate, made, wired: false };
        this.wire(entry);
        return entry;
    }

    private wire(entry: Entry): void {
        if (editing || entry.wired) return;
        entry.wired = true;
        const tab = entry.tab;
        gu.addClick(tab, () => {
            const at = this.pages.findIndex((item) => item.tab === tab);
            if (at < 0) return;
            this.request(at, true);
        });
    }

    private request(index: number, fromClick: boolean): void {
        if (editing || this.pages.length === 0) return;
        const next = this.clamp(index);
        this.index = next;
        if (this.switching) {
            this.pending = next;
            this.pendingClick = fromClick;
            return;
        }
        if (next === this.current) return;
        this.begin(next, fromClick);
    }

    private begin(next: number, fromClick: boolean): void {
        this.switching = true;
        gu.loadingShow(this.loadingKey());
        const prev = this.current >= 0 ? this.pages[this.current] : null;
        this.runHook(prev?.page ?? null, 'onHide', () => {
            if (!this.isValid) return;
            this.current = next;
            this.index = next;
            this.layout();
            this.runHook(this.pages[next]?.page ?? null, 'onShow', () => this.endSwitch(fromClick, next));
        });
    }

    private removeShown(index: number): void {
        const neighbor = this.pages.length === 1 ? null : this.pages[index < this.pages.length - 1 ? index + 1 : index - 1];
        this.switching = true;
        gu.loadingShow(this.loadingKey());
        this.runHook(this.pages[index].page, 'onHide', () => {
            if (!this.isValid) return;
            this.destroyEntry(index);
            if (!neighbor || !neighbor.page.node.isValid) {
                this.current = -1;
                this.index = 0;
                this.layout();
                this.endSwitch(false, -1);
                return;
            }
            const at = this.pages.indexOf(neighbor);
            this.current = at;
            this.index = at;
            this.layout();
            this.runHook(neighbor.page, 'onShow', () => this.endSwitch(false, at));
        });
    }

    private endSwitch(fromClick: boolean, landed: number): void {
        if (!this.isValid) return;
        gu.loadingHide(this.loadingKey());
        this.switching = false;
        if (fromClick && landed >= 0) this.onChange?.(landed);
        if (this.pending === null) return;
        const next = this.pending;
        const click = this.pendingClick;
        this.pending = null;
        this.pendingClick = false;
        if (this.pages.length === 0 || next === this.current) return;
        this.begin(this.clamp(next), click);
    }

    private runHook(page: GMTabPage | null, hook: 'onShow' | 'onHide', done: () => void): void {
        if (!page?.node.isValid) return done();
        const gen = ++this.stepGen;
        let closed = false;
        const close = (): void => {
            if (closed || gen !== this.stepGen) return;
            closed = true;
            this.unschedule(this.lateStep);
            if (this.isValid) done();
        };
        this.closeStep = close;
        this.hookName = hook;
        this.unschedule(this.lateStep);
        this.scheduleOnce(this.lateStep, PF_GM_TABS.fallback);
        const fn = page[hook];
        if (typeof fn !== 'function') return close();
        fn.call(page, close);
    }

    private lateStep = (): void => {
        console.warn('[PfGMTabs]', this.hookName, '未调用 done，已兜底');
        this.closeStep?.();
    };

    private layout(): void {
        const tabs = this.tabsNode;
        const panel = this.panelNode;
        const uit = this.node.getComponent(UITransform);
        if (!tabs || !panel || !uit) return;
        uit.setAnchorPoint(0.5, 0.5);
        const width = uit.width > 0 ? uit.width : PF_GM_TABS.width;
        const height = uit.height >= PF_GM_TABS.tabH ? uit.height : PF_GM_TABS.tabH;
        uit.setContentSize(width, height);
        const tabH = PF_GM_TABS.tabH;
        const panelH = height - tabH;
        const tabsUt = tabs.getComponent(UITransform) ?? tabs.addComponent(UITransform);
        const panelUt = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        tabsUt.setAnchorPoint(0.5, 0.5);
        panelUt.setAnchorPoint(0.5, 0.5);
        tabsUt.setContentSize(width, tabH);
        panelUt.setContentSize(width, panelH);
        const tabBottom = height / 2 - tabH; // 页签底边，同时是 panel 的上沿
        tabs.setPosition(0, tabBottom + tabH / 2, 0);
        panel.setPosition(0, (tabBottom + (-height / 2)) / 2, 0);
        if (this.fixedW <= 0 && this.pages.length > 0) this.fixedW = this.measureTab(this.pages[0].label);
        const tabW = Math.round(this.fixedW > 0 ? this.fixedW : PF_GM_TABS.fontSize * 5 + PF_GM_TABS.padX * 2);
        const count = this.pages.length;
        const left = -width / 2 + PF_GM_TABS.corner; // 让过左上圆角再排第一颗
        for (let i = 0; i < count; i++) {
            const entry = this.pages[i];
            const on = i === this.current;
            const tabUt = entry.tab.getComponent(UITransform) ?? entry.tab.addComponent(UITransform);
            const frame = on ? this.selected ?? this.normal : this.normal;
            entry.plate.sizeMode = Sprite.SizeMode.CUSTOM; // 先锁自定义，贴上原图才不会把节点打回 56×32
            entry.plate.type = Sprite.Type.SLICED;
            if (frame) entry.plate.spriteFrame = frame;
            tabUt.setAnchorPoint(0.5, 0); // 底边钉在 tabs 底上，也就是 panel 上沿
            tabUt.setContentSize(tabW, tabH); // 贴图之后再写，每帧都写，避免被原图尺寸盖住
            entry.tab.setPosition(left + (i + 0.5) * tabW, -tabH / 2, 0);
            this.dressLabel(entry.label);
            entry.label.string = entry.page.text;
            const lut = entry.label.node.getComponent(UITransform);
            lut?.setAnchorPoint(0.5, 0.5);
            lut?.setContentSize(Math.max(0, tabW - PF_GM_TABS.padX * 2), tabH);
            entry.label.node.setPosition(0, tabH / 2, 0);
            entry.page.node.active = on;
            if (on) this.fill(entry.page.node, panelUt);
        }
        const shown = this.current >= 0 ? this.pages[this.current] : null;
        if (shown) shown.tab.setSiblingIndex(tabs.children.length - 1);
    }

    private fill(node: Node, panelUt: UITransform): void {
        const uit = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        uit.setAnchorPoint(0.5, 0.5);
        uit.setContentSize(panelUt.contentSize);
        node.setPosition(0, 0, 0);
    }

    private clearMade(): void {
        for (const entry of this.pages) {
            if (entry.tab.isValid) entry.tab.destroy();
            if (entry.made && entry.page.node.isValid) entry.page.node.destroy();
            else if (entry.page.node.isValid) entry.page.node.active = false;
        }
        this.pages = [];
        this.current = -1;
    }

    private destroyEntry(index: number): void {
        const entry = this.pages[index];
        if (!entry) return;
        this.pages.splice(index, 1);
        if (entry.tab.isValid) entry.tab.destroy();
        if (entry.page.node.isValid) entry.page.node.destroy();
    }

    private clamp(index: number): number {
        if (this.pages.length === 0) return 0;
        if (index < 0) return 0;
        if (index >= this.pages.length) return this.pages.length - 1;
        return index;
    }

    private loadingKey(): string {
        return 'PfGMTabs:' + this.node.uuid;
    }

    private loadFrames(): void {
        applySkin('tab_normal', (frame) => this.takeFrame(frame, 10, 2, 10, 10, false));
        applySkin('tab_selected', (frame) => this.takeFrame(frame, 10, 2, 10, 10, true));
    }

    private takeFrame(frame: SpriteFrame, top: number, bottom: number, left: number, right: number, selected: boolean): void {
        frame.insetTop = top;
        frame.insetBottom = bottom;
        frame.insetLeft = left;
        frame.insetRight = right;
        if (selected) this.selected = frame;
        else this.normal = frame;
        this.layout();
    }

    private dressPanel(): void {
        const sprite = this.panelSprite;
        if (!sprite) return;
        applySkin('panel', (frame) => {
            if (!sprite.isValid) return;
            const uit = sprite.node.getComponent(UITransform);
            const w = uit?.width ?? 0;
            const h = uit?.height ?? 0;
            frame.insetTop = frame.insetBottom = frame.insetLeft = frame.insetRight = 20;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SLICED;
            sprite.spriteFrame = frame;
            if (uit && w > 0 && h > 0) uit.setContentSize(w, h); // 贴图会按原图像素改尺寸，锁回去
        });
    }

    private dressLabel(label: Label): void {
        label.fontSize = PF_GM_TABS.fontSize;
        label.lineHeight = PF_GM_TABS.fontSize;
        label.color = ink();
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        label.enableOutline = false;
        const hit = assetManager.assets.get(PF_GM_TABS.font) as TTFFont | undefined;
        if (hit) {
            label.font = hit;
            return;
        }
        assetManager.loadAny({ uuid: PF_GM_TABS.font }, (err: Error | null, font: TTFFont) => {
            if (err || !font || !label.isValid) return console.error('[PfGMTabs] 没有 main.ttf');
            label.font = font;
            this.fixedW = 0;
            this.layout();
        });
    }

    /** 五个中文字的实际宽度，加上两侧留白。字还没排出来时按字号估 */
    private measureTab(label: Label): number {
        const saved = label.string;
        this.dressLabel(label);
        label.string = PF_GM_TABS.sample;
        label.overflow = Label.Overflow.NONE;
        label.enableWrapText = false;
        label.updateRenderData(true);
        const textW = label.node.getComponent(UITransform)?.width ?? 0;
        label.string = saved;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        const pad = PF_GM_TABS.padX * 2;
        if (textW <= 0) return PF_GM_TABS.fontSize * 5 + pad;
        return Math.ceil(textW) + pad;
    }

    /** 编辑器里脚本生成的节点不写进预制体 */
    private transient(node: Node): void {
        if (!editing) return;
        node._objFlags |= PF_GM_TABS.dontSave;
        for (const child of node.children) this.transient(child);
    }
}
