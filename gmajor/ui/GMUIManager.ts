import {
    BlockInputEvents, Button, Camera, Canvas, Color, director, Game, game, instantiate, Label, Layers, Node, Vec3,
    Prefab, ResolutionPolicy, SceneAsset, Sprite, SpriteFrame, Texture2D, UIOpacity, UITransform, Widget, screen, view,
} from 'cc';
import type { GMAsyncComplete, GMAsyncProgress } from '../resource/GMAsyncCallback';
import type { IGMResource } from '../resource/IGMResource';
import { GMComponent } from './GMComponent';
import { GMLayer, bindLayerMaskTpl } from './GMLayer';
import { PfGMBtn } from './PfGMBtn';
import { GMOverlayHost } from './GMOverlayHost';
import { GMScene } from './GMScene';

const OVERLAY_LAYER = 1 << 19; // 独立层，避免被场景 UI 相机画两次
const LOADING_DELAY = 1.5; // 秒；之后才出转圈
const LOADING_TIMEOUT = 20; // 秒；到期自动 hide
const ENTER_LEAVE_FALLBACK = 5; // 秒；子类忘调 done 时兜底
const PRESS_SCALE = 0.96; // 按下缩小；松开回到按下前
const PRESS_DIM = 0.75; // 按下时底板、图标、字和描边乘这系数
const DESIGN_W = 720; // 跟 settings 里的设计分辨率一致
const DESIGN_H = 1280;

export interface GMOpenSceneOptions {
    bundle: string; // 必填：加载来源 = unbind 占用者
}

export interface GMShowLayerOptions {
    bundle: string; // 必填：加载来源 = unbind 占用者
}

export interface GMLoadingShowOptions {
    delay?: number; // 默认 1.5；Infinity = 一直透明
    timeout?: number; // 默认 20；到期自动 hide 该 key；Infinity = 不自动关
}

export type GMClickPress = 'both' | 'scale' | 'dim' | 'none'; // 默认 both

interface GMPressColor {
    sprite?: Sprite;
    label?: Label;
    color: Color;
    outline?: Color; // Label 描边；松开时写回
}

function dimRgb(c: Color, k: number): Color {
    return new Color(Math.round(c.r * k), Math.round(c.g * k), Math.round(c.b * k), c.a);
}

export interface GMAddClickOpts {
    lockTime?: number; // 秒；有值才锁。默认不锁
    press?: GMClickPress; // 按下反馈。默认 both：缩小并压暗
}

export interface GMCreateTsNodeParm {
    parent?: Node; // 有则入树（激活时当场 onInit）
    active?: boolean;
    x?: number;
    y?: number;
    scale?: number; // 等比
    anchor?: number | { x: number; y: number };
    zIndex?: number; // 落到 siblingIndex；须已有 parent
}

export type GMAlertBtn = (() => void) | { text?: string; cb?: () => void };

export interface GMAlertParams {
    content: string;
    ok?: GMAlertBtn; // 缺省「确定」
    cancel?: GMAlertBtn; // 有则双按钮，缺省「取消」
}

interface LayerItem {
    name: string;
    bundle: string;
    node: Node;
}

interface AlertItem {
    id: string;
    key: string; // content + 按钮文案
    node: Node;
    closing: boolean;
}

/** 视图门面：真场景切换、layer 栈、loading 令牌；persist Overlay；设计分辨率 720×1280，宽适配 */
export class GMUIManager {
    private overlay: Node | null = null;
    private overlayCamera: Camera | null = null;
    private host: GMOverlayHost | null = null;
    private layersRoot: Node | null = null;
    private loadingRoot: Node | null = null;
    private alertsRoot: Node | null = null;
    private loadingVisual: Node | null = null;
    private readonly layers: LayerItem[] = [];
    private readonly alerts: AlertItem[] = [];
    private alertPrefab: Prefab | null = null;
    private alertSeq = 0;
    private readonly alertPending = new Set<string>(); // load 完成前也占去重 key
    readonly loadingNames: string[] = []; // console 一眼能看全
    private running: { name: string; bundle: string } | null = null;
    private readonly pendingBundles = new Set<string>(); // 正在打开、尚未入场结束
    private readonly preparingLayers = new Set<string>();
    private openingScene = false;
    private fitBound = false;
    private lastFitW = 0;
    private lastFitH = 0;
    private clickUnlockAt = 0; // 有 lockTime 的点击共用；无 lockTime 的不查
    private readonly pressBinds = new Map<Node, { start: () => void; end: () => void }>();
    private readonly pressHold = new Map<Node, { scale: Vec3; colors: GMPressColor[] }>();
    private maskTpl: Node | null = null;
    private _whiteFrame: SpriteFrame | null = null;

