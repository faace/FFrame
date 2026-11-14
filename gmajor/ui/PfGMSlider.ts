import { _decorator, BlockInputEvents, EventTouch, Mask, Node, Sprite, UITransform, Vec3 } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 滑条可调参数。改数字改这里。
 * 宽读根节点，默认 280。高固定：触摸根 44，轨道 28，滑块 44。
 * 滑块中心可以到轨道最左和最右，半颗会伸出轨道。轨道九宫格，滑块不切。
 * 填充不拉伸：整条填充图保持轨道宽度，外面套一个裁剪节点，只露出左缘到滑块中心那一段。编辑器里不显示填充。
 */
const PF_GM_SLIDER = {
    height: 44, // 触摸根。滑块上下缘都在里面
    trackHeight: 28,
    thumb: 44,
    minWidth: 44, // 窄于滑块时夹到这里，滑块停住
    fillMin: 28, // 填充窄于这个不画，两端圆角放不下
    inset: 4, // 滑块中心离轨道两端各收进的距离
};

const editing = EDITOR && !PREVIEW;

function clamp01(n: number): number {
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
}

/** 框架滑条。轨道、填充、滑块。value 为 0–1，拖动由控件自己听 */
@ccclass('PfGMSlider')
@executeInEditMode(true)
export class PfGMSlider extends GMComponent {
    private track: Sprite | null = null;
    private thumb: Sprite | null = null;
    private fill: Sprite | null = null; // 可选：没有 fill 子节点时不画
    private clip: Node | null = null; // 运行时建的裁剪节点，填充在它里面
    private drag = false;
    private touched = false;
    private onChange: ((value: number) => void) | null = null;

    // 0–1。检查器改它走 setter，当场重派
    private _value = 0.5;

