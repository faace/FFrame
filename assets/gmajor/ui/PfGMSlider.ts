import { _decorator, BlockInputEvents, EventTouch, Node, Sprite, UITransform, Vec3 } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 滑条可调参数。改数字改这里。
 * 宽读根节点，默认 280。高固定：触摸根 44，轨道 28，滑块 44。
 * 滑块整颗留在轨道宽度里。轨道九宫格，滑块不切。
 */
const PF_GM_SLIDER = {
    height: 44, // 触摸根。滑块上下缘都在里面
    trackHeight: 28,
    thumb: 44,
    minWidth: 44, // 窄于滑块时夹到这里，滑块停住
};

const editing = EDITOR && !PREVIEW;

function clamp01(n: number): number {
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
}

/** 框架滑条。只有轨道和滑块。value 为 0–1，拖动由控件自己听 */
@ccclass('PfGMSlider')
@executeInEditMode(true)
export class PfGMSlider extends GMComponent {
    private track: Sprite | null = null;
    private thumb: Sprite | null = null;
    private stamp = '';
    private drag = false;
    private touched = false;
    private onChange: ((value: number) => void) | null = null;

    @property({ min: 0, max: 1, step: 0.01 })
    value = 0.5;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMSlider] 需要子节点 track 和 thumb');
        if (!this.node.getComponent(BlockInputEvents)) this.node.addComponent(BlockInputEvents); // 热区用根的 44 高，不在根上挂会把子节点透明度乘成 0 的 Sprite
        this.dress(this.track, 'slider_track', true);
        this.dress(this.thumb, 'slider_thumb', false);
        this.layout();
        if (editing) return;
        this.bindTouch();
    }

    onRemove(): void {
        if (!this.touched) return;
        const node = this.node;
        node.off(Node.EventType.TOUCH_START, this.onPointerDown, this);
        node.off(Node.EventType.TOUCH_MOVE, this.onPointerMove, this);
        node.off(Node.EventType.TOUCH_END, this.onPointerUp, this);
        node.off(Node.EventType.TOUCH_CANCEL, this.onPointerUp, this);
    }

    update(): void { // 检查器或拉宽后重排。编辑态和运行态同一条
        const uit = this.node.getComponent(UITransform);
        if (!uit || !this.track) return;
        const mark = `${this.value}|${uit.width}|${uit.height}`;
        if (mark === this.stamp) return;
        this.value = clamp01(this.value);
        this.layout();
    }

    /** 改值。不调用 onChange */
    setValue(value: number): void {
        this.value = clamp01(value);
        this.layout();
    }

    /** 只在手指按下或移动时调用。setValue 不走这里 */
    setOnChange(cb: ((value: number) => void) | null): void {
        this.onChange = cb;
    }

    private bindNodes(): boolean {
        this.track = this.node.getChildByName('track')?.getComponent(Sprite) ?? null;
        this.thumb = this.node.getChildByName('thumb')?.getComponent(Sprite) ?? null;
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
        if (next === this.value) return;
        this.value = next;
        this.layout();
        this.onChange?.(this.value);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const track = this.track;
        const thumb = this.thumb;
        if (!uit || !track || !thumb) return;
        this.value = clamp01(this.value);
        const width = this.width();
        const thumbSize = PF_GM_SLIDER.thumb;
        const travel = width - thumbSize;
        track.node.getComponent(UITransform)?.setContentSize(width, PF_GM_SLIDER.trackHeight);
        track.node.setPosition(0, 0, 0);
        thumb.node.getComponent(UITransform)?.setContentSize(thumbSize, thumbSize);
        const x = travel <= 0 ? 0 : -travel / 2 + this.value * travel;
        thumb.node.setPosition(x, 0, 0);
        this.stamp = `${this.value}|${uit.width}|${uit.height}`;
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
        const travel = width - PF_GM_SLIDER.thumb;
        if (travel <= 0) return clamp01(this.value);
        const left = -width / 2 + PF_GM_SLIDER.thumb / 2;
        return clamp01((localX - left) / travel);
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
