import { _decorator, assetManager, BlockInputEvents, CCObjectFlags, Color, Enum, EventTouch, instantiate, Label, Mask, Node, Prefab, Sprite, SpriteFrame, TTFFont, UITransform } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { GMTabPage } from './GMTabPage';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 页签可调参数。改数字改这里。
 * 外框读根节点，预制体默认 640×480，窄于 360 拉回 360。页签高 64，和小档按钮一样。
 * chars 默认 5，整排一样宽。左边留半个圆角直径（20），右边留一个直径（40）。超出只横滑页签条。
 * 字号 26。相邻页签边线叠 3 像素。底边黑线压住 panel 顶边黑线。激活的那颗画在最上面。
 * 页签九宫格上 10、下 2、左 10、右 10。panel 四边 20。
 */
const PF_GM_TABS = {
    width: 640,
    minWidth: 360, // 再窄拉回这里
    tabH: 64, // 和小档按钮同高
    corner: 20, // panel 显示尺寸圆角半径。直径 40。左边留半个，右边留一个
    join: 3, // 相邻页签各让 3 像素，边线叠成一条
    fontSize: 26,
    padX: 12, // 字两侧留白
    chars: 5, // 不填时按五个中文字量宽
    ink: [92, 64, 32] as const, // 和标题同一套深墨
    fallback: 5, // 秒；页面忘了调用 done
    drag: 8, // 超过这么多像素算拖，不再当点击
    font: 'ee40121d-0b21-4bb3-b95c-fa7d2df322b4', // db://gmajor/fonts/main.ttf
    dontSave: CCObjectFlags.DontSave, // 编辑器里生成的页签不写进预制体
};

const editing = EDITOR && !PREVIEW;

export enum GMTabSource {
    node = 0, // 拖场景里的节点
    prefab = 1, // 拖预制体资源
}
Enum(GMTabSource);

/** 编辑器里的一项。标题另填。下拉框决定露出节点还是预制体 */
@ccclass('GMTabSlot')
export class GMTabSlot {
    @property
    text = ''; // 页签上的字。空着就用页面自己的 text

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
    private clipNode: Node | null = null;
    private reelNode: Node | null = null;
    private normal: SpriteFrame | null = null;
    private selected: SpriteFrame | null = null;
    private fixedW = 0; // 按 chars 量出来的页签宽。字数或字库变了就重测
    private scroll = 0; // 页签条向左滑了多少。0 贴着左留白
    private maxScroll = 0;
    private viewW = 0;
    private dragged = false;
    private dragDelta = 0;
    private grabScroll = 0;
    private charsMark = PF_GM_TABS.chars;
    private badChars = Number.NaN; // 上次打过日志的非法字数，避免每帧再打
    private narrowAt = 0; // 上次因过窄警告过的宽度，避免每帧再打
    private fitKey = '';

    @property
    index = 0; // 和 setIndex 同一份。越界会夹紧