    constructor(private readonly resource: IGMResource) {}

    /** 核心启动：设计分辨率锁 720×1280、宽适配；窗口变了只重铺 Overlay */
    bindPixelFit(): void {
        if (this.fitBound) return;
        this.fitBound = true;
        this.applyPixelFit();
        screen.on('window-resize', this.applyPixelFit, this);
        game.once(Game.EVENT_GAME_INITED, this.applyPixelFit, this);
    }

    /** 当前场景或 layer 仍占用这些 Bundle 时，返回中文原因（空数组 = 可 unbind） */
    getUnbindBlockers(bundleNames: string[]): string[] {
        const reasons: string[] = [];
        const hit = (bundle: string): boolean => bundleNames.indexOf(bundle) !== -1;
        if (this.running && hit(this.running.bundle)) {
            reasons.push(`场景 ${this.running.name}（${this.running.bundle}）`);
        }
        for (const one of this.layers) {
            if (hit(one.bundle)) reasons.push(`layer ${one.name}（${one.bundle}）`);
        }
        for (const bundle of this.pendingBundles) {
            if (hit(bundle)) reasons.push(`正在打开（${bundle}）`);
        }
        return reasons;
    }

    ensureOverlay(): void {
        if (this.overlay?.isValid) return;
        const scene = director.getScene();
        if (!scene) return console.error('[gm.ui] 无当前场景，无法创建 Overlay');

        const root = new Node('GMOverlay');
        this.setLayer(root);
        const size = view.getVisibleSize();
        root.addComponent(UITransform).setContentSize(size.width, size.height);

        const camNode = new Node('Camera');
        this.setLayer(camNode);
        root.addChild(camNode);
        camNode.setPosition(0, 0, 1000);
        const camera = camNode.addComponent(Camera);
        this.overlayCamera = camera;
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.priority = 1024;
        camera.near = 0;
        camera.far = 2000;
        camera.orthoHeight = size.height / 2;
        camera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        camera.visibility = OVERLAY_LAYER;

        const canvas = root.addComponent(Canvas);
        canvas.cameraComponent = camera;
        canvas.alignCanvasWithScreen = true;
        const widget = root.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.alignMode = Widget.AlignMode.ALWAYS;

        this.layersRoot = this.makeFullNode('layers', root);
        this.loadingRoot = this.makeFullNode('loading', root);
        this.alertsRoot = this.makeFullNode('alerts', root); // 最上：等待中也能点确认
        this.makeLayerMaskTpl(root);
        this.loadingRoot.addComponent(BlockInputEvents);
        this.loadingRoot.active = false;
        this.loadingVisual = new Node('visual');
        this.setLayer(this.loadingVisual);
        this.loadingRoot.addChild(this.loadingVisual);
        this.loadingVisual.addComponent(UITransform).setContentSize(200, 80);
        this.loadingVisual.addComponent(UIOpacity).opacity = 0;
        const label = this.loadingVisual.addComponent(Label);
        label.string = 'loading';
        label.fontSize = 36;
        label.color = Color.WHITE;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        this.host = root.addComponent(GMOverlayHost);
        scene.addChild(root);
        director.addPersistRootNode(root);
        this.overlay = root;
        this.syncOverlayToView();
        console.info('[gm.ui] Overlay 已创建');
    }

