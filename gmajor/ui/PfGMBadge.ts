import { _decorator, Color, Label, Node, Sprite, UIOpacity, UITransform, tween, Tween, Vec3 } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 角标可调参数。改数字改这里。
 * 根固定 40×24，锚点居中，不随内容变尺寸——切模式时不跳动。
 * 点 12×12（源图 24）。数字胶囊 20 高（源图 40），九宫格左右各 9、上下 0，宽度按字数拉。
 * 红面 #E8554E 加同色压暗的边，不用深橄榄绿（和红互补会振动）。
 * 数字白字不描边：20 像素框里描边 3 会吃掉三分之一字高。
 * 不接收点击（raycast 全关），盖在别的控件上不吃它的点击。
 */
const PF_GM_BADGE = {
    width: 40, // 根宽。最长是 99+ 的 36，留 4 余量
    height: 24, // 根高。胶囊 20，上下各留 2
    dot: 12, // 点模式圆点显示尺寸
    capH: 20, // 数字胶囊高，也是九宫格不拉伸的那个方向
    capBorder: 9, // 九宫格左右各 9（源图 18 的一半）
    capPadX: 4, // 胶囊除圆头外再留的左右余量
    capCharW: 8, // 每位数字占的宽。13 号字实测约 7.8
    capMax: 36, // 胶囊宽上限
    max: 99, // 超过显示 99+
    fontSize: 13, // 数字字号。三颗胶囊都按这个画，不随字数缩
    pulseScale: 2.6, // 呼吸：缩放到。12 的点放大后直径 31，波纹才看得出来
    pulseFrom: 140, // 呼吸：起始不透明度
    pulseTime: 1.2, // 呼吸：单程秒
};

/** 数字 → 显示文本。超过 max 显示 max+ */
function countText(n: number): string {
    if (n > PF_GM_BADGE.max) return `${PF_GM_BADGE.max}+`;
    return String(n);
}

/** 文本 → 胶囊宽度。两位数字起每多一位加一个字符宽 */
function capsuleWidth(text: string): number {
    const inner = text.length * PF_GM_BADGE.capCharW + PF_GM_BADGE.capPadX * 2;
    return Math.min(PF_GM_BADGE.capMax, Math.max(PF_GM_BADGE.capH, inner));
}

/**
 * 框架角标。两种模式，互斥，谁后调用谁生效：
 * - setDot()：一颗圆点，不带数字。可以开动效。
 * - setCount(n)：数字模式。n ≤ 0 整个隐藏；n > 99 显示 99+。没有动效。
 * setAnim(on) 只对点模式有效，数字模式下会打 warn 后忽略。
 * 不接收点击。位置和层级由调用方在预制体里摆。
 */
@ccclass('PfGMBadge')
@executeInEditMode(true)
export class PfGMBadge extends GMComponent {
    private pulse: Sprite | null = null;
    private bg: Sprite | null = null;
    private num: Label | null = null;
    private dressed = ''; // 当前 bg 用的槽名，避免重复取图

    private _count = 0; // > 0 走数字模式；<= 0 且 _dot 为 true 走点模式；都没有则隐藏
    private _dot = false;
    private _anim = false;

    @property({ tooltip: '数字模式的值。0 或负数隐藏' })
    get count(): number {
        return this._count;
    }
    set count(v: number) {
        const next = Math.round(Number(v) || 0);
        if (this._count === next) return;
        this._count = next;
        this._dot = false; // 数字模式接管
        this.syncMode();
    }

