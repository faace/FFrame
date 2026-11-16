import { _decorator, Color, Label, Sprite, UIOpacity, UITransform, tween, Tween } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/** 一条轻提示的高。GMToastHost 排格子用同一个数 */
export const PF_GM_TOAST_HEIGHT = 72;

/**
 * 一条轻提示的外形。队列、锚点、定时器在 GMToastHost。
 * 槽预留 480×128，这里只用 72：真图中间那条横带要画平，装饰只落九宫格区。
 */
const BAR = {
    width: 480,
    height: PF_GM_TOAST_HEIGHT,
    padX: 16, // 左右留白，再加九宫格左右各 20
    border: 20, // 九宫格左右边；源图 40，图是一半尺寸
    fontSize: 28,
    ink: [92, 64, 32] as const, // 奶油底深墨，不描边
    fadeIn: 0.15,
    fadeOut: 0.2,
};

/** 框架轻提示的一条。不进弹层栈、不挡输入、不接收点击 */
@ccclass('PfGMToast')
@executeInEditMode(true)
export class PfGMToast extends GMComponent {
    private bg: Sprite | null = null;
    private label: Label | null = null;

    @property
    text = '这是一句提示';

    /** 改这一条的字并重排。队列不在这里 */
    setText(text: string): void {
        this.text = text;
        this.layout();
    }

    /** 只淡入这一条 */
    fadeIn(): void {
        const op = this.op();
        Tween.stopAllByTarget(op);
        op.opacity = 0;
        tween(op).to(BAR.fadeIn, { opacity: 255 }).start();
    }

    /** 只淡出这一条，完了通知 Host 销毁 */
    fadeOut(done: () => void): void {
        if (!this.node.isValid) return done();
        const op = this.op();
        Tween.stopAllByTarget(op);
        tween(op).to(BAR.fadeOut, { opacity: 0 }).call(done).start();
    }

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMToast] 需要子节点 bg 和 label');
        if (this.label!.isSystemFontUsed || !this.label!.font) console.error('[PfGMToast] label 未挂 db://gmajor/fonts/main.ttf');
        this.dress();
        this.layout();
    }

    private op(): UIOpacity { // 预制体里已放好；万一被删也补上
        return this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.label = this.node.getChildByName('label')?.getComponent(Label) ?? null;
        return !!(this.bg && this.label);
    }

    private layout(): void {
        const bg = this.bg;
        const label = this.label;
        if (!bg || !label) return;
        const w = BAR.width;
        const h = BAR.height;
        this.node.getComponent(UITransform)?.setContentSize(w, h);
        bg.node.getComponent(UITransform)?.setContentSize(w, h);
        bg.node.setPosition(0, 0, 0);
        const inner = w - BAR.padX * 2 - BAR.border * 2;
        const ink = BAR.ink;
        label.string = this.text;
        label.fontSize = BAR.fontSize;
        label.lineHeight = BAR.fontSize;
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; // 超长缩字号，不换行
        label.enableWrapText = false;
        label.enableOutline = false; // 奶油底上的深色字不描边
        label.node.getComponent(UITransform)?.setContentSize(inner, h);
        label.node.setPosition(0, 0, 0);
    }

    private dress(): void {
        const bg = this.bg;
        if (!bg) return;
        applySkin('toast', (frame) => { // 缺这张是正常的：打一条 warn、给内置白图
            if (!bg.isValid) return;
            bg.spriteFrame = frame;
            bg.sizeMode = Sprite.SizeMode.CUSTOM;
            bg.type = Sprite.Type.SLICED;
        });
    }
}
