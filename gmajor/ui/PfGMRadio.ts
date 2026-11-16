import { _decorator, Node, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode } = _decorator;

/** 圆点边长。环和点都是这一边，根锚点在中心 */
const PF_GM_RADIO = 48;

/** 框架单选圆点。只画空心圆和实心点。选中由组 setOn，自己不听点击 */
@ccclass('PfGMRadio')
@executeInEditMode(true)
export class PfGMRadio extends GMComponent {
    private ring: Sprite | null = null;
    private mark: Sprite | null = null;
    private hit: Node | null = null; // 热区。组收集时默认是父节点（行）
    private onRebind: ((prev: Node | null) => void) | null = null;
    private shown = false; // 组写下的显隐。onInit 只按它排，不改回 false

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMRadio] 需要子节点 ring 和 mark');
        this.dress(this.ring, 'radio');
        this.dress(this.mark, 'radio_mark');
        this.layout();
    }

    /** 只改圆点显隐。不回调 */
    setOn(on: boolean): void {
        this.shown = !!on;
        this.layout();
    }

    /** 热区换成这个节点。再绑就换掉上一个 */
    bind(node: Node): void {
        if (!node?.isValid || this.hit === node) return;
        const prev = this.hit;
        this.hit = node;
        this.onRebind?.(prev);
    }

    /** 当前热区。还没绑是 null */
    hitNode(): Node | null {
        return this.hit;
    }

    /** 组登记。bind 换节点时通知组改点击 */
    listenRebind(cb: ((prev: Node | null) => void) | null): void {
        this.onRebind = cb;
    }

    private bindNodes(): boolean {
        this.ring = this.node.getChildByName('ring')?.getComponent(Sprite) ?? null;
        this.mark = this.node.getChildByName('mark')?.getComponent(Sprite) ?? null;
        return !!(this.ring && this.mark);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const ring = this.ring;
        const mark = this.mark;
        if (!uit || !ring || !mark) return;
        uit.setContentSize(PF_GM_RADIO, PF_GM_RADIO);
        this.place(ring);
        this.place(mark);
        mark.node.active = this.shown;
    }

    private place(sprite: Sprite): void {
        sprite.node.getComponent(UITransform)?.setContentSize(PF_GM_RADIO, PF_GM_RADIO);
        sprite.node.setPosition(0, 0, 0);
    }

    private dress(sprite: Sprite, name: string): void {
        applySkin(name, (frame) => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
        });
    }
}
