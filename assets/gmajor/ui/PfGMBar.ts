import { _decorator, Sprite, UITransform } from 'cc';
import { GMComponent } from './GMComponent';
import { applySkin } from './GMSkin';

const { ccclass, executeInEditMode, property } = _decorator;

/**
 * 进度条可调参数。改数字改这里。
 * 宽读根节点，默认 320。高固定 64。四周留白 12。
 * 填充九宫格左右边距之和是 38，窄于这个不画。
 */
const PF_GM_BAR = {
    height: 64,
    pad: 12,
    defaultWidth: 320,
    fillMin: 38,
};

function clamp01(n: number): number {
    if (!(n > 0)) return 0;
    if (n > 1) return 1;
    return n;
}

/** 框架进度条。槽和填充。value 为 0–1，不接收拖动 */
@ccclass('PfGMBar')
@executeInEditMode(true)
export class PfGMBar extends GMComponent {
    private bg: Sprite | null = null;
    private fill: Sprite | null = null;
    private stamp = '';

    @property({ min: 0, max: 1, step: 0.01 })
    value = 0.5;

    onInit(): void {
        if (!this.bindNodes()) return console.error('[PfGMBar] 需要子节点 bg 和 fill');
        this.dress(this.bg, 'BarBg');
        this.dress(this.fill, 'BarFill');
        this.layout();
    }

    update(): void { // 检查器或拉宽后重排。编辑态和运行态同一条
        const uit = this.node.getComponent(UITransform);
        if (!uit || !this.bg) return;
        const mark = `${this.value}|${uit.width}|${uit.height}`;
        if (mark === this.stamp) return;
        this.value = clamp01(this.value);
        this.layout();
    }

    /** 改比例。不发通知 */
    setValue(value: number): void {
        this.value = clamp01(value);
        this.layout();
    }

    private bindNodes(): boolean {
        this.bg = this.node.getChildByName('bg')?.getComponent(Sprite) ?? null;
        this.fill = this.node.getChildByName('fill')?.getComponent(Sprite) ?? null;
        return !!(this.bg && this.fill);
    }

    private layout(): void {
        const uit = this.node.getComponent(UITransform);
        const bg = this.bg;
        const fill = this.fill;
        if (!uit || !bg || !fill) return;
        this.value = clamp01(this.value);
        const width = uit.width > 0 ? uit.width : PF_GM_BAR.defaultWidth;
        uit.setContentSize(width, PF_GM_BAR.height);
        bg.node.getComponent(UITransform)?.setContentSize(width, PF_GM_BAR.height);
        bg.node.setPosition(0, 0, 0);
        const pad = PF_GM_BAR.pad;
        const inner = Math.max(0, width - pad * 2);
        const fillW = inner * this.value;
        const node = fill.node;
        const show = this.value > 0 && fillW >= PF_GM_BAR.fillMin;
        node.active = show;
        if (show) {
            const fut = node.getComponent(UITransform);
            fut?.setAnchorPoint(0, 0.5); // 从左侧往右长。根锚点仍是中心
            fut?.setContentSize(fillW, PF_GM_BAR.height - pad * 2);
            node.setPosition(-width / 2 + pad, 0, 0);
        }
        this.stamp = `${this.value}|${uit.width}|${uit.height}`;
    }

    private dress(sprite: Sprite | null, name: string): void {
        if (!sprite) return;
        applySkin(name, (frame) => {
            if (!sprite.isValid) return;
            sprite.spriteFrame = frame;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SLICED;
        });
    }
}
