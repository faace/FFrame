import { Color, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, Widget } from 'cc';
import { loadSkin as loadSkinBundle, skinFrame as readSkin } from 'db://gmajor/index';

const SLICED = new Set([
    'title_bar', 'panel', 'btn_primary', 'btn_secondary', 'btn_warning', 'btn_neutral', 'btn_info',
    'tab_normal', 'tab_selected', 'stepper_plate', 'slider_track', 'progress_fill', 'bar_bg', 'bar_fill',
]);

/** 等开机载入的 Skin 包。已经在内存里则立刻回调 */
export function loadSkin(done: (err: Error | null) => void): void {
    loadSkinBundle(done);
}

export function skinFrame(name: string): SpriteFrame | null { // 未载入时是 null；缺槽是白图
    return readSkin(name);
}

/** 在 parent 下挂一张皮；九宫格件用 SLICED，其余原图 */
export function addSkin(parent: Node, name: string, x: number, y: number, w: number, h: number): Node {
    const node = new Node(name);
    parent.addChild(node);
    node.layer = parent.layer;
    node.setPosition(x, y, 0);
    node.addComponent(UITransform).setContentSize(w, h);
    node.addComponent(Sprite);
    dress(node, name);
    return node;
}

export function addText(parent: Node, text: string, fontSize: number, color: Color, w: number, h: number): Label {
    const node = new Node('label');
    parent.addChild(node);
    node.layer = parent.layer;
    node.addComponent(UITransform).setContentSize(w, h);
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.color = color;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.CLAMP;
    return label;
}

export const skinInk = new Color(92, 64, 32, 255); // 奶油底上的字
export const skinPaper = new Color(248, 238, 211, 255); // 和 v3 底色接近

export function dress(node: Node, name: string): void { // 贴图后锁回自定义尺寸，避免被原图像素撑开
    const frame = skinFrame(name);
    const sp = node.getComponent(Sprite);
    const uit = node.getComponent(UITransform);
    if (!frame || !sp || !uit) return;
    const w = uit.width;
    const h = uit.height;
    sp.spriteFrame = frame;
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.type = SLICED.has(name) ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
    uit.setContentSize(w, h);
}

/** 铺一层奶油底，跟着父节点四边拉伸 */
export function addPaper(parent: Node): Node {
    const node = new Node('paper');
    parent.addChild(node);
    node.layer = parent.layer;
    node.setSiblingIndex(0);
    node.addComponent(UITransform);
    const widget = node.addComponent(Widget);
    widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
    widget.top = widget.bottom = widget.left = widget.right = 0;
    widget.alignMode = Widget.AlignMode.ALWAYS;
    const sp = node.addComponent(Sprite);
    sp.spriteFrame = paperFrame();
    sp.sizeMode = Sprite.SizeMode.CUSTOM;
    sp.color = skinPaper;
    return node;
}

let paper: SpriteFrame | null = null;

function paperFrame(): SpriteFrame {
    if (paper?.isValid) return paper;
    const tex = new Texture2D();
    tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    tex.uploadData(new Uint8Array(16).fill(255));
    paper = new SpriteFrame();
    paper.texture = tex;
    return paper;
}