    @property
    chars = PF_GM_TABS.chars; // 整排按几个中文字量宽。必须是大于 1 的整数

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
        this.unbindDrag();
        if (this.switching) gu.loadingHide(this.loadingKey());
    }

    update(): void { // 检查器改下标、拉宽、或 setText 之后重排
        if (!this.tabsNode) return;
        if (editing) this.syncSlots(false);
        this.syncIndex();
        this.layout();
    }

    /** 整排页签按几个中文字量宽。小于等于 1、或不是整数时打错误日志，不改 */
    setChars(chars: number): void {
        if (!this.charsOk(chars)) return console.error('[PfGMTabs] chars 必须是大于 1 的整数', chars);
        this.chars = chars;
        this.charsMark = chars;
        this.fixedW = 0;
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

    /** 插入一页。text 是页签标题，盖过页面自己的 text。不传下标就加到末尾。留在当前页 */
    insert(content: Node | Prefab, text = '', index?: number): void {
        if (!content) return console.error('[PfGMTabs] insert 没有内容');
        if (!editing && this.switching) return console.error('[PfGMTabs] 切换中不能插入');
        const at = index === undefined ? this.pages.length : index;
        const claimed = this.claim(content);
        if (!claimed) return;
        if (text) claimed.page.text = text; // 标题从外面来，不写进页面预制体
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
        this.ensureClip();
        return true;
    }

    /** 页签条上套一层遮罩，左右留白外面的部分裁掉。运行时生成，不写进预制体 */
    private ensureClip(): void {
        const tabs = this.tabsNode;
        if (!tabs || this.clipNode?.isValid) return;
        const clip = new Node('tabClip');
        clip.layer = tabs.layer;
        tabs.addChild(clip);
        const cut = clip.addComponent(UITransform);
        cut.setAnchorPoint(0.5, 0.5);
        clip.addComponent(Mask).type = Mask.Type.RECT;
        const reel = new Node('tabReel');
        reel.layer = tabs.layer;
        clip.addChild(reel);
        const rut = reel.addComponent(UITransform);
        rut.setAnchorPoint(0, 0.5);
        this.clipNode = clip;
        this.reelNode = reel;
        this.transient(clip);
        if (editing) return;
        clip.on(Node.EventType.TOUCH_START, this.onTabStart, this, true);
        clip.on(Node.EventType.TOUCH_MOVE, this.onTabMove, this, true);
        clip.on(Node.EventType.TOUCH_END, this.onTabEnd, this, true);
        clip.on(Node.EventType.TOUCH_CANCEL, this.onTabEnd, this, true);
    }

    private unbindDrag(): void {
        const clip = this.clipNode;
        if (!clip?.isValid) return;
        clip.off(Node.EventType.TOUCH_START, this.onTabStart, this, true);
        clip.off(Node.EventType.TOUCH_MOVE, this.onTabMove, this, true);
        clip.off(Node.EventType.TOUCH_END, this.onTabEnd, this, true);
        clip.off(Node.EventType.TOUCH_CANCEL, this.onTabEnd, this, true);
    }

    private onTabStart = (): void => {
        this.dragged = false;
        this.dragDelta = 0;
        this.grabScroll = this.scroll;
    };

    private onTabMove = (event: EventTouch): void => {
        if (editing || this.maxScroll <= 0) return;
        const scale = Math.abs(this.node.worldScale.x) || 1;
        this.dragDelta += event.getUIDelta().x / scale;
        if (Math.abs(this.dragDelta) <= PF_GM_TABS.drag) return; // 没过阈值仍当点击，页签条先不动
        this.dragged = true;
        this.scroll = this.clampScroll(this.grabScroll - this.dragDelta);
        this.placeReel();
    };

    private onTabEnd = (): void => {
        this.dragDelta = 0;
    };

    private syncSlots(force: boolean): void {
        const mark = this.slots.map((slot) => {
            const id = slot.source === GMTabSource.prefab ? slot.prefab?.uuid ?? '' : slot.page?.uuid ?? '';
            return slot.source + ':' + id + ':' + slot.text;
        }).join(',');
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
        if (slot.text) claimed.page.text = slot.text; // 标题从槽位来，不写进页面自己
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
        const host = this.reelNode ?? this.tabsNode ?? this.node;
        const tab = new Node('tab');
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
            if (this.dragged) return; // 这次是拖页签条，不换页
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
        this.adoptChars();
        const rawW = uit.width > 0 ? uit.width : PF_GM_TABS.width;
        const width = rawW < PF_GM_TABS.minWidth ? PF_GM_TABS.minWidth : rawW;
        if (rawW < PF_GM_TABS.minWidth) {
            if (this.narrowAt !== rawW) console.warn('[PfGMTabs] 宽小于 360，已拉回', rawW);
            this.narrowAt = rawW;
        } else this.narrowAt = 0;
        const height = uit.height >= PF_GM_TABS.tabH ? uit.height : PF_GM_TABS.tabH;
        uit.setContentSize(width, height);
        const tabH = PF_GM_TABS.tabH;
        const overlap = 4; // 底边黑线压住 panel 顶边黑线。再大的话，页签右边的顶边会抬上去
        const tabBottom = height / 2 - tabH;
        const panelTop = tabBottom + overlap;
        const panelBottom = -height / 2;
        const panelH = panelTop - panelBottom;
        const tabsUt = tabs.getComponent(UITransform) ?? tabs.addComponent(UITransform);
        const panelUt = panel.getComponent(UITransform) ?? panel.addComponent(UITransform);
        tabsUt.setAnchorPoint(0.5, 0.5);
        panelUt.setAnchorPoint(0.5, 0.5);
        tabsUt.setContentSize(width, tabH);
        panelUt.setContentSize(width, panelH);
        tabs.setPosition(0, tabBottom + tabH / 2 + 1, 0); // 页签再抬 1 像素，底边黑线压住 panel 顶边
        panel.setPosition(0, (panelTop + panelBottom) / 2, 0);
        const chars = this.charsMark;
        if (this.fixedW <= 0 && this.pages.length > 0) this.fixedW = this.measureTab(this.pages[0].label, chars);
        const tabW = Math.round(this.fixedW > 0 ? this.fixedW : PF_GM_TABS.fontSize * chars + PF_GM_TABS.padX * 2);
        const count = this.pages.length;
        const insetL = PF_GM_TABS.corner; // 半个直径，靠左
        const insetR = PF_GM_TABS.corner * 2; // 右边仍留一个直径
        this.viewW = Math.max(0, width - insetL - insetR);
        this.fitClip(insetL, insetR);
        this.fitScroll(tabW, count);
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
            entry.tab.setPosition(tabW / 2 + i * (tabW - PF_GM_TABS.join), -tabH / 2, 0); // 从卷轴左边排，相邻边线叠 join 像素
            this.dressLabel(entry.label);
            entry.label.string = entry.page.text;
            const lut = entry.label.node.getComponent(UITransform);
            lut?.setAnchorPoint(0.5, 0.5);
            lut?.setContentSize(Math.max(0, tabW - PF_GM_TABS.padX * 2), tabH);
            entry.label.node.setPosition(0, tabH / 2, 0);
            entry.page.node.active = on;
            if (on) this.fill(entry.page.node, panelUt);
        }
        let order = 0;
        for (let i = 0; i < count; i++) {
            if (i === this.current) continue;
            this.pages[i].tab.setSiblingIndex(order++);
        }
        if (this.current >= 0) this.pages[this.current].tab.setSiblingIndex(order); // 激活的画在最上面，叠住两侧的边线
        this.placeReel();
        tabs.setSiblingIndex(this.node.children.length - 1); // 画在板子上面，底边不被板子盖住
    }

    /** 遮罩缩在左右留白以内。左边窄、右边宽，所以不居中 */
    private fitClip(insetL: number, insetR: number): void {
        const clip = this.clipNode;
        const reel = this.reelNode;
        const cut = clip?.getComponent(UITransform);
        const rut = reel?.getComponent(UITransform);
        if (!clip || !cut || !rut) return;
        cut.setContentSize(this.viewW, PF_GM_TABS.tabH);
        clip.setPosition((insetL - insetR) / 2, 0, 0);
        rut.setContentSize(Math.max(this.viewW, 1), PF_GM_TABS.tabH);
    }

    /** 换页或宽度变了，才把当前颗滚进可视区。已经完全看得见就不动 */
    private fitScroll(tabW: number, count: number): void {
        const stride = tabW - PF_GM_TABS.join;
        const contentW = count <= 0 ? 0 : count * tabW - (count - 1) * PF_GM_TABS.join;
        this.maxScroll = Math.max(0, contentW - this.viewW);
        const key = this.current + '|' + tabW + '|' + this.viewW + '|' + count;
        if (key !== this.fitKey && this.current >= 0 && count > 0) {
            const left = this.current * stride;
            const right = left + tabW;
            if (tabW >= this.viewW) this.scroll = left; // 一颗比窗口还宽，左边对齐
            else if (left < this.scroll - 0.5) this.scroll = left;
            else if (right > this.scroll + this.viewW + 0.5) this.scroll = right - this.viewW;
        }
        this.fitKey = key;
        this.scroll = this.clampScroll(this.scroll);
    }

    private placeReel(): void {
        this.reelNode?.setPosition(-this.viewW / 2 - this.scroll, 0, 0);
    }

    private clampScroll(n: number): number {
        if (!(n > 0)) return 0;
        if (n > this.maxScroll) return this.maxScroll;
        return n;
    }

    private charsOk(n: number): boolean {
        return Number.isInteger(n) && n > 1;
    }

    /** 检查器改了字数就重测。非法值打一次日志并退回 */
    private adoptChars(): void {
        const n = this.chars;
        if (this.charsOk(n)) {
            if (n !== this.charsMark) this.fixedW = 0;
            this.charsMark = n;
            this.badChars = Number.NaN;
            return;
        }
        if (n !== this.badChars) console.error('[PfGMTabs] chars 必须是大于 1 的整数', n);
        this.badChars = n;
        this.chars = this.charsMark;
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
        applySkin('tab_normal', (frame) => this.takeFrame(frame, false));
        applySkin('tab_selected', (frame) => this.takeFrame(frame, true));
    }

    private takeFrame(frame: SpriteFrame, selected: boolean): void {
        if (selected) this.selected = frame; // 九宫格用图集子图上已经写好的边
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
            sprite.sizeMode = Sprite.SizeMode.CUSTOM; // 九宫格用 panel 子图上已经写好的边
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

    /** chars 个中文字的实际宽度，加上两侧留白。字还没排出来时按字号估 */
    private measureTab(label: Label, chars: number): number {
        const saved = label.string;
        this.dressLabel(label);
        label.string = '中'.repeat(chars);
        label.overflow = Label.Overflow.NONE;
        label.enableWrapText = false;
        label.updateRenderData(true);
        const textW = label.node.getComponent(UITransform)?.width ?? 0;
        label.string = saved;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        const pad = PF_GM_TABS.padX * 2;
        if (textW <= 0) return PF_GM_TABS.fontSize * chars + pad;
        return Math.ceil(textW) + pad;
    }

    /** 编辑器里脚本生成的节点不写进预制体 */
    private transient(node: Node): void {
        if (!editing) return;
        node._objFlags |= PF_GM_TABS.dontSave;
        for (const child of node.children) this.transient(child);
    }
}
