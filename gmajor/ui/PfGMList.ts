import { _decorator, Enum, Mask, Node, Prefab, ScrollBar, ScrollView, Sprite, UITransform } from 'cc';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { GMListItem } from './GMListItem';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 列表可调参数。改数字改这里。
 * 根上的 Sprite 用 panel，四角都是圆角。下拉展开列表仍用 dropdown_list。
 * 子节点 view（Mask）→ content，竖条 scrollBar → bar，横条 scrollBarX → bar。
 * view 和 content 锚点都是 (0.5, 0.5)。不满可视区并且开了居中时，关掉 ScrollView，content 归到 0。
 */
const PF_GM_LIST = {
    width: 480,
    height: 420,
    pad: 20, // panel 九宫格四边都是 20。行落在框里面，不压圆角
    bar: 16, // 滚动条厚，图已经是 16
    barInset: 3,
    autoHide: 0.8, // 停手后渐隐，和下拉列表同一档
    thumbMin: 32,
};

export enum GMListDir {
    vertical = 0, // 上下滚。网格时先从左往右排满一行
    horizontal = 1, // 左右滚。网格时先从上往下排满一列
}
Enum(GMListDir);

/** 框架列表。一次铺完，引擎 ScrollView 滚。不带下拉的盒子、箭头和选中态 */
@ccclass('PfGMList')
@executeInEditMode(true)
export class PfGMList extends GMComponent {
    private viewNode: Node | null = null;
    private content: Node | null = null;
    private scroll: ScrollView | null = null;
    private barV: Node | null = null; // 竖条
    private barH: Node | null = null; // 横条
    private rows: GMListItem[] = [];
    private itemPrefab: Prefab | null = null;
    private itemCount = 0;
    private srcW = 0; // 预制体原来的宽。排版用它，不用已经被拉过的宽
    private srcH = 0;

    @property({ type: Enum(GMListDir) })
    dir = GMListDir.vertical;

    @property
    lineCount = 1; // 1 = 单列或单行；大于 1 是网格

