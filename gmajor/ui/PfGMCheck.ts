import { _decorator, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/** 勾选框边长。框和勾都是这一边，根锚点在中心 */
const PF_GM_CHECK = 48;

/** 框架勾选框。未勾选只显示框，勾选再显示勾。点击由调用方注册 */
@ccclass('PfGMCheck')
@executeInEditMode(true)
export class PfGMCheck extends GMComponent {
    private box: Sprite | null = null;
    private mark: Sprite | null = null;
    private stamp = '';
    private onChange: ((value: boolean) => void) | null = null; // 只在 toggle 调，setValue 不走这里

    @property
    value = false;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMCheck] 需要子节点 box 和 mark');
        this.dress(this.box, 'checkbox');
        this.dress(this.mark, 'checkbox_mark');
        this.layout();
    }

    update(): void { // 检查器改了 value 后刷新勾。编辑态和运行态同一条
        if (!this.box) return;
        const mark = this.value ? '1' : '0';
        if (mark === this.stamp) return;
        this.layout();
    }

    /** 改勾选。不调用 onChange。和检查器同一份 value */
    setValue(value: boolean): void {
        this.value = !!value;
        this.layout();
    }

    /** 翻转。调用方在 gu.addClick 里调它，flip 完再回调 */
    toggle(): void {
        this.setValue(!this.value);
        this.onChange?.(this.value);
    }

    /** 只在 toggle 时调用。setValue 不走这里 */
    setOnChange(cb: ((value: boolean) => void) | null): void {
        this.onChange = cb;
    }

    private bindNodes(): boolean {
        this.box = this.node.getChildByName('box')?.getComponent(Sprite) ?? null;
        this.mark = this.node.getChildByName('mark')?.getComponent(Sprite) ?? null;
        return !!(this.box && this.mark);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const box = this.box;
        const mark = this.mark;
        if (!uit || !box || !mark) return;
        this.value = !!this.value;
        uit.setContentSize(PF_GM_CHECK, PF_GM_CHECK);
        this.place(box);
        this.place(mark);
        mark.node.active = this.value;
        this.stamp = this.value ? '1' : '0';
    }

    private place(sprite: Sprite): void {
        sprite.node.getComponent(UITransform)?.setContentSize(PF_GM_CHECK, PF_GM_CHECK);
        sprite.node.setPosition(0, 0, 0);
    }

    private dress(sprite: Sprite | null, name: string): void {
        if (!sprite) return;
        applySkin(name, (frame) => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
