import { _decorator, Color, Label, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';
import { PfGMBtn } from './PfGMBtn';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 步进可调参数。改数字改这里。
 * 数字板 140×72，字 28 号深墨。按钮是嵌套的中档纯图标，间距 16。
 */
const PF_GM_STEPPER = {
    plateW: 140,
    plateH: 72,
    fontSize: 28,
    ink: [92, 64, 32] as const,
};

function whole(n: number, fallback: number): number {
    const r = Math.round(n);
    return Number.isFinite(r) ? r : fallback;
}

/** 框架步进。减号和加号是嵌套的 PfGMBtn。点按由外层 gu.addClick 注册 */
@ccclass('PfGMStepper')
@executeInEditMode(true)
export class PfGMStepper extends GMComponent {
    private plate: Sprite | null = null;
    private label: Label | null = null;
    private minusBtn: PfGMBtn | null = null;
    private plusBtn: PfGMBtn | null = null;
    private stamp = '';

    @property
    value = 3;

    @property
    min = 0;

    @property
    max = 10;

    @property
    step = 1;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMStepper] 需要 plate、label、btnMinus、btnPlus');
        if (this.label!.isSystemFontUsed || !this.label!.font) console.error('[PfGMStepper] label 未挂 assets/gmajor/fonts/main.ttf');
        this.dress();
        this.layout();
    }

    update(): void { // 检查器改了属性就收成整数并刷新两边的禁用
        const mark = `${this.value}|${this.min}|${this.max}|${this.step}`;
        if (mark === this.stamp) return;
        this.layout();
    }

    /** 收成整数再夹进 min–max。改中间的字，并刷新加减的禁用 */
    setValue(value: number): void {
        this.value = value;
        this.layout();
    }

    private bindNodes(): boolean {
        this.plate = this.node.getChildByName('plate')?.getComponent(Sprite) ?? null;
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        this.minusBtn = this.node.getChildByName('btnMinus')?.getComponent(PfGMBtn) ?? null;
        this.plusBtn = this.node.getChildByName('btnPlus')?.getComponent(PfGMBtn) ?? null;
        return !!(this.plate && this.label && this.minusBtn && this.plusBtn);
    }

    private layout(): void {
        const plate = this.plate;
        const label = this.label;
        if (!plate || !label) return;
        this.step = whole(this.step, 1);
        if (this.step < 1) this.step = 1;
        this.min = whole(this.min, 0);
        this.max = whole(this.max, this.min);
        if (this.max < this.min) this.max = this.min;
        this.value = whole(this.value, this.min);
        if (this.value < this.min) this.value = this.min;
        if (this.value > this.max) this.value = this.max;
        const put = plate.node.getComponent(UITransform);
        put?.setContentSize(PF_GM_STEPPER.plateW, PF_GM_STEPPER.plateH);
        plate.node.setPosition(0, 0, 0);
        const ink = PF_GM_STEPPER.ink;
        label.string = String(this.value);
        label.fontSize = PF_GM_STEPPER.fontSize;
        label.lineHeight = PF_GM_STEPPER.fontSize;
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        label.enableWrapText = false;
        label.enableOutline = false;
        const lut = label.node.getComponent(UITransform);
        lut?.setContentSize(PF_GM_STEPPER.plateW, PF_GM_STEPPER.plateH);
        label.node.setPosition(0, 0, 0);
        this.minusBtn?.setEnabled(this.value > this.min);
        this.plusBtn?.setEnabled(this.value < this.max);
        this.stamp = `${this.value}|${this.min}|${this.max}|${this.step}`;
    }

    private dress(): void {
        const plate = this.plate;
        if (!plate) return;
        applySkin('stepper_plate', (frame) => {
            if (!plate.isValid) return;
            plate.spriteFrame = frame;
            plate.sizeMode = Sprite.SizeMode.CUSTOM;
            plate.type = Sprite.Type.SLICED;
        });
    }
}