    @property({ tooltip: '动效开关。只对点模式有效' })
    get anim(): boolean {
        return this._anim;
    }
    set anim(v: boolean) {
        const next = !!v;
        if (this._anim === next) return;
        this._anim = next;
        this.applyAnim();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMBadge] 需要子节点 pulse、bg 和 num');
        if (this.num!.isSystemFontUsed || !this.num!.font) console.error('[PfGMBadge] num 未挂 db://gmajor/fonts/main.ttf');
        this.dress();
        this.syncMode();
    }

    onRemove(): void {
        // 节点销毁前停掉 tween，避免回调打到已销毁的对象上
        if (this.pulse?.node.isValid) Tween.stopAllByTarget(this.pulse.node);
    }

    /** 点模式：一颗圆点，不带数字 */
    setDot(): void {
        this._dot = true;
        this._count = 0;
        this.syncMode();
    }

    /** 数字模式：n ≤ 0 隐藏，n > 99 显示 99+ */
    setCount(n: number): void {
        this.count = n;
    }

    /** 动效开关。只对点模式有效；数字模式下调会打 warn 后忽略 */
    setAnim(on: boolean): void {
        if (on && this._count > 0) {
            return console.warn('[PfGMBadge] 数字模式没有动效，setAnim 忽略');
        }
        this.anim = on;
    }

    /** 整个收起 */
    hide(): void {
        this._dot = false;
        this._count = 0;
        this.syncMode();
    }

    private bindNodes(): boolean {
        this.pulse = this.node.getChildByName('pulse')?.getComponent(Sprite) ?? null;
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.num = this.node.getChildByName('num')?.getComponent(Label) ?? null;
        return !!(this.pulse && this.bg && this.num);
    }

    private dress(): void {
        const pulse = this.pulse;
        const bg = this.bg;
        if (!pulse || !bg) return;
        applySkin('badge', (frame) => {
            if (!pulse.isValid || !bg.isValid) return;
            pulse.spriteFrame = frame;
            pulse.sizeMode = Sprite.SizeMode.CUSTOM;
            pulse.type = Sprite.Type.SIMPLE;
        });
    }

    /** 按当前模式和值重排。点模式取 badge 槽，数字模式取 badge_num 槽 */
    private syncMode(): void {
        const root = this.node.getComponent(UITransform);
        const pulse = this.pulse;
        const bg = this.bg;
        const num = this.num;
        // 反序列化时 setter 先跑，那会儿还没绑节点
        if (!root || !pulse || !bg || !num) return;

        root.setContentSize(PF_GM_BADGE.width, PF_GM_BADGE.height);
        root.setAnchorPoint(0.5, 0.5);

        const isNum = this._count > 0;
        const visible = isNum || this._dot;
        this.node.active = visible;
        if (!visible) {
            this.applyAnim();
            return;
        }

        if (isNum) {
            this.layoutNum(num, bg);
        } else {
            this.layoutDot(bg);
        }
        this.applyAnim();
    }

    /** 点模式：12×12 圆，居中 */
    private layoutDot(bg: Sprite): void {
        const size = PF_GM_BADGE.dot;
        const name = 'badge';
        if (this.dressed !== name) {
            this.dressed = name;
            applySkin(name, (frame) => {
                if (!bg.isValid || this.dressed !== name) return;
                bg.spriteFrame = frame;
                bg.sizeMode = Sprite.SizeMode.CUSTOM;
                bg.type = Sprite.Type.SIMPLE;
            });
        }
        bg.node.getComponent(UITransform)?.setContentSize(size, size);
        bg.node.setPosition(0, 0, 0);
        bg.node.active = true;
        this.num!.node.active = false;
    }

    /** 数字模式：20 高胶囊，宽度按字数拉，白字居中 */
    private layoutNum(num: Label, bg: Sprite): void {
        const text = countText(this._count);
        const w = capsuleWidth(text);
        const name = 'badge_num';
        if (this.dressed !== name) {
            this.dressed = name;
            applySkin(name, (frame) => {
                if (!bg.isValid || this.dressed !== name) return;
                bg.spriteFrame = frame;
                bg.sizeMode = Sprite.SizeMode.CUSTOM;
                bg.type = Sprite.Type.SLICED; // 九宫格横向拉，圆头不走形
            });
        }
        bg.node.getComponent(UITransform)?.setContentSize(w, PF_GM_BADGE.capH);
        bg.node.setPosition(0, 0, 0);
        bg.node.active = true;

        num.string = text;
        num.fontSize = PF_GM_BADGE.fontSize;
        num.lineHeight = PF_GM_BADGE.fontSize;
        num.color = Color.WHITE;
        num.horizontalAlign = Label.HorizontalAlign.CENTER;
        num.verticalAlign = Label.VerticalAlign.CENTER;
        // CLAMP 不缩字号：用 SHRINK 的话，字节点越窄字号越小，
        // 结果是 5 / 12 / 99+ 三颗字号各不相同。
        num.overflow = Label.Overflow.CLAMP;
        num.enableWrapText = false;
        num.enableOutline = false; // 20 像素框里描边会吃掉字高
        // 文字节点给整颗胶囊宽，居中排：窄了会被裁，不缩字号
        const nut = num.node.getComponent(UITransform);
        nut?.setContentSize(w, PF_GM_BADGE.capH);
        num.node.setPosition(0, 0, 0);
        num.node.active = true;
    }

    /**
     * 动效。只有点模式且 anim 为 true 才跑。
     * 缩放和透明度是两条并行的 tween：一条 tween 只认一个目标，
     * 把两个属性塞进同一段 to 会同步线性，淡出会拖尾。
     * 停的时候两个目标都要停并复位，否则会停在半透明放大态，看着像坏了。
     */
    private applyAnim(): void {
        const pulse = this.pulse;
        if (!pulse?.node.isValid) return;
        const node = pulse.node;
        const op = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(op);

        const on = this._anim && this._dot && this._count <= 0;
        if (!on) {
            node.active = false;
            node.setScale(1, 1, 1);
            op.opacity = 0;
            return;
        }

        node.active = true;
        node.getComponent(UITransform)?.setContentSize(PF_GM_BADGE.dot, PF_GM_BADGE.dot);
        node.setPosition(0, 0, 0);
        node.setSiblingIndex(0); // 压在 bg 底下，只有放大到超出才露出来
        this.dressPulse();

        node.setScale(1, 1, 1);
        op.opacity = PF_GM_BADGE.pulseFrom;
        tween(node)
            .repeatForever(
                tween()
                    .set({ scale: new Vec3(1, 1, 1) })
                    .to(PF_GM_BADGE.pulseTime, { scale: new Vec3(PF_GM_BADGE.pulseScale, PF_GM_BADGE.pulseScale, 1) }, { easing: 'sineOut' }),
            )
            .start();
        tween(op)
            .repeatForever(
                tween()
                    .set({ opacity: PF_GM_BADGE.pulseFrom })
                    .to(PF_GM_BADGE.pulseTime, { opacity: 0 }, { easing: 'sineOut' }),
            )
            .start();
    }

    private dressPulse(): void {
        const pulse = this.pulse;
        if (!pulse) return;
        applySkin('badge', (frame) => {
            if (!pulse.isValid) return;
            pulse.spriteFrame = frame;
            pulse.sizeMode = Sprite.SizeMode.CUSTOM;
            pulse.type = Sprite.Type.SIMPLE;
        });
    }
}
