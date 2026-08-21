import {
    BlockInputEvents, Button, Camera, Canvas, Color, director, Game, game, instantiate, Label, Layers, Node,
    Prefab, ResolutionPolicy, SceneAsset, UIOpacity, UITransform, Widget, screen, view,
} from 'cc';
import type { GMAsyncComplete, GMAsyncProgress } from '../resource/GMAsyncCallback';
import type { IGMResource } from '../resource/IGMResource';
import { GMLayer } from './GMLayer';
import { GMOverlayHost } from './GMOverlayHost';
import { GMScene } from './GMScene';

const OVERLAY_LAYER = 1 << 19; // 独立层，避免被场景 UI 相机画两次
const LOADING_DELAY = 1.5; // 秒；之后才出转圈
const LOADING_TIMEOUT = 20; // 秒；到期自动 hide
const ENTER_LEAVE_FALLBACK = 5; // 秒；子类忘调 done 时兜底

export interface GMOpenSceneOptions {
    bundle: string; // 必填：加载来源 = unbind 占用者
}

export interface GMShowLayerOptions {
    bundle: string; // 必填：加载来源 = unbind 占用者
}

export interface GMLoadingShowOptions {
    delay?: number; // 默认 1.5；Infinity = 一直透明
    timeout?: number; // 默认 20；到期自动 hide 该 key
}

export interface GMAddClickOpts {
    lockTime?: number; // 秒；有值才锁。默认不锁
}

interface LayerItem {
    name: string;
    bundle: string;
    node: Node;
}

/** 视图门面：真场景切换、layer 栈、loading 令牌；persist Overlay；窗=设计分辨率 */
export class GMUIManager {
    private overlay: Node | null = null;
    private overlayCamera: Camera | null = null;
    private host: GMOverlayHost | null = null;
    private layersRoot: Node | null = null;
    private loadingRoot: Node | null = null;
    private loadingVisual: Node | null = null;
    private readonly layers: LayerItem[] = [];
    readonly loadingNames: string[] = []; // console 一眼能看全
    private running: { name: string; bundle: string } | null = null;
    private readonly pendingBundles = new Set<string>(); // 正在打开、尚未入场结束
    private readonly preparingLayers = new Set<string>();
    private openingScene = false;
    private fitBound = false;
    private lastFitW = 0;
    private lastFitH = 0;
    private clickUnlockAt = 0; // 有 lockTime 的点击共用；无 lockTime 的不查

    constructor(private readonly resource: IGMResource) {}

    /** 核心启动：设计分辨率跟窗口逻辑像素走（1 单位 = 1 像素）；resize 再同步 */
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
        this.host.scheduleNamed(actionName + ':hide', timeout, () => {
            console.warn('[gm.ui] loading 超时自动 hide', actionName, timeout);
            this.loadingHide(actionName);
        });
    }

    /** 代码里加 Button 并听 click；同一节点再绑会换掉旧回调。编辑器不用拖 Button */
    addClick(target: Node, cb: (ev?: unknown) => void, opts?: GMAddClickOpts): void {
        if (!target?.isValid) return;
        if (!target.getComponent(Button)) {
            const btn = target.addComponent(Button);
            btn.transition = Button.Transition.NONE;
        }
        target.off(Button.EventType.CLICK);
        target.on(Button.EventType.CLICK, (ev?: unknown) => {
            if (this.loadingNames.length > 0) return; // 按下时还没菊花、松开时已经有
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
        target.off(Button.EventType.CLICK);
        target.removeComponent(Button);
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

    private runHook(script: GMLayer | GMScene | null | undefined, hook: 'onEnter' | 'onLeave', done: () => void): void {
        let called = false;
        const once = (): void => {
            if (called) return;
            called = true;
            this.host?.unscheduleNamed('hook:' + hook);
            done();
        };
        if (!script) return once();
        this.host?.scheduleNamed('hook:' + hook, ENTER_LEAVE_FALLBACK, () => {
            console.warn('[gm.ui] ' + hook + ' 未调用 done，已兜底');
            once();
        });
        script[hook](once);
    }

    private findLayer(layerName: string): LayerItem | null {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (this.layers[i].name === layerName && this.layers[i].node.isValid) return this.layers[i];
        }
        return null;
    }

    private destroyLayer(item: LayerItem, fromList: boolean): void {
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

    private setLayer(node: Node): void {
        node.layer = OVERLAY_LAYER;
        for (const child of node.children) this.setLayer(child);
    }

    private setVisualOpacity(opacity: number): void {
        const op = this.loadingVisual?.getComponent(UIOpacity);
        if (op) op.opacity = opacity;
    }

    private fail(onComplete: GMAsyncComplete | undefined, message: string): void {
        console.error(message);
        onComplete?.(new Error(message));
    }

    /** 逻辑像素 = 物理窗口 / DPR；DPI 缩放以后再grilling */
    private applyPixelFit(): void {
        const dpr = screen.devicePixelRatio || 1;
        const w = Math.max(1, Math.round(screen.windowSize.width / dpr));
        const h = Math.max(1, Math.round(screen.windowSize.height / dpr));
        if (w === this.lastFitW && h === this.lastFitH) return this.syncOverlayToView();
        this.lastFitW = w;
        this.lastFitH = h;
        view.setDesignResolutionSize(w, h, ResolutionPolicy.SHOW_ALL);
        this.syncOverlayToView();
        console.info('[gm.ui] 设计分辨率', w, h);
    }

    private syncOverlayToView(): void {
        if (!this.overlay?.isValid) return;
        const size = view.getVisibleSize();
        this.overlay.getComponent(UITransform)?.setContentSize(size.width, size.height);
        if (this.overlayCamera?.isValid) this.overlayCamera.orthoHeight = size.height / 2;
    }
}