    openScene(sceneName: string, options: GMOpenSceneOptions, onComplete?: GMAsyncComplete, onProgress?: GMAsyncProgress): void {
        if (!sceneName) return this.fail(onComplete, '[gm.ui] openScene 场景名为空');
        if (!options?.bundle) return this.fail(onComplete, '[gm.ui] openScene 必须带 bundle');
        if (this.openingScene) return this.fail(onComplete, '[gm.ui] 正在切场景，忽略 ' + sceneName);
        this.ensureOverlay();
        if (!this.overlay) return this.fail(onComplete, '[gm.ui] Overlay 未就绪');

        if (this.running?.name === sceneName && this.running.bundle === options.bundle) {
            console.info('[gm.ui] 已是当前场景', sceneName);
            onComplete?.(null);
            return;
        }

        const bundleName = options.bundle;
        const loadingKey = `scene:${bundleName}:${sceneName}`;
        this.openingScene = true;
        this.pendingBundles.add(bundleName);
        this.loadingShow(loadingKey); // 内嵌；调用方不必再调

        const finish = (err: Error | null): void => {
            this.openingScene = false;
            this.pendingBundles.delete(bundleName);
            this.loadingHide(loadingKey);
            if (err) return this.fail(onComplete, err.message);
            onComplete?.(null);
        };

        let leaveDone = false;
        let preloadDone = false;
        let preloadErr: Error | null = null;
        const tryGo = (): void => {
            if (!leaveDone || !preloadDone) return;
            if (preloadErr) return finish(preloadErr);
            this.closeAll();
            this.runBundleScene(bundleName, sceneName, onProgress, finish);
        };

        this.runSceneLeave(() => {
            leaveDone = true;
            tryGo();
        });
        this.preloadBundleScene(bundleName, sceneName, onProgress, (err) => {
            preloadErr = err;
            preloadDone = true;
            tryGo();
        });
    }

    showLayer(layerName: string, options: GMShowLayerOptions, onComplete?: GMAsyncComplete): void {
        if (!layerName) return this.fail(onComplete, '[gm.ui] showLayer 名为空');
        if (!options?.bundle) return this.fail(onComplete, '[gm.ui] showLayer 必须带 bundle');
        this.ensureOverlay();
        if (!this.layersRoot) return this.fail(onComplete, '[gm.ui] Overlay 未就绪');

        const old = this.findLayer(layerName);
        if (old) {
            console.warn('[gm.ui] layer 已存在，拆旧开新', layerName);
            this.destroyLayer(old, true);
        }
        if (this.preparingLayers.has(layerName)) return this.fail(onComplete, `[gm.ui] layer 正在打开: ${layerName}`);

        const bundleName = options.bundle;
        const loadingKey = `layer:${bundleName}:${layerName}`;
        this.preparingLayers.add(layerName);
        this.pendingBundles.add(bundleName);
        this.loadingShow(loadingKey); // 内嵌；调用方不必再调

        this.resource.load(bundleName, layerName, Prefab, (err, prefab) => {
            if (err || !prefab) {
                this.preparingLayers.delete(layerName);
                this.pendingBundles.delete(bundleName);
                this.loadingHide(loadingKey);
                return this.fail(onComplete, err?.message ?? `[gm.ui] 加载 layer 失败: ${layerName}`);
            }
            const node = instantiate(prefab);
            node.parent = this.layersRoot;
            this.setLayer(node); // onInit 里新建的子节点也要跟上 Overlay 层
            const item: LayerItem = { name: layerName, bundle: bundleName, node };
            this.layers.push(item);
            this.preparingLayers.delete(layerName);
            console.info('[gm.ui] 打开 layer', bundleName, layerName);

            this.runHook(node.getComponent(GMLayer), 'onEnter', () => {
                this.pendingBundles.delete(bundleName);
                this.loadingHide(loadingKey);
                onComplete?.(null);
            });
        });
    }

    closeLayer(layerName: string, onComplete?: GMAsyncComplete): void {
        const item = this.findLayer(layerName);
        if (!item) {
            console.info('[gm.ui] closeLayer 未找到', layerName);
            onComplete?.(null);
            return;
        }
        this.runHook(item.node.getComponent(GMLayer), 'onLeave', () => {
            this.destroyLayer(item, true);
            onComplete?.(null);
        });
    }

