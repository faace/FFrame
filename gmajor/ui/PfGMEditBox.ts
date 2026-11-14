import { _decorator, Color, EditBox, Label, Node, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode } = _decorator;

/** 输入框。高固定 72 跟皮槽一致，宽可以改。字号和两个颜色是这一层唯一要管的事 */
const PF_GM_EDIT_BOX = {
    width: 400, // 跟 ctrl.json 的 input 槽 display 一致
    height: 72,
    maxLength: 32, // 字数上限
    fontSize: 28,
    padX: 19, // 输入区左右内缩。EditBox 自己再往内 2，合计 21，跟上下留白一样
    ink: [92, 64, 32] as const, // 奶油底深墨，不描边
    hintInk: [132, 112, 88] as const, // 占位字浅一档
    skin: 'stepper_plate', // 皮槽。input 槽还没画，临时借步进的数字板；图画好改回 'input'
};

/**
 * 框架输入框。EditBox 挂在子节点 text 上，不挂根：
 * 引擎把 Label 和编辑态的 DOM 输入框都摆在「它所在节点」左边缘 +2 处，
 * 挂根上就会压到皮的内沿；挂内缩过的 text 上，两种状态自动一致。
 * 点击聚焦、光标、输入法、单行、字数上限都由引擎自己做，不加 gu.addClick。
 * 检查器里填初始文字去点 text 上 EditBox 组件的 String，这里不另存一份 text。
 */
@ccclass('PfGMEditBox')
@executeInEditMode(true)
export class PfGMEditBox extends GMComponent {
    private bg: Sprite | null = null;
    private area: Node | null = null; // 输入区，EditBox 挂它身上
    private box: EditBox | null = null;
    private onChange: ((text: string) => void) | null = null; // 每改一个字叫，setText 不走这里
    private onDone: ((text: string) => void) | null = null; // 失焦或回车离开时叫

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMEditBox] 需要子节点 bg、text（挂 EditBox）');
        const box = this.box!;
        if (!box.textLabel || !box.placeholderLabel) return console.error('[PfGMEditBox] EditBox 的 Text Label / Placeholder Label 没指');
        this.checkFont(box.textLabel);
        this.checkFont(box.placeholderLabel);
        box.inputMode = EditBox.InputMode.SINGLE_LINE; // 单行，不要多行
        box.inputFlag = EditBox.InputFlag.DEFAULT; // 不要密码
        box.returnType = EditBox.KeyboardReturnType.DONE;
        box.maxLength = PF_GM_EDIT_BOX.maxLength;
        this.paint(box.textLabel, PF_GM_EDIT_BOX.ink);
        this.paint(box.placeholderLabel, PF_GM_EDIT_BOX.hintInk);
        this.dress();
        this.fit();
        this.node.on(Node.EventType.SIZE_CHANGED, this.fit, this);
        box.node.on(EditBox.EventType.TEXT_CHANGED, this.onTyped, this);
        // 只挂失焦：回车会先发 EDITING_RETURN 再 blur，两处都挂就调两次
        box.node.on(EditBox.EventType.EDITING_DID_ENDED, this.onLeft, this);
    }

    onRemove(): void {
        this.node.off(Node.EventType.SIZE_CHANGED, this.fit, this);
        const box = this.box?.node;
        if (!box) return;
        box.off(EditBox.EventType.TEXT_CHANGED, this.onTyped, this);
        box.off(EditBox.EventType.EDITING_DID_ENDED, this.onLeft, this);
    }

    /** 改字。不调用 onChange / onDone。和检查器同一份，读回用 getText */
    setText(text: string): void {
        if (!this.box) return;
        this.box.string = String(text ?? '');
    }

    /** 当前文字。和检查器、setText 同一份，没初始化时给空串 */
    getText(): string {
        return this.box?.string ?? '';
    }

    /** 每改一个字调一次（输入法在选词完成后触发）。setText 不走这里 */
    setOnChange(cb: ((text: string) => void) | null): void {
        this.onChange = cb;
    }

    /** 失焦或按回车离开时调一次，给最终值。setText 不走这里 */
    setOnDone(cb: ((text: string) => void) | null): void {
        this.onDone = cb;
    }

    private onTyped(): void {
        const box = this.box;
        if (!box) return;
        this.onChange?.(box.string);
    }

    private onLeft(): void {
        const box = this.box;
        if (!box) return;
        this.onDone?.(box.string);
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.area = this.node.getChildByName('text') ?? null;
        this.box = this.area?.getComponent(EditBox) ?? null;
        return !!(this.bg && this.area && this.box);
    }

    private checkFont(label: Label): void {
        label.fontSize = PF_GM_EDIT_BOX.fontSize;
        label.lineHeight = PF_GM_EDIT_BOX.fontSize;
        label.enableOutline = false; // 奶油底上的深色字不描边
    }

    /** 底板跟根同尺寸，输入区按根宽减左右内缩。字和占位字的位置交给引擎，不在这里摆 */
    private fit(): void {
        const uit = this.node.getComponent(UITransform);
        const bg = this.bg;
        const area = this.area;
        if (!uit || !bg || !area) return;
        const width = uit.width > 0 ? uit.width : PF_GM_EDIT_BOX.width; // 宽跟调用方，高固定
        if (uit.width !== width || uit.height !== PF_GM_EDIT_BOX.height) uit.setContentSize(width, PF_GM_EDIT_BOX.height);
        this.rescale(bg.node, width, PF_GM_EDIT_BOX.height);
        this.rescale(area, Math.max(0, width - PF_GM_EDIT_BOX.padX * 2), PF_GM_EDIT_BOX.height);
    }

    private rescale(node: Node, w: number, h: number): void {
        const t = node.getComponent(UITransform);
        if (!t) return;
        if (t.width !== w || t.height !== h) t.setContentSize(w, h);
        if (node.position.x !== 0 || node.position.y !== 0) node.setPosition(0, 0, 0);
    }

    private dress(): void {
        const bg = this.bg;
        if (!bg) return;
        // 临时借 stepper_plate 顶一下：input 槽还没画。图好了把 skin 改回 'input'
        applySkin(PF_GM_EDIT_BOX.skin, (frame) => {
            if (!bg.isValid) return;
            bg.spriteFrame = frame;
            bg.sizeMode = Sprite.SizeMode.CUSTOM;
            bg.type = Sprite.Type.SLICED; // 九宫格拉伸，跟步进的数字板同一张
            this.fit(); // 贴图可能把底板打回原尺寸
        });
    }

    private paint(label: Label, ink: readonly [number, number, number]): void {
        label.color = new Color(ink[0], ink[1], ink[2], 255);
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP; // 单行超长截掉，不换行
        label.enableWrapText = false;
    }
}