    @property({ min: 0, max: 1, step: 0.01 })
    get value(): number {
        return this._value;
    }
    set value(v: number) {
        const next = clamp01(v);
        if (this._value === next) return; // 跟引擎 Label.string 一样，值没变就不重排
        this._value = next;
        this.layout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMSlider] 需要子节点 track 和 thumb');
        if (!this.node.getComponent(BlockInputEvents)) this.node.addComponent(BlockInputEvents); // 热区用根的 44 高，不在根上挂会把子节点透明度乘成 0 的 Sprite
        this.wrapFill();
        this.dress(this.track, 'slider_track', true);
        this.dress(this.fill, 'slider_fill', true);
        this.dress(this.thumb, 'slider_thumb', false);
        this.layout();
        this.node.on(Node.EventType.SIZE_CHANGED, this.layout, this); // 宽被改时跟着重排
        if (editing) return;
        this.bindTouch();
    }

    onRemove(): void {
        this.node.off(Node.EventType.SIZE_CHANGED, this.layout, this);
        if (!this.touched) return;
        const node = this.node;
        node.off(Node.EventType.TOUCH_START, this.onPointerDown, this);
        node.off(Node.EventType.TOUCH_MOVE, this.onPointerMove, this);
        node.off(Node.EventType.TOUCH_END, this.onPointerUp, this);
        node.off(Node.EventType.TOUCH_CANCEL, this.onPointerUp, this);
    }

    /** 改值。不调用 onChange */
    setValue(value: number): void {
        this.value = clamp01(value);
    }

    /** 只在手指按下或移动时调用。setValue 不走这里 */
    setOnChange(cb: ((value: number) => void) | null): void {
        this.onChange = cb;
    }

    /** 运行时把填充放进裁剪节点（Mask），放在原位置，不改预制体。编辑器里填充隐藏 */
    private wrapFill(): void {
        const fill = this.fill?.node;
        if (!fill) return;
        if (editing) {
            fill.active = false;
            return;
        }
        if (fill.parent?.name === 'fillClip') {
            this.clip = fill.parent;
            return;
        }
        const idx = fill.getSiblingIndex();
        const clip = new Node('fillClip');
        clip.layer = this.node.layer; // 跟根同层，否则 Overlay 相机不画裁剪窗口，填充整块消失
        clip.addComponent(UITransform);
        clip.addComponent(Mask).type = Mask.Type.RECT;
        this.node.addChild(clip);
        clip.setSiblingIndex(idx);
        clip.addChild(fill);
        this.clip = clip;
    }

    private bindNodes(): boolean {
        this.track = this.node.getChildByName('track')?.getComponent(Sprite) ?? null;
        this.thumb = this.node.getChildByName('thumb')?.getComponent(Sprite) ?? null;
        this.fill = this.node.getChildByName('fill')?.getComponent(Sprite) ?? null;
        return !!(this.track && this.thumb);
    }

    private bindTouch(): void {
        this.touched = true;
        const node = this.node;
        node.on(Node.EventType.TOUCH_START, this.onPointerDown, this);
        node.on(Node.EventType.TOUCH_MOVE, this.onPointerMove, this);
        node.on(Node.EventType.TOUCH_END, this.onPointerUp, this);
        node.on(Node.EventType.TOUCH_CANCEL, this.onPointerUp, this);
    }

    private onPointerDown(ev: EventTouch): void {
        if (gu.loadingNames.length > 0) { // 这次手势整段丢掉
            this.drag = false;
            return;
        }
        this.drag = true;
        this.pointer(ev);
    }

    private onPointerMove(ev: EventTouch): void {
        if (!this.drag) return;
        if (gu.loadingNames.length > 0) {
            this.drag = false;
            return;
        }
        this.pointer(ev);
    }

    private onPointerUp(): void {
        this.drag = false;
    }

    private pointer(ev: EventTouch): void {
        const uit = this.node.getComponent(UITransform);
        if (!uit) return;
        const p = ev.getUILocation();
        const local = uit.convertToNodeSpaceAR(new Vec3(p.x, p.y, 0));
        const next = this.valueAt(local.x, this.width());
        if (next === this._value) return;
        const before = this._value;
        this.value = next;
        if (this._value !== before) this.onChange?.(this._value);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const track = this.track;
        const thumb = this.thumb;
        if (!uit || !track || !thumb) return; // 反序列化时 setter 先跑，那会儿还没绑节点
        this._value = clamp01(this._value);
        const width = this.width();
        const thumbSize = PF_GM_SLIDER.thumb;
        track.node.getComponent(UITransform)?.setContentSize(width, PF_GM_SLIDER.trackHeight);
        track.node.setPosition(0, 0, 0);
        thumb.node.getComponent(UITransform)?.setContentSize(thumbSize, thumbSize);
        const span = width - PF_GM_SLIDER.inset * 2;
        const x = -span / 2 + this._value * span; // 滑块中心在两端各收 inset，半颗伸出轨道
        thumb.node.setPosition(x, 0, 0);
        const fill = this.fill;
        const clip = this.clip;
        if (fill && clip) { // 裁剪窗口：左缘到滑块中心。填充图本身保持整条宽度，不拉伸
            const fillW = x + width / 2;
            const show = this._value > 0 && fillW >= PF_GM_SLIDER.fillMin;
            clip.active = show;
            if (show) {
                const cut = clip.getComponent(UITransform);
                cut?.setAnchorPoint(0, 0.5);
                cut?.setContentSize(fillW, PF_GM_SLIDER.trackHeight);
                clip.setPosition(-width / 2, 0, 0);
                const full = fill.node.getComponent(UITransform);
                full?.setAnchorPoint(0, 0.5);
                full?.setContentSize(width, PF_GM_SLIDER.trackHeight);
                fill.node.setPosition(0, 0, 0);
            }
        }
    }

    /** 根宽。窄于滑块则夹到滑块宽，高始终是触摸根 */
    private width(): number {
        const uit = this.node.getComponent(UITransform);
        const width = !uit || uit.width < PF_GM_SLIDER.minWidth ? PF_GM_SLIDER.minWidth : uit.width;
        uit?.setContentSize(width, PF_GM_SLIDER.height);
        return width;
    }

    /** 0 左缘对齐，1 右缘对齐。可走长度为 0 时不改值 */
    private valueAt(localX: number, width: number): number {
        const span = width - PF_GM_SLIDER.inset * 2;
        if (span <= 0) return this._value;
        return clamp01((localX + span / 2) / span); // 滑块中心：左端 0，右端 1
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
}
