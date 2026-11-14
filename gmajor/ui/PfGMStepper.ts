import { _decorator, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';
import { PfGMBtn, PfGMBtnSize } from './PfGMBtn';
import { PfGMEditBox, PfGMEditBoxAlign } from './PfGMEditBox';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 步进可调参数。改数字改这里。
 * 中间是 PfGMEditBox（140×72），按钮是嵌套的小档纯图标，间距 16。
 */
const PF_GM_STEPPER = {
    plateW: 140,
    plateH: 72,
    gap: 16,
    btn: 64, // 小档纯图标方钮边长
    maxDigits: 3, // 中间最多几位，够 min–max 用
};

function whole(n: number, fallback: number): number {
    const r = Math.round(n);
    return Number.isFinite(r) ? r : fallback;
}

/** 框架步进。中间是输入框，可直接打字；两边是嵌套的 PfGMBtn。点按由外层 gu.addClick 注册 */
@ccclass('PfGMStepper')
@executeInEditMode(true)
export class PfGMStepper extends GMComponent {
    private plate: PfGMEditBox | null = null;
    private minusBtn: PfGMBtn | null = null;
    private plusBtn: PfGMBtn | null = null;
    private onChange: ((value: number) => void) | null = null; // 只在用户操作时调，setValue 不走这里

    // 字段本体。外部只通过上面的 setter 改，改了就重排
    private _value = 3;
    private _min = 0;
    private _max = 10;
    private _step = 1;

    @property
    get value(): number {
        return this._value;
    }
    set value(v: number) {
        if (this._value === v) return; // 跟引擎 Label.string 一样，值没变就不重排
        this._value = v;
        this.layout();
    }

    @property
    get min(): number {
        return this._min;
    }
    set min(v: number) {
        if (this._min === v) return;
        this._min = v;
        this.layout();
    }

    @property
    get max(): number {
        return this._max;
    }
    set max(v: number) {
        if (this._max === v) return;
        this._max = v;
        this.layout();
    }

    @property
    get step(): number {
        return this._step;
    }
    set step(v: number) {
        if (this._step === v) return;
        this._step = v;
        this.layout();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMStepper] 需要 plate、btnMinus、btnPlus');
        this.minusBtn?.setSize(PfGMBtnSize.small);
        this.plusBtn?.setSize(PfGMBtnSize.small);
        applySkin('icon_minus', (frame) => { if (this.minusBtn?.isValid) this.minusBtn.setIcon(frame); });
        applySkin('icon_plus', (frame) => { if (this.plusBtn?.isValid) this.plusBtn.setIcon(frame); });
        const plate = this.plate!;
        plate.configure(true, PF_GM_STEPPER.maxDigits); // 只收数字，移动端弹数字键盘
        plate.setAlign(PfGMEditBoxAlign.center); // 数字居中，跟两边加减对称
        plate.setOnDone((text) => this.commit(text)); // 中间打完字离开：夹紧、回写、回调
        this.layout();
    }

    onStart(): void {
        // 嵌套的 PfGMEditBox 的 onInit 比外层晚，那会儿 setText 还写不进去，这里补一次
        this.layout();
    }

    /** 收成整数再夹进 min–max。改中间的字，并刷新加减的禁用。不调用 onChange */
    setValue(value: number): void {
        this.clampIn(whole(value, this._value));
        this.layout();
    }

    /**
     * 走一步。调用方在 gu.addClick 里调它。
     * 先把中间输入框里没提交的字收进来，再加减；夹完等于原值时不回调。
     */
    stepBy(delta: number): void {
        const typed = Number(this.plate?.getText() ?? '');
        const before = this._value;
        const base = Number.isFinite(typed) ? whole(typed, before) : before;
        this.clampIn(base + whole(delta, 0));
        this.layout();
        if (this._value !== before) this.onChange?.(this._value);
    }

    /** 只在用户操作时调用。setValue 不走这里 */
    setOnChange(cb: ((value: number) => void) | null): void {
        this.onChange = cb;
    }

    private bindNodes(): boolean {
        this.plate = this.node.getChildByName('plate')?.getComponent(PfGMEditBox) ?? null;
        this.minusBtn = this.node.getChildByName('btnMinus')?.getComponent(PfGMBtn) ?? null;
        this.plusBtn = this.node.getChildByName('btnPlus')?.getComponent(PfGMBtn) ?? null;
        return !!(this.plate && this.minusBtn && this.plusBtn);
    }

    /** 中间打完字离开：夹紧后回写，值真的变了才回调 */
    private commit(text: string): void {
        const typed = Number(text);
        const before = this._value;
        this.clampIn(Number.isFinite(typed) ? whole(typed, before) : before);
        this.layout();
        if (this._value !== before) this.onChange?.(this._value);
    }

    /** 把四个值收成合法整数并夹进范围。直接写字段，不走 setter，避免 layout 递归 */
    private clampIn(value: number): void {
        this._step = whole(this._step, 1);
        if (this._step < 1) this._step = 1;
        this._min = whole(this._min, 0);
        this._max = whole(this._max, this._min);
        if (this._max < this._min) this._max = this._min;
        this._value = Number.isFinite(value) ? whole(value, this._min) : this._min;
        if (this._value < this._min) this._value = this._min;
        if (this._value > this._max) this._value = this._max;
    }

    private layout(): void {
        const plate = this.plate;
        if (!plate) return; // 反序列化时 setter 会先跑，那会儿还没绑节点
        this.clampIn(this._value);
        const put = plate.node.getComponent(UITransform);
        put?.setContentSize(PF_GM_STEPPER.plateW, PF_GM_STEPPER.plateH);
        plate.node.setPosition(0, 0, 0);
        plate.setText(String(this._value)); // setText 不触发任何回调
        const x = PF_GM_STEPPER.plateW / 2 + PF_GM_STEPPER.gap + PF_GM_STEPPER.btn / 2;
        this.minusBtn?.setEnabled(this._value > this._min); // 先停抖，再写位置，避免启用时被拉回抖之前的坐标
        this.plusBtn?.setEnabled(this._value < this._max);
        this.minusBtn?.node.setPosition(-x, 0, 0);
        this.plusBtn?.node.setPosition(x, 0, 0);
    }
}
