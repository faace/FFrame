import { _decorator, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/** 开关尺寸。宽高都固定。圆钮画在 switch_off / switch_on 里，不拉伸 */
const PF_GM_SWITCH = {
    width: 96,
    height: 48,
};

/** 框架开关。关是浅橡木，开是草地绿。value 为布尔，点击由调用方注册 */
@ccclass('PfGMSwitch')
@executeInEditMode(true)
export class PfGMSwitch extends GMComponent {
    private face: Sprite | null = null;
    private skin = '';
    private onChange: ((value: boolean) => void) | null = null; // 只在 toggle 调，setValue 不走这里

    // 开没开。检查器改它走 setter，当场重派
    private _value = false;

    @property
    get value(): boolean {
        return this._value;
    }
    set value(v: boolean) {
        const next = !!v;
        if (this._value === next) return; // 跟引擎 Label.string 一样，值没变就不重排
        this._value = next;
        this.layout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMSwitch] 需要子节点 face');
        this.layout();
    }

    /** 改开关。不调用 onChange。和检查器同一份 value */
    setValue(value: boolean): void {
        this.value = !!value;
    }

    /** 翻转。调用方在 gu.addClick 里调它，flip 完再回调 */
    toggle(): void {
        this.setValue(!this._value);
        this.onChange?.(this._value);
    }

    /** 只在 toggle 时调用。setValue 不走这里 */
    setOnChange(cb: ((value: boolean) => void) | null): void {
        this.onChange = cb;
    }

    private bindNodes(): boolean {
        this.face = this.node.getChildByName('face')?.getComponent(Sprite) ?? null;
        return !!this.face;
    }

    /** 尺寸固定，外部拉宽也会被按回 96×48 */
    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const face = this.face;
        if (!uit || !face) return; // 反序列化时 setter 先跑，那会儿还没绑节点
        uit.setContentSize(PF_GM_SWITCH.width, PF_GM_SWITCH.height);
        const node = face.node;
        node.getComponent(UITransform)?.setContentSize(PF_GM_SWITCH.width, PF_GM_SWITCH.height);
        node.setPosition(0, 0, 0);
        const name = this._value ? 'switch_on' : 'switch_off';
        if (name !== this.skin) {
            this.skin = name;
            this.dress(face, name);
        }
    }

    private dress(sprite: Sprite, name: string): void {
        applySkin(name, (frame) => {
            if (!sprite.isValid || this.skin !== name) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
