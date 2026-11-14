import { _decorator, assetManager, BlockInputEvents, Color, instantiate, Label, Node, Prefab, ScrollBar, ScrollView, Sprite, UITransform, Vec2 } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';
import { PfGMOption } from './PfGMOption';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 下拉可调参数。改数字改这里。
 * 收起态 72 高，宽读根节点。子节点固定 bg、icon、label、arrow。
 * 展开列表用引擎自带 ScrollView（预制体里就摆好 view / content / scrollBar / bar），运行时克隆，这里只往 content 里塞行。
 * 行高 64，上下内衬 6。一屏最多 8 行，再多由 ScrollView 滚。
 */
const PF_GM_SELECT = {
    width: 320, // 根宽为 0 时的占位
    minWidth: 200, // 窄于这个夹到这里
    height: 72,
    arrow: 44,
    arrowInset: 24, // 箭头中心离右内边
    iconSize: 36,
    padX: 24,
    gap: 12, // 图标和字之间
    fontSize: 26,
    rowH: 64,
    boardPad: 6, // 列表底板上下内衬
    stick: 6, // 列表上边压住盒底这么多，看起来是一体的
    maxVisible: 8, // 一屏最多铺几行，再多交给 ScrollView 滚
    scrollW: 16, // 滚动条显示宽；图已经画成 16，不用再缩放
    barInset: 3, // 滚动条离底板右内边多少
    autoHide: 0.8, // 秒；停手后滚动条渐隐的时间
    ink: [92, 64, 32] as const,
};

const editing = EDITOR && !PREVIEW;
const CORE = 'GMUI';

/** 下拉的一项。检查器里可编辑，和 GMTabSlot 同一套写法 */
@ccclass('GMOptionItem')
export class GMOptionItem {
    @property text = '';

    @property icon = ''; // 物品槽名，例如 icon_star。空着只显示文字
}

let optionPrefab: Prefab | null = null;
let optionWait: Array<(prefab: Prefab | null) => void> | null = null;

/** 行预制体只从框架 Bundle 取一次 */
function loadOptionPrefab(done: (prefab: Prefab | null) => void): void {
    if (optionPrefab) return done(optionPrefab);
    if (optionWait) return void optionWait.push(done);
    optionWait = [done];
    const bundle = assetManager.getBundle(CORE);
    if (!bundle) return flushOption(null);
    bundle.load('PfGMOption', Prefab, (err, prefab) => {
        if (err || !prefab) console.error('[PfGMSelect] 行预制体加载失败', err);
        flushOption(err || !prefab ? null : prefab);
    });
}

function flushOption(prefab: Prefab | null): void {
    optionPrefab = prefab;
    const wait = optionWait ?? [];
    optionWait = null;
    wait.forEach((fn) => fn(prefab));
}

function clampIndex(index: number, count: number): number {
    if (count <= 0) return -1;
    if (!Number.isFinite(index)) return -1;
    const at = Math.round(index);
    if (at < 0) return -1;
    return at >= count ? count - 1 : at;
}

/** 框架下拉。收起态一个盒子，点开用 ScrollView 弹选项列表。点击由外层 gu.addClick 注册 */
@ccclass('PfGMSelect')
@executeInEditMode(true)
export class PfGMSelect extends GMComponent {
    private bg: Sprite | null = null;
    private iconView: Sprite | null = null;
    private labelView: Label | null = null;
    private arrowView: Sprite | null = null;
    private list: Node | null = null; // 运行时克隆出来的整块（含 ScrollView）
    private shield: Node | null = null; // 点外面关闭的透明遮罩
    private scroll: ScrollView | null = null;
    private content: Node | null = null;
    private rows: PfGMOption[] = [];
    private dressed = '';
    private stamp = '';
    private onChange: ((index: number) => void) | null = null; // 只在用户点选时调

    @property({ type: [GMOptionItem] })
    items: GMOptionItem[] = [];

