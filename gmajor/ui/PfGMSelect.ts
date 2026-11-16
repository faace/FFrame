import { _decorator, assetManager, BlockInputEvents, Color, Label, Node, Prefab, Sprite, UITransform } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';
import { GMListDir, PfGMList } from './PfGMList';
import { PfGMOption } from './PfGMOption';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 下拉可调参数。改数字改这里。
 * 收起态 72 高，宽读根节点。子节点固定 bg、icon、label、arrow。
 * 展开用 PfGMList，底板 dropdown_list（上边直角贴住盒子）。行高 64，上下内衬 6。一屏最多 8 行。
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
    private list: PfGMList | null = null; // 展开时建的列表
    private shield: Node | null = null; // 点外面关闭的透明遮罩
    private opening = false; // 列表预制体还没回来时，挡住第二次展开
    private openGen = 0; // 收起后丢掉迟到的列表加载
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
        this.index = clampIndex(this.index, this.items.length);
        this.layout();
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
        if (editing || this.list || this.opening || this.items.length === 0) return;
        if (!this.node.isValid || !this.node.parent) return;
        this.opening = true;
        loadOptionPrefab((prefab) => {
            if (!this.opening || !prefab || !this.node.isValid || this.list) {
                if (!this.list) this.opening = false;
                return;
            }
            this.build(prefab);
        });
    }

    /** 收起。点外面、点已选中项、页面切走都走这里 */
    close(): void {
        if (!this.list && !this.shield && !this.opening) return;
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

    /** 展开：算上下哪边放得下，建一块 PfGMList，底板用 dropdown_list */
    private build(prefab: Prefab): void {
        const parent = this.node.parent;
        const page = parent?.getComponent(UITransform) ?? null;
        if (!parent || !page) {
            this.opening = false;
            return;
        }
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
        const gen = this.openGen;
        const bundle = assetManager.getBundle(CORE);
        if (!bundle) return this.close();
        bundle.load('PfGMList', Prefab, (err, listPrefab) => {
            if (err || !listPrefab) {
                console.error('[PfGMSelect] 列表预制体加载失败', err);
                if (gen === this.openGen) this.close();
                return;
            }
            if (gen !== this.openGen || !this.node.isValid) return;
            const ts = gu.createTs(listPrefab, { parent, x: pos.x, y: listY });
            if (!(ts instanceof PfGMList) || gen !== this.openGen) {
                ts?.node.destroy();
                return;
            }
            ts.node.getComponent(UITransform)?.setContentSize(width, listH);
            if (!ts.node.getComponent(BlockInputEvents)) ts.node.addComponent(BlockInputEvents);
            ts.setPlate('dropdown_list');
            ts.setPad(PF_GM_SELECT.boardPad);
            ts.setDir(GMListDir.vertical);
            ts.setLineCount(1);
            ts.setCenter(false);
            ts.setItems(prefab, this.items.length, (item, i) => {
                if (!(item instanceof PfGMOption)) return;
                const data = this.items[i];
                item.setIcon(data?.icon ?? '');
                item.setText(data?.text ?? '');
                item.setSelected(i === this.index);
                gu.addClick(item.node, () => this.pick(i), { press: 'none' });
            });
            if (this.index >= 0) ts.scrollToIndex(this.index);
            this.list = ts;
            this.opening = false;
            this.setArrow(true); // 展开就转 180°，向下往上弹都一样
        });
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
        this.openGen++;
        this.opening = false;
        if (this.list?.node.isValid) this.list.node.destroy();
        if (this.shield?.isValid) {
            gu.removeClick(this.shield);
            this.shield.destroy();
        }
        this.list = null;
        this.shield = null;
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
