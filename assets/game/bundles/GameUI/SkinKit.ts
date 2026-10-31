import { Color, Label, Node, Sprite, SpriteFrame, Texture2D, UITransform, Widget } from 'cc';
import { loadSkin as loadSkinBundle, PfGMBtn, setSkinTheme, skinFrame as readSkin } from 'db://gmajor/index';
import { config } from '../../config';

if (config.skinTheme) setSkinTheme(config.skinTheme); // 编辑器取图早于开机，先定主题

const SLICED = new Set([
    'title_bar', 'panel', 'btn_primary', 'btn_secondary', 'btn_warning', 'btn_neutral', 'btn_info',
    'tab_normal', 'tab_selected', 'stepper_plate', 'slider_track', 'progress_fill', 'bar_bg', 'bar_fill',
]);

/** 旧逐张图的 SpriteFrame uuid。搬进 LegacyV3 后 uuid 不变，用来把预制体上的旧图换成当前主题 */
const LEGACY_SLOT: Record<string, string> = {
    '0e53a6dd-c2a7-4b39-87de-13fc8517c40f@f9941': 'bar_bg',
    '16f21f42-a7a2-49b7-bef4-699b0a27fde0@f9941': 'bar_fill',
    '5d3b001a-4057-449b-a2d8-4360ad000087@f9941': 'btn_info',
    '6c8659ed-ba4c-4bae-856e-4488093b8f09@f9941': 'btn_neutral',
    '075aa98d-9fff-42ff-8f75-29838e2f1f3b@f9941': 'btn_primary',
    '52e1493a-81de-4f8f-898e-085c83bf35e4@f9941': 'btn_secondary',
    'ac6ca380-fe84-43d0-96da-ff64249cbd40@f9941': 'btn_warning',
    '9cfbd4e0-90f4-4688-aa0d-cf4768350c67@f9941': 'frame_select',
    '580da328-23d9-4a00-b335-8cba8ebd4a72@f9941': 'icon_ad',
    'c27b0465-d1a7-47b7-97d5-55c004c6f3c0@f9941': 'icon_close',
    '4986a4a6-c9d4-43ea-a228-fc8f2268af08@f9941': 'icon_diamond',
    '6c8529cd-0b0b-4786-b24e-686ccb340bf2@f9941': 'icon_energy',
    '9795a873-f410-422d-8bf6-2067ee1b5457@f9941': 'icon_gold',
    'b6ea7a5e-4b84-49e8-bb30-f52da60edd66@f9941': 'icon_help',
    '04b21fc9-bef8-4f86-bb35-eb6f25cf9120@f9941': 'icon_minus',
    'a0fe798e-e359-431e-aef5-84842a772f78@f9941': 'icon_music',
    '48fdb5f8-5e45-4263-937f-76e77e54051a@f9941': 'icon_plus',
    '32b96669-a9ae-4bc5-9139-bd1d035b94e7@f9941': 'icon_settings',
    'fb1c73a2-6187-449d-8d38-31ba0dad395e@f9941': 'icon_sfx',
    'f5cd60bb-b119-4432-a9c4-9a59aa476106@f9941': 'panel',
    'aee23aba-4262-42c0-bd58-d03810eae5b5@f9941': 'progress_fill',
    '8d07ec81-2287-418b-ac3b-4a73da311637@f9941': 'slider_thumb',
    '1929048c-26c9-4e62-8ebb-4e611f126238@f9941': 'slider_track',
    '28e65745-b4e7-4dcd-88ba-f04b5db12601@f9941': 'slot_item',
    'b3406ac1-ddfa-4265-88aa-68897d36fd53@f9941': 'stepper_plate',
    'b1f7b927-6f8b-4c4b-96f8-9534f2117ebc@f9941': 'tab_normal',
    '05c42b36-4316-43c2-952c-b59b9d57b614@f9941': 'tab_selected',
    'dd9a36cd-47bd-42b6-86fe-ea7b536602de@f9941': 'title_bar',
};

/** 等开机载入的 Skin 包。已经在内存里则立刻回调 */
export function loadSkin(done: (err: Error | null) => void): void {
    if (config.skinTheme) return loadSkinBundle(config.skinTheme, done);
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

/** 预制体里还指着旧图时，按 uuid 换成当前主题的同名槽。按钮底板仍由 PfGMBtn 自己取 */
export function redress(node: Node): void {
    const btn = node.getComponent(PfGMBtn);
    if (btn?.icon) {
        const slot = LEGACY_SLOT[btn.icon.uuid];
        const frame = slot && skinFrame(slot);
        if (frame && frame !== btn.icon) btn.setIcon(frame);
    } else {
        const sprite = node.getComponent(Sprite);
        const slot = sprite?.spriteFrame ? LEGACY_SLOT[sprite.spriteFrame.uuid] : '';
        if (slot) dress(node, slot);
    }
    node.children.forEach((child) => redress(child));
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