    @property
    center = false; // 不满可视区时居中。超出时不生效

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMList] 需要 view、content、scrollBar、scrollBarX');
        this.dress(this.node.getComponent(Sprite), 'panel');
        this.dress(this.barV?.getComponent(Sprite) ?? null, 'scrollbar');
        this.dress(this.barV?.getChildByName('bar')?.getComponent(Sprite) ?? null, 'scrollbar_thumb');
        this.dress(this.barH?.getComponent(Sprite) ?? null, 'scrollbar');
        this.dress(this.barH?.getChildByName('bar')?.getComponent(Sprite) ?? null, 'scrollbar_thumb');
        const root = this.node.getComponent(UITransform);
        if (root && root.width <= 0) root.setContentSize(PF_GM_LIST.width, PF_GM_LIST.height);
        this.layout();
    }

    /** 换滚动方向。和检查器同一份 dir */
    setDir(dir: GMListDir): void {
        this.dir = dir;
        this.layout();
    }

    /** 每行或每列几个。小于 1 按 1。和检查器同一份 lineCount */
    setLineCount(count: number): void {
        this.lineCount = Math.max(1, Math.round(count) || 1);
        this.layout();
    }

    /** 不满可视区时是否居中。超出可视区时这个开关不改变位置 */
    setCenter(on: boolean): void {
        this.center = !!on;
        this.layout();
    }

    /** 用这个预制体铺 count 行。预制体根上必须是 GMListItem。再调一次就先拆掉旧行 */
    setItems(prefab: Prefab, count: number): void {
        this.itemPrefab = prefab;
        this.itemCount = Math.max(0, Math.round(count) || 0);
        this.rebuild();
        this.layout();
    }

    private bindNodes(): boolean {
        const view = this.node.getChildByName('view');
        const content = view?.getChildByName('content') ?? null;
        const scroll = this.node.getComponent(ScrollView);
        this.viewNode = view;
        this.content = content;
        this.scroll = scroll;
        this.barV = this.node.getChildByName('scrollBar');
        this.barH = this.node.getChildByName('scrollBarX');
        return !!(view && content && scroll && this.barV && this.barH);
    }

    private dress(sprite: Sprite | null, slot: string): void {
        if (!sprite) return;
        applySkin(slot, (frame) => {
            if (!sprite.isValid) return;
            const uit = sprite.node.getComponent(UITransform);
            const w = uit?.width ?? 0;
            const h = uit?.height ?? 0;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SLICED;
            sprite.spriteFrame = frame;
            if (uit && w > 0 && h > 0) uit.setContentSize(w, h);
        });
    }

    private rebuild(): void {
        const content = this.content;
        for (const row of this.rows) {
            if (!row.node.isValid) continue;
            row.node.removeFromParent();
            row.node.destroy();
        }
        this.rows = [];
        const prefab = this.itemPrefab;
        if (!content || !prefab || this.itemCount <= 0) return;
        for (let i = 0; i < this.itemCount; i++) {
            const ts = gu.createTs(prefab, { parent: content });
            if (!(ts instanceof GMListItem)) {
                ts?.node.destroy();
                console.error('[PfGMList] 行根上不是 GMListItem');
                continue;
            }
            ts.node.name = 'item' + i;
            if (this.rows.length === 0) { // 只记第一行的原始尺寸
                const ut = ts.node.getComponent(UITransform);
                this.srcW = ut?.width ?? 0;
                this.srcH = ut?.height ?? 0;
            }
            ts.setIndex(i);
            this.rows.push(ts);
        }
    }

    private layout(): void {
        const view = this.viewNode;
        const content = this.content;
        const scroll = this.scroll;
        const root = this.node.getComponent(UITransform);
        if (!view || !content || !scroll || !root) return;
        const viewUt = view.getComponent(UITransform) ?? view.addComponent(UITransform);
        const contentUt = content.getComponent(UITransform) ?? content.addComponent(UITransform);
        viewUt.setAnchorPoint(0.5, 0.5);
        contentUt.setAnchorPoint(0.5, 0.5);
        if (!view.getComponent(Mask)) view.addComponent(Mask);

        const line = Math.max(1, Math.round(this.lineCount) || 1);
        const vertical = this.dir !== GMListDir.horizontal;
        const sample = this.rows[0]?.node.getComponent(UITransform) ?? null;
        const anchorX = sample?.anchorX ?? 0.5;
        const anchorY = sample?.anchorY ?? 0.5;
        const count = this.rows.length;
        const lines = count > 0 ? Math.ceil(count / line) : 0;
        const cols = count > 0 ? (vertical ? line : lines) : 0;
        const rowN = count > 0 ? (vertical ? lines : line) : 0;

        const rootW = root.width > 0 ? root.width : PF_GM_LIST.width;
        const rootH = root.height > 0 ? root.height : PF_GM_LIST.height;
        const pad = PF_GM_LIST.pad;
        const innerW = Math.max(0, rootW - pad * 2);
        const innerH = Math.max(0, rootH - pad * 2);
        // 滚动那一边用预制体尺寸。另一边铺满整块，滚动条叠在上面，不占这一边
        const overflow = vertical ? rowN * this.srcH > innerH + 0.5 : cols * this.srcW > innerW + 0.5;
        const viewW = innerW;
        const viewH = innerH;
        const cellW = vertical ? Math.max(this.srcW, viewW / line) : this.srcW; // 上下滚，宽铺满，含滚动条那一截
        const cellH = vertical ? this.srcH : Math.max(this.srcH, viewH / line); // 左右滚，高铺满，含滚动条那一截
        const fullW = cols * cellW;
        const fullH = rowN * cellH;
        // 没排满一行或一列时，空位不要算进内容，居中才是两向都在正中
        const tight = this.center && count > 0 && count < line && fullW <= viewW + 0.5 && fullH <= viewH + 0.5;
        const boxCols = tight && vertical ? count : cols;
        const boxRows = tight && !vertical ? count : rowN;
        const contentW = boxCols * cellW;
        const contentH = boxRows * cellH;
        viewUt.setContentSize(viewW, viewH);
        view.setPosition(0, 0, 0);
        contentUt.setContentSize(Math.max(contentW, 0), Math.max(contentH, 0));

        for (let i = 0; i < this.rows.length; i++) {
            const col = vertical ? i % line : Math.floor(i / line);
            const row = vertical ? Math.floor(i / line) : i % line;
            const x = -contentW / 2 + col * cellW + cellW * anchorX;
            const y = contentH / 2 - row * cellH - cellH * (1 - anchorY);
            const node = this.rows[i].node;
            node.getComponent(UITransform)?.setContentSize(cellW, cellH);
            node.setPosition(x, y, 0);
            this.rows[i].onLayout();
        }

        scroll.vertical = vertical;
        scroll.horizontal = !vertical;
        scroll.cancelInnerEvents = true;
        const fitW = contentW <= viewW + 0.5;
        const fitH = contentH <= viewH + 0.5;
        const fits = fitW && fitH;
        const hold = this.center && fits; // 居中只在两向都放得下时生效
        this.placeBar(this.barV, true, vertical && overflow && !hold, viewH);
        this.placeBar(this.barH, false, !vertical && overflow && !hold, viewW);
        scroll.verticalScrollBar = vertical ? this.barV?.getComponent(ScrollBar) ?? null : null;
        scroll.horizontalScrollBar = vertical ? null : this.barH?.getComponent(ScrollBar) ?? null;

        scroll.stopAutoScroll();
        if (hold) {
            scroll.enabled = false;
            content.setPosition(0, 0, 0);
            return;
        }
        scroll.enabled = true;
        if (!fits) {
            if (vertical) scroll.scrollToTop(0);
            else scroll.scrollToLeft(0);
        }
        const pos = content.position;
        const x = fitW ? (contentW - viewW) / 2 : pos.x; // 放得下就靠左
        const y = fitH ? (viewH - contentH) / 2 : pos.y; // 放得下就靠上
        content.setPosition(x, y, 0);
    }

    /** 滚动条叠在内容上。不用时藏起来。横条的图是竖的，转到子节点上再拉 */
    private placeBar(track: Node | null, vertical: boolean, show: boolean, length: number): void {
        if (!track) return;
        track.active = show;
        if (!show) return;
        const root = this.node.getComponent(UITransform);
        const rootW = root?.width ?? PF_GM_LIST.width;
        const rootH = root?.height ?? PF_GM_LIST.height;
        const thick = PF_GM_LIST.bar;
        const span = Math.max(PF_GM_LIST.thumbMin, length - PF_GM_LIST.barInset * 2);
        const ut = track.getComponent(UITransform) ?? track.addComponent(UITransform);
        ut.setAnchorPoint(0.5, 0.5);
        const pad = PF_GM_LIST.pad;
        if (vertical) {
            ut.setContentSize(thick, span);
            track.setPosition(rootW / 2 - pad - thick / 2 - PF_GM_LIST.barInset, 0, 0);
        } else {
            ut.setContentSize(span, thick);
            track.setPosition(0, -rootH / 2 + pad + thick / 2 + PF_GM_LIST.barInset, 0);
        }
        track.setScale(1, 1, 1);
        const thumb = track.getChildByName('bar');
        const thumbUt = thumb?.getComponent(UITransform);
        if (vertical) thumbUt?.setContentSize(thick, Math.max(PF_GM_LIST.thumbMin, span / 3));
        else thumbUt?.setContentSize(Math.max(PF_GM_LIST.thumbMin, span / 3), thick);
        if (vertical) this.straightSkin(track);
        else this.sideSkin(track); // 槽和滑块都是竖图，横放要转 90°，九宫格才沿长边拉
        const sb = track.getComponent(ScrollBar);
        if (!sb) return;
        sb.direction = vertical ? ScrollBar.Direction.VERTICAL : ScrollBar.Direction.HORIZONTAL;
        sb.enableAutoHide = true;
        sb.autoHideTime = PF_GM_LIST.autoHide;
    }

    /** 竖条直接画在槽和滑块上 */
    private straightSkin(track: Node): void {
        this.showHost(track, true);
        const thumb = track.getChildByName('bar');
        if (thumb) this.showHost(thumb, true);
    }

    /** 横条：本体留给 ScrollBar 改尺寸和透明度，图放在转了 -90° 的子节点上 */
    private sideSkin(track: Node): void {
        this.showHost(track, false);
        this.turnFace(track);
        const thumb = track.getChildByName('bar');
        if (!thumb) return;
        this.showHost(thumb, false);
        this.turnFace(thumb);
    }

    private showHost(node: Node, on: boolean): void {
        const host = node.getComponent(Sprite);
        if (host) host.enabled = on;
        const face = node.getChildByName('face');
        if (face) face.active = !on;
    }

    private turnFace(node: Node): void {
        let face = node.getChildByName('face');
        if (!face) {
            face = new Node('face');
            face.layer = node.layer;
            const ut = face.addComponent(UITransform);
            ut.setAnchorPoint(0.5, 0.5);
            const sp = face.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.type = Sprite.Type.SLICED;
            face.setParent(node);
            face.setRotationFromEuler(0, 0, -90); // 竖图的长边转到横轴
        }
        if (node.getChildByName('bar')) face.setSiblingIndex(0); // 槽的图垫在滑块下面，不然只看得到槽
        face.active = true;
        this.syncFace(face);
    }

    /** 引擎每帧改横条槽和滑块的宽、透明度。图在转了 -90° 的子节点上，这里跟着改 */
    lateUpdate(): void {
        const track = this.barH;
        if (!track?.active) return;
        const trackFace = track.getChildByName('face');
        if (trackFace?.active) this.syncFace(trackFace);
        const thumbFace = track.getChildByName('bar')?.getChildByName('face');
        if (thumbFace?.active) this.syncFace(thumbFace);
    }

    private syncFace(face: Node): void {
        const host = face.parent;
        if (!host) return;
        const hut = host.getComponent(UITransform);
        const faceUt = face.getComponent(UITransform);
        const src = host.getComponent(Sprite);
        const dst = face.getComponent(Sprite);
        if (!hut || !faceUt || !dst) return;
        const w = hut.height; // 转 -90° 后，子节点的宽是父节点的厚
        const h = hut.width;
        if (faceUt.width !== w || faceUt.height !== h) faceUt.setContentSize(w, h);
        const x = hut.width * (0.5 - hut.anchorX);
        const y = hut.height * (0.5 - hut.anchorY);
        const pos = face.position;
        if (pos.x !== x || pos.y !== y) face.setPosition(x, y, 0);
        if (src?.spriteFrame && dst.spriteFrame !== src.spriteFrame) {
            dst.sizeMode = Sprite.SizeMode.CUSTOM;
            dst.type = Sprite.Type.SLICED;
            dst.spriteFrame = src.spriteFrame;
        }
        if (src && !dst.color.equals(src.color)) dst.color = src.color.clone();
    }
}