    @property
    index = -1; // -1 = 没选中，盒子显示空

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMSelect] 需要子节点 bg、icon、label、arrow');
        if (this.labelView!.isSystemFontUsed || !this.labelView!.font) console.error('[PfGMSelect] label 未挂 db://gmajor/fonts/main.ttf');
        this.dress(this.bg, 'dropdown', true);
        this.dress(this.arrowView, 'icon_arrow', false);
        this.dressSkeleton(); // 列表骨架也先贴上皮肤，编辑器里就是真样子，不用等展开
        this.hideTemplate(); // 播放时模板本身不能露出来，展开是克隆它
        this.index = clampIndex(this.index, this.items.length);
        this.layout();
    }

    /** 模板 list 在编辑器里可见（所见即所得），播放时收起，展开靠克隆 */
    private hideTemplate(): void {
        if (editing) return;
        const list = this.node.getChildByName('list');
        if (list) list.active = false;
    }

    /** list / scrollBar / bar 三处的皮。运行时 build 会再贴一次，编辑器和播放同一套 */
    private dressSkeleton(): void {
        const list = this.node.getChildByName('list');
        if (!list) return;
        this.dress(list.getComponent(Sprite), 'dropdown_list', true);
        const track = list.getChildByName('scrollBar');
        if (track) this.dress(track.getComponent(Sprite), 'scrollbar', true);
        const thumb = track?.getChildByName('bar');
        if (thumb) this.dress(thumb.getComponent(Sprite), 'scrollbar_thumb', true); // 九宫格，纵向拉伸圆头才不走形
    }

    onDisable(): void { // 页面被切走时收起，免得不小心留一个浮层
        this.close();
    }

    onRemove(): void {
        this.destroyOpen();
    }

    update(): void { // 检查器改了项或下标后重画。编辑态和运行态同一条
        if (!this.bg) return;
        if (this.mark() === this.stamp) return;
        this.index = clampIndex(this.index, this.items.length);
        this.layout();
    }

    /** 换整份选项。原有下标夹进新范围，不回调 */
    setItems(items: GMOptionItem[]): void {
        this.items = items ?? [];
        this.index = clampIndex(this.index, this.items.length);
        this.layout();
        if (this.list) this.reopen();
    }

    /** 改下标。夹到合法范围，-1 表示不选。不回调 */
    setIndex(index: number): void {
        const next = clampIndex(index, this.items.length);
        if (next === this.index) {
            this.layout();
            return;
        }
        this.index = next;
        this.layout();
        if (this.list) this.reopen();
    }

    /** 只在用户点选并且下标真的变了时调用。setIndex 不走这里 */
    setOnChange(cb: ((index: number) => void) | null): void {
        this.onChange = cb;
    }

    get opened(): boolean {
        return !!this.list;
    }

    /** 收起态盒子的点击调它 */
    toggle(): void {
        if (this.list) this.close();
        else this.open();
    }

    /** 展开。已经在列表里、或编辑态则不做事 */
    open(): void {
        if (editing || this.list || this.items.length === 0) return;
        if (!this.node.isValid || !this.node.parent) return;
        loadOptionPrefab((prefab) => {
            if (!prefab || !this.node.isValid || this.list) return;
            this.build(prefab);
        });
    }

    /** 收起。点外面、点已选中项、页面切走都走这里 */
    close(): void {
        if (!this.list && !this.shield) return;
        this.destroyOpen();
        this.setArrow(false);
    }

    private mark(): string {
        const one = this.items.map((item) => `${item.text}/${item.icon}`).join(',');
        return `${this.index}|${one}`;
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.iconView = this.node.getChildByName('icon')?.getComponent(Sprite) ?? null;
        this.labelView = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        this.arrowView = this.node.getChildByName('arrow')?.getComponent(Sprite) ?? null;
        return !!(this.bg && this.iconView && this.labelView && this.arrowView);
    }

    private current(): GMOptionItem | null {
        return this.index >= 0 && this.index < this.items.length ? this.items[this.index] : null;
    }

    /** 根宽。留了宽度就用它，没留过用默认 320；窄于 200 的夹到 200 */
    private boxWidth(): number {
        const root = this.node.getComponent(UITransform);
        const width = root?.width ?? 0;
        if (width <= 0) return PF_GM_SELECT.width;
        return width < PF_GM_SELECT.minWidth ? PF_GM_SELECT.minWidth : width;
    }

    /** 收起态：底板、当前项的图标和字、右侧箭头 */
    private layout(): void {
        const root = this.node.getComponent(UITransform);
        const bg = this.bg;
        const icon = this.iconView;
        const label = this.labelView;
        const arrow = this.arrowView;
        if (!root || !bg || !icon || !label || !arrow) return;
        const width = this.boxWidth();
        const height = PF_GM_SELECT.height;
        root.setContentSize(width, height);
        bg.node.getComponent(UITransform)?.setContentSize(width, height);
        bg.node.setPosition(0, 0, 0);
        arrow.node.getComponent(UITransform)?.setContentSize(PF_GM_SELECT.arrow, PF_GM_SELECT.arrow);
        arrow.node.setPosition(width / 2 - PF_GM_SELECT.arrowInset - PF_GM_SELECT.arrow / 2, 0, 0);
        const item = this.current();
        const name = item?.icon ?? '';
        if (name !== this.dressed) this.dressIcon(name);
        const hasIcon = name.length > 0;
        icon.node.active = hasIcon;
        icon.node.getComponent(UITransform)?.setContentSize(PF_GM_SELECT.iconSize, PF_GM_SELECT.iconSize);
        const left = -width / 2 + PF_GM_SELECT.padX;
        if (hasIcon) icon.node.setPosition(left + PF_GM_SELECT.iconSize / 2, 0, 0);
        const textLeft = hasIcon ? left + PF_GM_SELECT.iconSize + PF_GM_SELECT.gap : left;
        const textRight = width / 2 - PF_GM_SELECT.arrow - PF_GM_SELECT.padX / 2;
        this.placeLabel(label, item?.text ?? '', textLeft, textRight, height);
        this.stamp = this.mark();
    }

    private placeLabel(label: Label, text: string, left: number, right: number, height: number): void {
        const ink = PF_GM_SELECT.ink;
        label.string = text;
        label.fontSize = PF_GM_SELECT.fontSize;
        label.lineHeight = PF_GM_SELECT.fontSize;
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        label.enableWrapText = false;
        label.enableOutline = false; // 奶油底上的深色字不描边
        const lut = label.node.getComponent(UITransform);
        lut?.setAnchorPoint(0, 0.5);
        lut?.setContentSize(Math.max(0, right - left), height);
        label.node.setPosition(left, 0, 0);
    }

    /** 展开：算上下哪边放得下，克隆预制体里的 list 骨架（ScrollView），再往 content 塞行 */
    private build(prefab: Prefab): void {
        const parent = this.node.parent;
        const page = parent?.getComponent(UITransform) ?? null;
        const tpl = this.node.getChildByName('list');
        if (!parent || !page) return;
        if (!tpl) return console.error('[PfGMSelect] 预制体缺少 list 骨架');
        const width = this.boxWidth();
        const pos = this.node.position;
        const half = PF_GM_SELECT.height / 2;
        const below = pos.y - half + page.height / 2; // 盒子底到页底的余量
        const above = page.height / 2 - (pos.y + half); // 盒子顶到页顶的余量
        const want = Math.min(this.items.length, PF_GM_SELECT.maxVisible);
        const heightOf = (count: number): number => count * PF_GM_SELECT.rowH + PF_GM_SELECT.boardPad * 2;
        const need = heightOf(want) - PF_GM_SELECT.stick; // 上边贴住盒子，少占这一截
        let down = true;
        let room = below;
        if (need > below) {
            down = below > above; // 下面放不下：只有下面仍比上面大才继续往下，否则往上翻
            room = down ? below : above;
        }
        const fits = Math.floor((room + PF_GM_SELECT.stick - PF_GM_SELECT.boardPad * 2) / PF_GM_SELECT.rowH);
        const shown = Math.max(1, Math.min(want, fits)); // 一行都放不下时也铺一行，宁可压一点
        const listH = heightOf(shown);
        const listY = down
            ? pos.y - half + PF_GM_SELECT.stick - listH / 2 // 上边压住盒底 stick 像素，看起来是一体的
            : pos.y + half - PF_GM_SELECT.stick + listH / 2;

        const shield = this.makeShield(parent, page);
        if (!shield) return;
        this.shield = shield; // 遮罩先入树，列表随后再入树，压在它上面

        const list = instantiate(tpl);
        list.active = true;
        list.layer = parent.layer; // 跟父同层，否则 Overlay 相机不画
        this.applyLayer(list, parent.layer);
        list.getComponent(UITransform)?.setContentSize(width, listH);
        list.addComponent(BlockInputEvents); // 点行与行之间的缝不穿透到页面
        parent.addChild(list);
        list.setPosition(pos.x, listY, 0);
        this.list = list;
        this.scroll = list.getComponent(ScrollView);
        this.dress(list.getComponent(Sprite), 'dropdown_list', true);

        const view = list.getChildByName('view');
        const content = view?.getChildByName('content') ?? null;
        this.content = content;
        if (view) view.getComponent(UITransform)?.setContentSize(width, listH);
        if (content) {
            const cut = content.getComponent(UITransform);
            cut?.setAnchorPoint(0.5, 1);
            cut?.setContentSize(width, listH);
            content.setPosition(0, listH / 2, 0);
        }

        const track = list.getChildByName('scrollBar');
        if (track) {
            const trackH = listH - PF_GM_SELECT.boardPad * 2;
            track.getComponent(UITransform)?.setContentSize(PF_GM_SELECT.scrollW, trackH);
            // 图已经画成 16 宽，直接用绝对尺寸，不用 scale（缩放会把高度也缩小）
            track.setScale(1, 1, 1);
            track.setPosition(width / 2 - PF_GM_SELECT.scrollW / 2 - PF_GM_SELECT.barInset, 0, 0);
            this.dress(track.getComponent(Sprite), 'scrollbar', true);
            const thumb = track.getChildByName('bar');
            if (thumb) {
                thumb.getComponent(UITransform)?.setContentSize(PF_GM_SELECT.scrollW, Math.max(32, trackH / 3));
                this.dress(thumb.getComponent(Sprite), 'scrollbar_thumb', true); // 九宫格，纵向拉伸圆头才不走形
            }
            const sb = track.getComponent(ScrollBar);
            if (sb) {
                sb.enableAutoHide = true; // 平时透明，滚动时出来，停手 autoHide 秒后渐隐
                sb.autoHideTime = PF_GM_SELECT.autoHide;
            }
            track.active = this.items.length > shown; // 内容放得下就不出滚动条
        }
        if (this.scroll) this.scroll.verticalScrollBar = track?.getComponent(ScrollBar) ?? null;

        this.setArrow(true); // 展开就转 180°，向下往上弹都一样
        this.fillRows(prefab, width, listH);
    }

    /** 整棵树设层，克隆出来的节点都要跟父同层 */
    private applyLayer(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyLayer(child, layer);
    }

    /** 所有行一次铺进 content。ScrollView 自己负责滚，行不做复用 */
    private fillRows(prefab: Prefab, width: number, listH: number): void {
        const content = this.content;
        if (!content) return;
        const cut = content.getComponent(UITransform);
        const total = this.items.length * PF_GM_SELECT.rowH + PF_GM_SELECT.boardPad * 2;
        cut?.setContentSize(width, Math.max(total, listH)); // content 高度按全部行算，才能滚
        const rowW = width - PF_GM_SELECT.boardPad * 2;
        for (let i = 0; i < this.items.length; i++) {
            const y = -PF_GM_SELECT.boardPad - PF_GM_SELECT.rowH * (i + 0.5); // 从 content 顶端往下排
            const ts = gu.createTs(prefab, { parent: content, x: 0, y });
            if (!(ts instanceof PfGMOption)) continue;
            ts.node.getComponent(UITransform)?.setContentSize(rowW, PF_GM_SELECT.rowH);
            const item = this.items[i];
            ts.setIcon(item.icon);
            ts.setText(item.text);
            ts.setSelected(i === this.index);
            const at = i;
            gu.addClick(ts.node, () => this.pick(at), { press: 'none' });
            this.rows.push(ts);
        }
        // 行放好后再让 ScrollView 算一次，否则滚动区间还是旧的
        this.scroll?.stopAutoScroll();
        this.scrollToIndex(this.index);
    }

    /** 把选中项滚进可见范围。没有选中就滚到顶 */
    private scrollToIndex(at: number): void {
        const sv = this.scroll;
        const content = this.content;
        if (!sv || !content) return;
        if (at < 0) {
            sv.scrollToTop(0);
            return;
        }
        const cut = content.getComponent(UITransform);
        const view = content.parent?.getComponent(UITransform);
        if (!cut || !view) return;
        const travel = cut.height - view.height;
        if (travel <= 0) return;
        const center = PF_GM_SELECT.boardPad + PF_GM_SELECT.rowH * (at + 0.5);
        const want = Math.max(0, Math.min(travel, center - view.height / 2));
        sv.scrollToOffset(new Vec2(0, want), 0); // 第二参 0 = 不带动效
    }

    /** 透明遮罩：盖住整页，点它只收起不改值 */
    private makeShield(parent: Node, page: UITransform): Node | null {
        const node = new Node('selectShield');
        node.layer = parent.layer;
        const uit = node.addComponent(UITransform);
        uit.setContentSize(page.width, page.height);
        node.addComponent(BlockInputEvents); // 展开期间同页别的控件点不到
        parent.addChild(node);
        node.setPosition(0, 0, 0);
        gu.addClick(node, () => this.close(), { press: 'none' });
        return node;
    }

    /** 用户点了第 at 项 */
    private pick(at: number): void {
        const changed = at !== this.index;
        this.index = at;
        this.layout();
        this.close();
        if (changed) this.onChange?.(this.index);
    }

    /** 下标变了但列表还开着：整块重建，保证高亮跟着动 */
    private reopen(): void {
        this.destroyOpen();
        this.open();
    }

    private destroyOpen(): void {
        if (this.list?.isValid) this.list.destroy();
        if (this.shield?.isValid) {
            gu.removeClick(this.shield);
            this.shield.destroy();
        }
        this.list = null;
        this.shield = null;
        this.scroll = null;
        this.content = null;
        this.rows = [];
    }

    private setArrow(up: boolean): void {
        const arrow = this.arrowView;
        if (!arrow?.isValid) return;
        arrow.node.angle = up ? 180 : 0;
    }

    private dress(sprite: Sprite | null, name: string, sliced: boolean): void {
        if (!sprite) return;
        applySkin(name, (frame) => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        });
    }

    private dressIcon(name: string): void {
        const sprite = this.iconView;
        this.dressed = name;
        if (!sprite) return;
        if (!name) {
            sprite.spriteFrame = null;
            return;
        }
        applySkin(name, (frame) => {
            if (!sprite.isValid || this.dressed !== name) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
