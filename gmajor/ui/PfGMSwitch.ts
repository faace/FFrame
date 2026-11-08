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
    private stamp = '';

    @property
    value = false;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMSwitch] 需要子节点 face');
        this.layout();
    }

    update(): void { // 检查器改 value 或拉宽后重排。编辑态和运行态同一条
        const uit = this.node.getComponent(UITransform);
        if (!uit || !this.face) return;
        const mark = `${this.value}|${uit.width}|${uit.height}`;
        if (mark === this.stamp) return;
        this.layout();
    }

    /** 改开关。和检查器同一份 value */
    setValue(value: boolean): void {
        this.value = !!value;
        this.layout();
    }

    private bindNodes(): boolean {
        this.face = this.node.getChildByName('face')?.getComponent(Sprite) ?? null;
        return !!this.face;
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const face = this.face;
        if (!uit || !face) return;
        this.value = !!this.value;
        uit.setContentSize(PF_GM_SWITCH.width, PF_GM_SWITCH.height);
        const node = face.node;
        node.getComponent(UITransform)?.setContentSize(PF_GM_SWITCH.width, PF_GM_SWITCH.height);
        node.setPosition(0, 0, 0);
        const name = this.value ? 'switch_on' : 'switch_off';
        if (name !== this.skin) {
            this.skin = name;
            this.dress(face, name);
        }
        this.stamp = `${this.value}|${uit.width}|${uit.height}`;
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