    /** 立刻拆掉所有 layer（切场景用，不走 onLeave） */
    closeAll(): void {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            this.destroyLayer(this.layers[i], true);
        }
    }

    loadingShow(actionName: string, params: GMLoadingShowOptions = {}): void {
        if (typeof actionName !== 'string' || !actionName) return console.error('[gm.ui] loadingShow 名不合法', actionName);
        this.ensureOverlay();
        if (!this.host || !this.loadingRoot || !this.loadingVisual) return;
        if (this.loadingNames.indexOf(actionName) !== -1) {
            return console.error('[gm.ui] loading 同名', actionName, this.loadingNames);
        }

        const delay = params.delay === undefined ? LOADING_DELAY : params.delay;
        const timeout = params.timeout === undefined ? LOADING_TIMEOUT : params.timeout;
        this.loadingNames.push(actionName);
        this.loadingRoot.active = true;
        if (this.loadingNames.length === 1) this.setVisualOpacity(0);

        if (delay !== Infinity) {
            this.host.scheduleNamed(actionName + ':show', delay, () => {
                if (this.loadingNames.indexOf(actionName) === -1) return;
                this.setVisualOpacity(255);
            });
        }
        if (timeout !== Infinity) {
            this.host.scheduleNamed(actionName + ':hide', timeout, () => {
                console.warn('[gm.ui] loading 超时自动 hide', actionName, timeout);
                this.loadingHide(actionName);
            });
        }
    }

    /** 代码里加 Button 并听 click；同一节点再绑会换掉旧回调。编辑器不用拖 Button。按下默认缩小并压暗 */
    addClick(target: Node, cb: (ev?: unknown) => void, opts?: GMAddClickOpts): void {
        if (!target?.isValid) return;
        if (!target.getComponent(Button)) {
            const btn = target.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            const widget = target.getComponent(PfGMBtn);
            if (widget && !widget.interactive) btn.interactable = false; // 先禁用再注册，不要把按钮重新点亮
        }
        this.bindPress(target, opts?.press ?? 'both');
        target.off(Button.EventType.CLICK);
        target.on(Button.EventType.CLICK, (ev?: unknown) => {
            this.endPress(target); // 先还原外观，再进回调，避免回调里改色被按下状态盖回去
            const underAlert = this.isUnder(target, this.alertsRoot);
            if (!underAlert && this.loadingNames.length > 0) return; // Alert 在 loading 之上，仍可点
            const lock = opts?.lockTime;
            if (lock && lock > 0) {
                const now = Date.now();
                if (now < this.clickUnlockAt) {
                    console.info('[gm.ui] addClick 已锁，忽略', target.name);
                    return;
                }
                this.clickUnlockAt = now + lock * 1000;
            }
            cb(ev);
        });
    }

    /** 卸 click 并拆掉 Button；节点销毁也会自己卸，这是主动摘 */
    removeClick(target: Node): void {
        if (!target?.isValid) return;
        this.endPress(target);
        this.unbindPress(target);
        target.off(Button.EventType.CLICK);
        target.removeComponent(Button);
    }

    private bindPress(target: Node, mode: GMClickPress): void {
        this.endPress(target);
        this.unbindPress(target);
        if (mode === 'none') return;
        const start = () => this.beginPress(target, mode);
        const end = () => this.endPress(target);
        target.on(Node.EventType.TOUCH_START, start);
        target.on(Node.EventType.TOUCH_END, end);
        target.on(Node.EventType.TOUCH_CANCEL, end);
        target.once(Node.EventType.NODE_DESTROYED, () => {
            this.pressHold.delete(target);
            this.pressBinds.delete(target);
        });
        this.pressBinds.set(target, { start, end });
    }

    private unbindPress(target: Node): void {
        const prev = this.pressBinds.get(target);
        if (!prev) return;
        target.off(Node.EventType.TOUCH_START, prev.start);
        target.off(Node.EventType.TOUCH_END, prev.end);
        target.off(Node.EventType.TOUCH_CANCEL, prev.end);
        this.pressBinds.delete(target);
    }

    private beginPress(target: Node, mode: GMClickPress): void {
        if (!target.isValid || this.pressHold.has(target)) return;
        const button = target.getComponent(Button);
        if (button && !button.interactable) return;
        const scale = target.scale.clone();
        const colors: GMPressColor[] = [];
        if (mode === 'both' || mode === 'dim') this.dimTree(target, colors);
        if (mode === 'both' || mode === 'scale') target.setScale(scale.x * PRESS_SCALE, scale.y * PRESS_SCALE, scale.z);
        this.pressHold.set(target, { scale, colors });
    }

    private endPress(target: Node): void {
        const held = this.pressHold.get(target);
        if (!held) return;
        this.pressHold.delete(target);
        if (!target.isValid) return;
        target.setScale(held.scale);
        for (const item of held.colors) {
            if (item.sprite?.isValid) item.sprite.color = item.color;
            if (!item.label?.isValid) continue;
            item.label.color = item.color;
            if (item.outline) item.label.outlineColor = item.outline;
        }
    }

    private dimTree(node: Node, out: GMPressColor[]): void {
        const sprite = node.getComponent(Sprite);
        const label = node.getComponent(Label);
        if (sprite) {
            out.push({ sprite, color: sprite.color.clone() });
            sprite.color = dimRgb(sprite.color, PRESS_DIM);
        }
        if (label) {
            const outline = label.outlineColor.clone();
            out.push({ label, color: label.color.clone(), outline });
            label.color = dimRgb(label.color, PRESS_DIM);
            label.outlineColor = dimRgb(outline, PRESS_DIM);
        }
        for (const child of node.children) this.dimTree(child, out);
    }

    /**
     * instantiate prefab，按常用字段改节点，返回根上 GMComponent（含子类）。
     * 先入树（激活则 onInit），再 init(initParm)。调用方自己 load Prefab。
     */
    createTs(prefab: Prefab, nodeParm?: GMCreateTsNodeParm, initParm?: unknown): GMComponent | null {
        if (!prefab) return this.failTs('[gm.ui] createTs 无 prefab');
        const node = instantiate(prefab);
        const p = nodeParm ?? {};
        if (p.x !== undefined || p.y !== undefined) {
            const pos = node.position;
            node.setPosition(p.x ?? pos.x, p.y ?? pos.y, pos.z);
        }
        if (p.scale !== undefined) node.setScale(p.scale, p.scale, 1);
        if (p.anchor !== undefined) {
            const uit = node.getComponent(UITransform) ?? node.addComponent(UITransform);
            if (typeof p.anchor === 'number') uit.setAnchorPoint(p.anchor, p.anchor);
            else uit.setAnchorPoint(p.anchor.x, p.anchor.y);
        }
        if (p.active !== undefined) node.active = p.active;
        if (p.parent) {
            node.parent = p.parent;
            this.applyLayer(node, p.parent.layer); // 跟父节点同层，否则 UI 相机看不见
        }
        if (p.zIndex !== undefined) {
            if (!node.parent) console.warn('[gm.ui] createTs zIndex 需要 parent');
            else node.setSiblingIndex(p.zIndex);
        }
        const ts = node.getComponent(GMComponent);
        if (!ts) return this.failTs('[gm.ui] createTs 根节点没有 GMComponent', node.name);
        if (initParm !== undefined) ts.init?.(initParm);
        return ts;
    }

    /** 常驻包 onBind 预载后登记；之后 gu.alert 不再 load */
    setAlertPrefab(prefab: Prefab): void {
        this.alertPrefab = prefab;
    }

    /** 系统确认框。字符串 = 仅确定。content+按钮文案相同则不新建 */
    alert(param: string | GMAlertParams): void {
        const p: GMAlertParams = typeof param === 'string' ? { content: param } : param;
        if (!p?.content) return console.error('[gm.ui] alert 无 content');
        const okText = this.btnText(p.ok, '确定');
        const showCancel = p.cancel !== undefined;
        const cancelText = showCancel ? this.btnText(p.cancel, '取消') : '';
        const key = JSON.stringify([p.content, okText, cancelText]);
        for (const one of this.alerts) {
            if (one.key === key && !one.closing && one.node.isValid) {
                return console.info('[gm.ui] alert 重复，忽略', p.content);
            }
        }
        if (this.alertPending.has(key)) return console.info('[gm.ui] alert 重复，忽略', p.content);
        this.ensureOverlay();
        if (!this.alertsRoot) return console.error('[gm.ui] Overlay 未就绪');
        this.alertPending.add(key);
        const open = (prefab: Prefab): void => {
            const id = String(++this.alertSeq);
            const item: AlertItem = { id, key, node: null as unknown as Node, closing: false };
            const ts = this.createTs(prefab, { parent: this.alertsRoot }, {
                content: p.content,
                okText,
                cancelText,
                showCancel,
                onOk: this.btnCb(p.ok),
                onCancel: this.btnCb(p.cancel),
                close: () => this.closeAlertItem(item),
            });
            this.alertPending.delete(key);
            if (!ts) return;
            item.node = ts.node;
            this.alerts.push(item);
            this.runHook(ts as GMLayer, 'onEnter', () => {}, id);
        };
        if (this.alertPrefab) return open(this.alertPrefab);
        this.alertPending.delete(key);
        console.error('[gm.ui] alert 皮未预载，请在常驻包 onBind 里 setAlertPrefab');
    }

    loadingHide(actionName: string): void {
        if (!this.host || !this.loadingRoot) return;
        const index = this.loadingNames.indexOf(actionName);
        if (index !== -1) this.loadingNames.splice(index, 1);
        this.host.unscheduleNamed(actionName + ':show');
        this.host.unscheduleNamed(actionName + ':hide');
        if (this.loadingNames.length === 0) {
            this.setVisualOpacity(0);
            this.loadingRoot.active = false;
        }
    }

    private runBundleScene(bundleName: string, sceneName: string, onProgress: GMAsyncProgress | undefined, finish: (err: Error | null) => void): void {
        const bundle = this.resource.getBundle(bundleName);
        if (!bundle) return finish(new Error(`[gm.ui] Bundle 未加载: ${bundleName}`));
        const done = (err: Error | null, sceneAsset?: SceneAsset): void => {
            if (err || !sceneAsset) return finish(err ?? new Error(`[gm.ui] loadScene 失败: ${bundleName}/${sceneName}`));
            director.runScene(sceneAsset, () => {}, () => {
                this.running = { name: sceneName, bundle: bundleName };
                const script = director.getScene()?.getComponentInChildren(GMScene);
                this.runHook(script, 'onEnter', () => finish(null));
            });
        };
        if (onProgress) bundle.loadScene(sceneName, onProgress, done);
        else bundle.loadScene(sceneName, done);
    }

    private preloadBundleScene(bundleName: string, sceneName: string, onProgress: GMAsyncProgress | undefined, onComplete: GMAsyncComplete): void {
        const bundle = this.resource.getBundle(bundleName);
        if (!bundle) return onComplete(new Error(`[gm.ui] Bundle 未加载: ${bundleName}`));
        const done = (err: Error | null): void => onComplete(err);
        if (onProgress) bundle.preloadScene(sceneName, onProgress, done);
        else bundle.preloadScene(sceneName, done);
    }

    private runSceneLeave(done: () => void): void {
        const script = director.getScene()?.getComponentInChildren(GMScene);
        this.runHook(script, 'onLeave', done);
    }

    private runHook(script: GMLayer | GMScene | null | undefined, hook: 'onEnter' | 'onLeave', done: () => void, tag = ''): void {
        let called = false;
        const name = 'hook:' + hook + (tag ? ':' + tag : '');
        const once = (): void => {
            if (called) return;
            called = true;
            this.host?.unscheduleNamed(name);
            done();
        };
        if (!script) return once();
        this.host?.scheduleNamed(name, ENTER_LEAVE_FALLBACK, () => {
            console.warn('[gm.ui] ' + hook + ' 未调用 done，已兜底');
            once();
        });
        script[hook](once);
    }

    private closeAlertItem(item: AlertItem): void {
        if (item.closing) return;
        item.closing = true;
        const ts = item.node?.isValid ? item.node.getComponent(GMLayer) : null;
        this.runHook(ts, 'onLeave', () => {
            const i = this.alerts.indexOf(item);
            if (i !== -1) this.alerts.splice(i, 1);
            if (item.node?.isValid) item.node.destroy();
        }, item.id);
    }

    private btnText(btn: GMAlertBtn | undefined, fallback: string): string {
        if (btn && typeof btn === 'object' && btn.text) return btn.text;
        return fallback;
    }

    private btnCb(btn: GMAlertBtn | undefined): (() => void) | undefined {
        if (!btn) return undefined;
        if (typeof btn === 'function') return btn;
        return btn.cb;
    }

    private isUnder(node: Node, root: Node | null): boolean {
        if (!root?.isValid) return false;
        let cur: Node | null = node;
        while (cur) {
            if (cur === root) return true;
            cur = cur.parent;
        }
        return false;
    }

    private findLayer(layerName: string): LayerItem | null {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.layers[i].name === layerName && this.layers[i].node.isValid) return this.layers[i];
        }
        return null;
    }

    private destroyLayer(item: LayerItem, fromList: boolean): void {
        console.info('[gm.ui] 关闭 layer', item.bundle, item.name);
        if (fromList) {
            const i = this.layers.indexOf(item);
            if (i !== -1) this.layers.splice(i, 1);
        }
        if (item.node.isValid) item.node.destroy();
    }

    private makeFullNode(name: string, parent: Node): Node {
        const node = new Node(name);
        this.setLayer(node);
        parent.addChild(node);
        node.addComponent(UITransform).setContentSize(view.getVisibleSize());
        const widget = node.addComponent(Widget);
        widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
        widget.top = widget.bottom = widget.left = widget.right = 0;
        widget.alignMode = Widget.AlignMode.ALWAYS;
        return node;
    }

    private makeLayerMaskTpl(parent: Node): void {
        const node = new Node('layerMaskTpl');
        this.setLayer(node);
        parent.addChild(node);
        node.active = false;
        const size = view.getVisibleSize();
        node.addComponent(UITransform).setContentSize(size.width, size.height);
        node.addComponent(BlockInputEvents);
        node.addComponent(UIOpacity).opacity = 255;
        const sp = node.addComponent(Sprite);
        sp.spriteFrame = this.whiteFrame();
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(0, 0, 0, 160);
        bindLayerMaskTpl(node);
        this.maskTpl = node;
    }

    private whiteFrame(): SpriteFrame {
        if (this._whiteFrame?.isValid) return this._whiteFrame;
        const tex = new Texture2D();
        tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
        tex.uploadData(new Uint8Array(16).fill(255));
        const frame = new SpriteFrame();
        frame.texture = tex;
        this._whiteFrame = frame;
        return frame;
    }

    private setLayer(node: Node): void {
        this.applyLayer(node, OVERLAY_LAYER);
    }

    private applyLayer(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyLayer(child, layer);
    }

    private failTs(message: string, extra?: unknown): null {
        if (extra !== undefined) console.error(message, extra);
        else console.error(message);
        return null;
    }

    private setVisualOpacity(opacity: number): void {
        const op = this.loadingVisual?.getComponent(UIOpacity);
        if (op) op.opacity = opacity;
    }

    private fail(onComplete: GMAsyncComplete | undefined, message: string): void {
        console.error(message);
        onComplete?.(new Error(message));
    }

    /** 设计分辨率始终是 720×1280。宽适配：窗口再变，也只改可见高度，不改设计分辨率 */
    private applyPixelFit(): void {
        if (this.lastFitW !== DESIGN_W || this.lastFitH !== DESIGN_H) {
            this.lastFitW = DESIGN_W;
            this.lastFitH = DESIGN_H;
            view.setDesignResolutionSize(DESIGN_W, DESIGN_H, ResolutionPolicy.FIXED_WIDTH);
            console.info('[gm.ui] 设计分辨率', DESIGN_W, DESIGN_H);
        }
        this.syncOverlayToView();
    }

    private syncOverlayToView(): void {
        if (!this.overlay?.isValid) return;
        const size = view.getVisibleSize();
        const w = size.width;
        const h = size.height;
        this.overlay.getComponent(UITransform)?.setContentSize(w, h);
        if (this.overlayCamera?.isValid) this.overlayCamera.orthoHeight = h / 2;
        this.maskTpl?.getComponent(UITransform)?.setContentSize(w, h);
        for (const one of this.layers) this.fitLayerChrome(one.node, w, h);
        for (const one of this.alerts) this.fitLayerChrome(one.node, w, h);
    }

    private fitLayerChrome(root: Node, w: number, h: number): void {
        if (!root?.isValid) return;
        root.getComponent(UITransform)?.setContentSize(w, h);
        root.getChildByName('mask')?.getComponent(UITransform)?.setContentSize(w, h);
    }
}
