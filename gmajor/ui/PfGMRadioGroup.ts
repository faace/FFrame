import { _decorator, Node } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import { gu } from '../launch/GMLauncher';
import { GMComponent } from './GMComponent';
import { PfGMRadio } from './PfGMRadio';

const { ccclass, executeInEditMode, property } = _decorator;

const editing = EDITOR && !PREVIEW;

/** 还没收集时 count 传 -1，只丢掉非法数字和负数 */
function clampIndex(index: number, count: number): number {
    if (!Number.isFinite(index)) return -1;
    const at = Math.round(index);
    if (count < 0) return at < 0 ? -1 : at;
    if (at < 0 || at >= count) return -1;
    return at;
}

/** 框架单选组。直接子节点一行一颗圆点，顺序即 index。热区是行，点击自己注册 */
@ccclass('PfGMRadioGroup')
@executeInEditMode(true)
export class PfGMRadioGroup extends GMComponent {
    private radios: PfGMRadio[] = [];
    private ready = false;
    private onChange: ((index: number) => void) | null = null; // 只在用户点到另一项时调

    @property
    index = -1; // -1 = 还没有选中

    onInit(): void {
        this.collect();
        this.ready = true;
        this.index = clampIndex(this.index, this.radios.length);
        this.apply();
    }

    /** 改选中。不调用 onChange。越界收成 -1 */
    setIndex(index: number): void {
        this.index = clampIndex(index, this.ready ? this.radios.length : -1);
        if (this.ready) this.apply();
    }

    /** 只在用户点到另一项、并且值变了时调用 */
    setOnChange(cb: ((index: number) => void) | null): void {
        this.onChange = cb;
    }

    private collect(): void {
        this.radios = [];
        for (const row of this.node.children) {
            const found = this.findRadios(row);
            if (found.length !== 1) {
                console.error('[PfGMRadioGroup] 一行要正好一颗圆点', row.name, found.length);
                continue;
            }
            const radio = found[0];
            this.radios.push(radio); // 先入列，bind 里改点击时才查得到序号
            radio.listenRebind((prev) => this.rewire(radio, prev));
            if (!radio.hitNode()) radio.bind(row);
            else this.wire(radio);
        }
    }

    /** 只数行里面的圆点，行自己身上的不算 */
    private findRadios(row: Node): PfGMRadio[] {
        const found: PfGMRadio[] = [];
        const walk = (node: Node): void => {
            const ts = node.getComponent(PfGMRadio);
            if (ts) found.push(ts);
            for (const child of node.children) walk(child);
        };
        for (const child of row.children) walk(child);
        return found;
    }

    private apply(): void {
        for (let i = 0; i < this.radios.length; i++) this.radios[i].setOn(i === this.index);
    }

    private wire(radio: PfGMRadio): void {
        if (editing) return;
        const hit = radio.hitNode();
        if (!hit?.isValid) return;
        gu.addClick(hit, () => this.pick(this.radios.indexOf(radio)), { press: 'none' });
    }

    private rewire(radio: PfGMRadio, prev: Node | null): void {
        if (editing) return;
        const hit = radio.hitNode();
        if (prev?.isValid && prev !== hit) gu.removeClick(prev);
        this.wire(radio);
    }

    /** 点已选项不取消、不回调 */
    private pick(at: number): void {
        if (at < 0 || at >= this.radios.length || at === this.index) return;
        this.index = at;
        this.apply();
        this.onChange?.(this.index);
    }
}
