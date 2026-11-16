/**
 * Web Preview 调试：节点树联动 + UI 改动同步写回 Prefab。
 * 仅由 preview-template/index.ejs 注入，不进入 assets 构建。
 */
(function () {
    'use strict';
    const SYNC_PORT = 7457;
    const DOM_MARK = 'data-web-sync-debug';
    const LAYOUT_PROPS = ['spacingX', 'spacingY', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'];
    const FLOAT_NODE_PROPS = ['width', 'height', 'angle', 'scaleX', 'scaleY'];
    const state = {
        baselineByKey: new Map(),
        accumulatedChanges: new Map(),
        trackedPrefabs: new Set(),
        baselinedPrefabs: new Set(),
        lastVisibleLabel: '',
        isExporting: false,
        domKeyHandler: null,
        syncBtn: null,
        baselineBtn: null,
        statusLabel: null,
        pickBtn: null,
        pickModeActive: false,
        pickHoverNode: null,
        pickOverlay: null,
        pickCanvas: null,
        pickCanvasMouseDown: null,
        pickCanvasMouseMove: null,
        mountBtnTimer: null,
        locateTimers: [],
        tickTimer: null,
        devtoolsButtonsMounted: false,
        syncPanel: null,
        refreshBtn: null,
        cacheBtn: null,
        cacheToggleMounted: false,
        cacheDialogEl: null,
        cacheOnlyTexture: true,
        cacheRawData: [],
        cacheSearchText: '',
        uuidPathMap: null,
        treeRefreshOptions: ['full', 'half', '1000', 'off'],
        treeRefreshLabels: ['刷新·原版', '刷新·½频', '刷新·1s', '刷新·不刷'],
        uiCache: { status: '', baselineText: '', baselineBg: '', syncText: '', syncOpacity: '', statusColor: '', statusBaselined: '' },
    };
    /** 等待 cc 全局就绪 */
    function waitCC() {
        return new Promise((resolve) => {
            const id = setInterval(() => {
                if (window.cc && cc.director) {
                    clearInterval(id);
                    resolve();
                }
            }, 300);
        });
    }
    /** 取 cc 模块 */
    function ccMod() { return window.cc; }
    /** 取当前场景 */
    function getScene() {
        const cc = ccMod();
        return cc && cc.director ? cc.director.getScene() : null;
    }
    /** 标记 DOM 元素归属 web-sync */
    function markDom(el) {
        el.setAttribute(DOM_MARK, '1');
        return el;
    }
    /** 安全 getComponent：Preview 全局 cc 上常无 UITransform 等类引用，用引擎字符串名 */
    function getComp(node, typeName) {
        if (!node || !typeName) return null;
        try {
            const comp = node.getComponent(typeName);
            return comp || null;
        } catch (e) {
            return null;
        }
    }
    /** 读 UITransform */
    function getUI(node) {
        return node ? getComp(node, 'cc.UITransform') : null;
    }
    /** 读节点不透明度 */
    function readOpacity(node) {
        const uiOpacity = getComp(node, 'cc.UIOpacity');
        if (uiOpacity) return uiOpacity.opacity;
        const label = getComp(node, 'cc.Label');
        if (label && label.color) return label.color.a;
        const sprite = getComp(node, 'cc.Sprite');
        if (sprite && sprite.color) return sprite.color.a;
        return 255;
    }
    /** 读节点颜色 */
    function readColor(node) {
        const label = getComp(node, 'cc.Label');
        if (label && label.color) return { r: label.color.r, g: label.color.g, b: label.color.b, a: label.color.a };
        const sprite = getComp(node, 'cc.Sprite');
        if (sprite && sprite.color) return { r: sprite.color.r, g: sprite.color.g, b: sprite.color.b, a: sprite.color.a };
        return { r: 255, g: 255, b: 255, a: 255 };
    }
    /** 写节点颜色到首个渲染组件 */
    function writeColor(node, color) {
        const label = getComp(node, 'cc.Label');
        const sprite = getComp(node, 'cc.Sprite');
        const target = label || sprite;
        if (!target) return;
        const c = target.color;
        c.r = color.r;
        c.g = color.g;
        c.b = color.b;
        c.a = color.a;
        target.color = c;
    }
    /** 快照节点状态（3.x） */
    function readNodeState(node) {
        const pos = node.position;
        const ui = getUI(node);
        const scale = node.scale;
        const st = {
            x: pos.x, y: pos.y,
            width: ui ? ui.contentSize.width : 0,
            height: ui ? ui.contentSize.height : 0,
            angle: node.eulerAngles ? node.eulerAngles.z : 0,
            scaleX: scale.x, scaleY: scale.y,
            opacity: readOpacity(node),
            color: readColor(node),
            spacingX: 0, spacingY: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
        };
        const layout = getComp(node, 'cc.Layout');
        if (layout) LAYOUT_PROPS.forEach((p) => { st[p] = layout[p]; });
        return st;
    }
    /** 遍历场景节点（跳过 scene 根） */
    function forEachSceneNode(fn) {
        const scene = getScene();
        if (!scene) return;
        scene.walk((node) => {
            if (node === scene) return;
            fn(node);
        });
    }
    /** 容器里 sibling 最大、且仍在显示的子节点 */
    function topActiveChild(root) {
        if (!root || !root.children) return null;
        let top = null;
        let topIndex = -1;
        root.children.forEach((child) => {
            if (!child.activeInHierarchy) return;
            const idx = child.getSiblingIndex();
            if (idx >= topIndex) {
                topIndex = idx;
                top = child;
            }
        });
        return top;
    }
    /** 当前页：确认框优先，否则最上面的 layer；都没有则用场景 Canvas */
    function findCurrentPageNode() {
        const scene = getScene();
        if (!scene) return null;
        const overlay = scene.getChildByName('GMOverlay');
        if (overlay) {
            const alert = topActiveChild(overlay.getChildByName('alerts'));
            if (alert) return alert;
            const layer = topActiveChild(overlay.getChildByName('layers'));
            if (layer) return layer;
        }
        return scene.getChildByName('Canvas');
    }
    /** 最外层 prefab 根 */
    function getOutermostPrefabRoot(node) {
        let cur = node;
        let outermost = null;
        while (cur) {
            const prefab = cur._prefab;
            if (prefab && prefab.root === cur) outermost = cur;
            cur = cur.parent;
        }
        return outermost;
    }
    /** 最近 prefab 根 */
    function getNearestPrefabRoot(node) {
        let cur = node;
        while (cur) {
            const prefab = cur._prefab;
            if (prefab && prefab.root === cur) return cur;
            cur = cur.parent;
        }
        return null;
    }
    /** prefab 资源 */
    function getNodePrefabAsset(node) {
        const prefab = node._prefab;
        return prefab && prefab.asset ? prefab.asset : null;
    }
    /** 是否页内嵌套独立 prefab */
    function isForeignNestedPrefabNode(node, pagePrefabRoot) {
        const nearest = getNearestPrefabRoot(node);
        if (!nearest || nearest === pagePrefabRoot) return false;
        const pageAsset = getNodePrefabAsset(pagePrefabRoot);
        const nearAsset = getNodePrefabAsset(nearest);
        if (!pageAsset || !nearAsset) return false;
        if (pageAsset === nearAsset) return false;
        const pageUuid = pageAsset._uuid || pageAsset.uuid;
        const nearUuid = nearAsset._uuid || nearAsset.uuid;
        return !(pageUuid && nearUuid && pageUuid === nearUuid);
    }
    function getNodeFileId(node) {
        const prefab = node._prefab;
        return prefab && prefab.fileId ? prefab.fileId : '';
    }
    function getRelativePath(node, root) {
        const parts = [];
        let cur = node;
        while (cur && cur !== root) {
            parts.unshift(cur.name);
            cur = cur.parent;
        }
        return parts.join('/');
    }
    function getPrefabName(_node, prefabRoot) {
        const prefab = prefabRoot._prefab;
        const asset = prefab && prefab.asset;
        if (asset) {
            const name = asset.name || asset._name || '';
            if (name) return name.replace(/\.prefab$/i, '');
        }
        return prefabRoot.name;
    }
    function getSyncPrefabPath(node, pagePrefabRoot) {
        if (!isForeignNestedPrefabNode(node, pagePrefabRoot)) return getRelativePath(node, pagePrefabRoot);
        const nearest = getNearestPrefabRoot(node);
        if (!nearest || node !== nearest) return null;
        const anchor = nearest.parent;
        if (!anchor) return null;
        const parentPath = getRelativePath(anchor, pagePrefabRoot);
        return parentPath ? `${parentPath}/${nearest.name}` : nearest.name;
    }
    function getChangeKey(node, prefabRoot) {
        const path = getSyncPrefabPath(node, prefabRoot);
        if (!path) return '';
        return `prefab:${getPrefabName(node, prefabRoot)}|${path}`;
    }
    function getPrefabNameFromKey(key) {
        if (!key.startsWith('prefab:')) return null;
        return key.slice('prefab:'.length).split('|')[0] || null;
    }
    function getSyncFileId(node, pagePrefabRoot) {
        if (isForeignNestedPrefabNode(node, pagePrefabRoot)) return '';
        return getNodeFileId(node);
    }
    function fillMountSlotInfo(node, pagePrefabRoot, change) {
        if (!isForeignNestedPrefabNode(node, pagePrefabRoot)) return;
        const nearest = getNearestPrefabRoot(node);
        if (!nearest || node !== nearest || !nearest.parent) return;
        change.mountParentPath = getRelativePath(nearest.parent, pagePrefabRoot);
        change.mountSlotIndex = nearest.getSiblingIndex();
    }
    function isNodeUnderCurrentPage(node) {
        const page = findCurrentPageNode();
        if (!page) return false;
        let cur = node;
        while (cur) {
            if (cur === page) return true;
            cur = cur.parent;
        }
        return false;
    }
    function getCurrentPagePrefabNames() {
        const page = findCurrentPageNode();
        if (!page) return new Set();
        const names = new Set();
        const walk = (node) => {
            const root = getOutermostPrefabRoot(node);
            if (root) names.add(getPrefabName(node, root));
            node.children.forEach((c) => walk(c));
        };
        walk(page);
        return names;
    }
    function getTopVisiblePrefabName() {
        const page = findCurrentPageNode();
        if (!page) return '(无 Prefab 页)';
        const root = getOutermostPrefabRoot(page);
        return root ? getPrefabName(page, root) : page.name;
    }
    function floatDecimals(prop) {
        return prop === 'scaleX' || prop === 'scaleY' ? 2 : 1;
    }
    /** 对比并写入节点属性变更 */
    function appendNodePropChanges(change, node, initialState) {
        let changed = false;
        const pos = node.position;
        if (pos.x.toFixed(1) !== initialState.x.toFixed(1) || pos.y.toFixed(1) !== initialState.y.toFixed(1)) {
            change.x = parseFloat(pos.x.toFixed(1));
            change.y = parseFloat(pos.y.toFixed(1));
            changed = true;
        }
        const ui = getUI(node);
        const width = ui ? ui.contentSize.width : 0;
        const height = ui ? ui.contentSize.height : 0;
        const scale = node.scale;
        const angle = node.eulerAngles ? node.eulerAngles.z : 0;
        const live = { width, height, angle, scaleX: scale.x, scaleY: scale.y };
        FLOAT_NODE_PROPS.forEach((p) => {
            const dec = floatDecimals(p);
            if (live[p].toFixed(dec) === initialState[p].toFixed(dec)) return;
            change[p] = parseFloat(live[p].toFixed(dec));
            changed = true;
        });
        const opacity = readOpacity(node);
        if (opacity !== initialState.opacity) {
            change.opacity = opacity;
            changed = true;
        }
        const c = readColor(node);
        const ic = initialState.color;
        if (c.r !== ic.r || c.g !== ic.g || c.b !== ic.b || c.a !== ic.a) {
            change.color = { r: c.r, g: c.g, b: c.b, a: c.a };
            changed = true;
        }
        return changed;
    }
    function appendLayoutChanges(change, layout, initialState) {
        let changed = false;
        LAYOUT_PROPS.forEach((p) => {
            if (Math.abs(layout[p] - initialState[p]) > 0.05) {
                change[p] = layout[p];
                changed = true;
            }
        });
        return changed;
    }
    function isTrackedNode(node, prefabRoot) {
        if (!prefabRoot || !isNodeUnderCurrentPage(node)) return false;
        return state.trackedPrefabs.has(getPrefabName(node, prefabRoot));
    }
    function buildNodeChange(node) {
        const prefabRoot = getOutermostPrefabRoot(node);
        if (!prefabRoot || !isTrackedNode(node, prefabRoot)) return null;
        const key = getChangeKey(node, prefabRoot);
        if (!key) return null;
        const initialState = state.baselineByKey.get(key);
        if (!initialState) return null;
        const prefabPath = getSyncPrefabPath(node, prefabRoot);
        if (!prefabPath) return null;
        const change = {
            uuid: node.uuid,
            prefabPath,
            prefabName: getPrefabName(node, prefabRoot),
        };
        const fileId = getSyncFileId(node, prefabRoot);
        if (fileId) change.fileId = fileId;
        fillMountSlotInfo(node, prefabRoot, change);
        let isNodeChanged = appendNodePropChanges(change, node, initialState);
        const cc = ccMod();
        const layout = getComp(node, 'cc.Layout');
        if (layout && appendLayoutChanges(change, layout, initialState)) isNodeChanged = true;
        return isNodeChanged ? change : null;
    }
    function flushVisibleSceneChanges() {
        const page = findCurrentPageNode();
        if (!page) return;
        const walk = (node) => {
            const change = buildNodeChange(node);
            if (change) {
                const prefabRoot = getOutermostPrefabRoot(node);
                if (prefabRoot) state.accumulatedChanges.set(getChangeKey(node, prefabRoot), change);
            }
            node.children.forEach((c) => walk(c));
        };
        walk(page);
    }
    function getPendingSummary() {
        const map = {};
        state.accumulatedChanges.forEach((c) => {
            if (!c.prefabName) return;
            map[c.prefabName] = (map[c.prefabName] || 0) + 1;
        });
        return Object.keys(map).map((name) => ({ name, count: map[name] }));
    }
    function getAllPendingChanges() {
        flushVisibleSceneChanges();
        return Array.from(state.accumulatedChanges.values()).filter((c) => c.prefabName && state.trackedPrefabs.has(c.prefabName));
    }
    function isTopPageBaselined() {
        const name = getTopVisiblePrefabName();
        return name !== '(无 Prefab 页)' && state.baselinedPrefabs.has(name);
    }
    function clearStoredDataForPrefabs(prefabNames) {
        const removeKeys = [];
        state.baselineByKey.forEach((_, key) => {
            const name = getPrefabNameFromKey(key);
            if (name && prefabNames.has(name)) removeKeys.push(key);
        });
        removeKeys.forEach((key) => {
            state.baselineByKey.delete(key);
            state.accumulatedChanges.delete(key);
        });
    }
    /** 记录当前页基准 */
    function recordBaselineForVisiblePrefabs(showDoneTip) {
        const page = findCurrentPageNode();
        if (!page) {
            showTip('找不到当前页（没有弹层，场景里也没有 Canvas）', true);
            return;
        }
        const visible = getCurrentPagePrefabNames();
        clearStoredDataForPrefabs(visible);
        visible.forEach((name) => {
            state.trackedPrefabs.add(name);
            state.baselinedPrefabs.add(name);
        });
        let count = 0;
        const walk = (node) => {
            const prefabRoot = getOutermostPrefabRoot(node);
            if (!prefabRoot) {
                node.children.forEach((c) => walk(c));
                return;
            }
            const prefabName = getPrefabName(node, prefabRoot);
            if (!visible.has(prefabName)) {
                node.children.forEach((c) => walk(c));
                return;
            }
            const syncPath = getSyncPrefabPath(node, prefabRoot);
            if (!syncPath) {
                node.children.forEach((c) => walk(c));
                return;
            }
            state.baselineByKey.set(getChangeKey(node, prefabRoot), readNodeState(node));
            count++;
            node.children.forEach((c) => walk(c));
        };
        walk(page);
        console.log('[WebSyncDebug] recordBaseline', [...visible].join(', '), count);
        updateUiState();
        if (showDoneTip) showTip(`[${[...visible].join(', ')}] 当前页基准已记录`);
    }
    function markChangesSynced(changes) {
        changes.forEach((c) => {
            if (!c.prefabName || !c.prefabPath) return;
            const key = `prefab:${c.prefabName}|${c.prefabPath}`;
            state.accumulatedChanges.delete(key);
            const old = state.baselineByKey.get(key);
            if (!old) return;
            const st = { ...old };
            if (c.x !== undefined) st.x = c.x;
            if (c.y !== undefined) st.y = c.y;
            FLOAT_NODE_PROPS.forEach((p) => { if (c[p] !== undefined) st[p] = c[p]; });
            if (c.opacity !== undefined) st.opacity = c.opacity;
            if (c.color) st.color = { ...c.color };
            LAYOUT_PROPS.forEach((p) => { if (c[p] !== undefined) st[p] = c[p]; });
            state.baselineByKey.set(key, st);
        });
    }
    function showTip(msg, isError) {
        const el = document.createElement('div');
        el.textContent = msg;
        el.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);padding:12px 20px;border-radius:8px;z-index:99999;font-size:15px;color:#fff;background:' + (isError ? '#c62828' : '#2e7d32') + ';box-shadow:0 4px 12px rgba(0,0,0,.3);pointer-events:none;max-width:90vw;text-align:center;line-height:1.4;';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3500);
    }
    function scheduleLocate(fn, ms) {
        state.locateTimers.push(window.setTimeout(fn, ms));
    }
    function clearLocateTimers() {
        state.locateTimers.forEach((id) => clearTimeout(id));
        state.locateTimers = [];
    }
    /** 定位前检查 DevTools 是否已打开（不自动打开面板） */
    function ensureDevtoolsOpen() {
        if (isDevtoolsOpen()) return true;
        showTip('请先按 D 打开 DevTools', true);
        return false;
    }
    /** 在 devtools 树中选中节点（展开路径并滚动，不触发搜索过滤） */
    function selectNodeInDevtoolsTree(node) {
        if (!ensureDevtoolsOpen() || !node || !node.uuid) return;
        clearLocateTimers();
        const tryLocate = (attempt) => {
            const locate = window.__ccDevToolsLocateNodeUuid;
            if (typeof locate === 'function' && locate(node.uuid)) return;
            if (attempt >= 8) {
                showTip('节点树定位失败，请确认已运行 patch-devtools-meodoku.cjs', true);
                return;
            }
            scheduleLocate(() => tryLocate(attempt + 1), 150);
        };
        scheduleLocate(() => tryLocate(0), 80);
    }
    function locateNodeInDevtools(node, showDoneTip, usePrefabRoot) {
        const cc = ccMod();
        if (!node || !cc.isValid(node)) {
            showTip('节点无效', true);
            return false;
        }
        const target = usePrefabRoot !== false ? (getOutermostPrefabRoot(node) || node) : node;
        clearLocateTimers();
        selectNodeInDevtoolsTree(target);
        if (showDoneTip) {
            const page = findCurrentPageNode();
            const path = page ? getRelativePath(node, page) : node.name;
            showTip(`已定位: ${path || node.name}`);
        }
        return true;
    }
    function locateCurrentPageInDevtools() {
        const node = findCurrentPageNode();
        if (!node) {
            showTip('找不到当前页节点', true);
            return;
        }
        locateNodeInDevtools(node, true, true);
    }
    function clientToCocosPoint(clientX, clientY, rect) {
        const cc = ccMod();
        const view = cc.view;
        const dpr = view.getDevicePixelRatio();
        const viewport = view.getViewportRect();
        const scaleX = view.getScaleX();
        const scaleY = view.getScaleY();
        return cc.v3(
            (dpr * (clientX - rect.left) - viewport.x) / scaleX,
            (dpr * (rect.top + rect.height - clientY) - viewport.y) / scaleY,
            0,
        );
    }
    function cocosPointToClient(point) {
        const canvas = state.pickCanvas || document.getElementById('GameCanvas');
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const cc = ccMod();
        const view = cc.view;
        const dpr = view.getDevicePixelRatio();
        const viewport = view.getViewportRect();
        const scaleX = view.getScaleX();
        const scaleY = view.getScaleY();
        const pxX = point.x * scaleX + viewport.x;
        const pxY = point.y * scaleY + viewport.y;
        return { x: pxX / dpr + rect.left, y: rect.top + rect.height - pxY / dpr };
    }
    function isPointInNode(node, worldPoint) {
        const ui = getUI(node);
        if (!ui || typeof ui.getBoundingBoxToWorld !== 'function') return false;
        const cc = ccMod();
        const rect = ui.getBoundingBoxToWorld();
        const px = worldPoint.x;
        const py = worldPoint.y;
        if (cc && cc.v2) return rect.contains(cc.v2(px, py));
        return rect.x <= px && px <= rect.x + rect.width && rect.y <= py && py <= rect.y + rect.height;
    }
    function isNodePickHidden(node) {
        const cc = ccMod();
        if (!node.active || !node.activeInHierarchy) return true;
        const uiOpacity = getComp(node, 'cc.UIOpacity');
        if (uiOpacity && uiOpacity.opacity <= 0) return true;
        const scale = node.scale;
        if (Math.abs(scale.x) < 0.001 || Math.abs(scale.y) < 0.001) return true;
        return false;
    }
    function pickNodeAtPoint(node, point) {
        if (!node.activeInHierarchy) return null;
        const children = [...node.children].reverse();
        for (const child of children) {
            const found = pickNodeAtPoint(child, point);
            if (found) return found;
        }
        if (isNodePickHidden(node)) return null;
        if (!isPointInNode(node, point)) return null;
        return node;
    }
    function pickBestNodeAtPoint(point) {
        const page = findCurrentPageNode();
        if (!page) return null;
        return pickNodeAtPoint(page, point);
    }
    function nodeBBoxToScreenRect(node) {
        const ui = getUI(node);
        if (!ui) return null;
        const rect = ui.getBoundingBoxToWorld();
        const cc = ccMod();
        const pts = [
            cc.v3(rect.x, rect.y, 0),
            cc.v3(rect.x + rect.width, rect.y, 0),
            cc.v3(rect.x + rect.width, rect.y + rect.height, 0),
            cc.v3(rect.x, rect.y + rect.height, 0),
        ].map((p) => cocosPointToClient(p));
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        });
        const width = maxX - minX;
        const height = maxY - minY;
        if (width < 1 || height < 1) return null;
        return { left: minX, top: minY, width, height };
    }
    function ensurePickOverlay() {
        if (state.pickOverlay) return;
        const el = markDom(document.createElement('div'));
        el.style.cssText = 'position:fixed;pointer-events:none;z-index:99998;box-sizing:border-box;border:2px solid #42a5f5;background:rgba(66,165,245,.12);display:none;';
        document.body.appendChild(el);
        state.pickOverlay = el;
    }
    function updatePickHoverOverlay(node) {
        ensurePickOverlay();
        if (!state.pickOverlay) return;
        if (!node) {
            state.pickOverlay.style.display = 'none';
            return;
        }
        const r = nodeBBoxToScreenRect(node);
        if (!r) {
            state.pickOverlay.style.display = 'none';
            return;
        }
        state.pickOverlay.style.display = 'block';
        state.pickOverlay.style.left = r.left + 'px';
        state.pickOverlay.style.top = r.top + 'px';
        state.pickOverlay.style.width = r.width + 'px';
        state.pickOverlay.style.height = r.height + 'px';
    }
    function updatePickUiState() {
        const canvas = state.pickCanvas;
        if (canvas) canvas.style.cursor = state.pickModeActive ? 'crosshair' : '';
        if (state.pickBtn) {
            state.pickBtn.textContent = state.pickModeActive ? '取消 (P)' : '点选 (P)';
            state.pickBtn.dataset.pickActive = state.pickModeActive ? '1' : '0';
        }
        if (!state.pickModeActive) {
            state.pickHoverNode = null;
            updatePickHoverOverlay(null);
        }
    }
    function setPickModeActive(active) {
        state.pickModeActive = active;
        updatePickUiState();
    }
    /** 快捷键 P：DevTools 收起时先展开并进入点选，已展开时切换点选 */
    function onPickShortcut() {
        if (!isDevtoolsOpen()) {
            if (typeof window.__ccDevToolsToggle === 'function') window.__ccDevToolsToggle();
            if (!state.pickModeActive) {
                setPickModeActive(true);
                showTip('点选：在画布上点击节点定位；再按 P 取消');
            }
            return;
        }
        togglePickMode();
    }
    function togglePickMode() {
        setPickModeActive(!state.pickModeActive);
        if (state.pickModeActive) showTip('点选：在画布上点击节点定位；再按 P 取消');
        else showTip('已取消点选');
    }
    function domEventToCocosPoint(e) {
        const canvas = state.pickCanvas || document.getElementById('GameCanvas');
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return clientToCocosPoint(e.clientX, e.clientY, rect);
    }
    function onPickCanvasMouseMove(e) {
        if (!state.pickModeActive) return;
        const point = domEventToCocosPoint(e);
        if (!point) return;
        const node = pickBestNodeAtPoint(point);
        if (node === state.pickHoverNode) return;
        state.pickHoverNode = node;
        updatePickHoverOverlay(node);
    }
    function onPickCanvasMouseDown(e) {
        const altOnce = e.altKey && !state.pickModeActive;
        if (!state.pickModeActive && !altOnce) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const point = domEventToCocosPoint(e);
        if (!point) return;
        let node = state.pickModeActive && state.pickHoverNode ? state.pickHoverNode : pickBestNodeAtPoint(point);
        if (!node) {
            showTip('未命中当前页可见节点', true);
            return;
        }
        locateNodeInDevtools(node, true, false);
        if (altOnce) return;
    }
    function bindPickCanvasListeners() {
        if (state.pickCanvasMouseDown) return;
        const canvas = document.getElementById('GameCanvas');
        if (!canvas) return;
        state.pickCanvas = canvas;
        state.pickCanvasMouseDown = (e) => onPickCanvasMouseDown(e);
        state.pickCanvasMouseMove = (e) => onPickCanvasMouseMove(e);
        canvas.addEventListener('mousedown', state.pickCanvasMouseDown, true);
        canvas.addEventListener('mousemove', state.pickCanvasMouseMove, true);
    }
    /** DevTools 关闭后清空已卸载的 UI 引用，便于下次打开重建 */
    function clearSyncUiRefs() {
        state.syncPanel = null;
        state.statusLabel = null;
        state.baselineBtn = null;
        state.pickBtn = null;
        state.syncBtn = null;
        state.refreshBtn = null;
        state.devtoolsButtonsMounted = false;
    }
    /** 绑定已有底栏 DOM 到 state */
    function bindSyncPanelRefs(panel) {
        state.syncPanel = panel;
        state.statusLabel = panel.querySelector('.web-sync-status');
        state.baselineBtn = panel.querySelector('[data-role="baseline"]');
        state.syncBtn = panel.querySelector('[data-role="sync"]');
    }
    /** 在 #cc-devtools 右上角挂载「刷新」按钮 */
    function tryMountRefreshHeaderBtn() {
        const host = document.getElementById('cc-devtools');
        if (!host) return;
        const gh = host.querySelector('.ccdev-github');
        if (gh) gh.style.display = 'none';
        let wrap = host.querySelector('[data-web-sync-header-actions]');
        if (!wrap) {
            wrap = markDom(document.createElement('div'));
            wrap.setAttribute('data-web-sync-header-actions', '1');
            wrap.className = 'web-sync-header-actions';
            host.appendChild(wrap);
        }
        const staleCacheBtn = wrap.querySelector('[data-web-sync-cache-header]');
        if (staleCacheBtn) staleCacheBtn.remove();
        let btn = wrap.querySelector('[data-web-sync-refresh-header]');
        if (!btn) {
            btn = markDom(document.createElement('button'));
            btn.setAttribute('data-web-sync-refresh-header', '1');
            btn.className = 'web-sync-refresh-header';
            btn.onclick = (e) => { e.stopPropagation(); cycleTreeRefreshRate(); };
            wrap.appendChild(btn);
        }
        state.refreshBtn = btn;
        updateRefreshBtnLabel();
    }
    /** DevTools 打开后多次重试挂载（Preact 重建 #cc-devtools 有延迟） */
    function scheduleDevtoolsRemount() {
        [0, 80, 200, 450, 900].forEach((ms) => {
            setTimeout(() => tryMountDevtoolsButtons(), ms);
        });
    }
    /** 在 ccc-devtools 搜索栏内追加「当前页」「点选 (P)」 */
    function mountDevtoolsButtons() {
        const bar = document.querySelector('.tree-search-bar');
        if (!bar) return false;
        bar.setAttribute('data-web-sync-augmented', '1');
        if (!bar.querySelector('[data-web-sync-current-page]')) {
            const pageBtn = markDom(document.createElement('button'));
            pageBtn.setAttribute('data-web-sync-current-page', '1');
            pageBtn.textContent = '当前页';
            pageBtn.title = '定位当前弹层；没有弹层时定位场景 Canvas';
            pageBtn.onclick = (e) => { e.stopPropagation(); locateCurrentPageInDevtools(); };
            bar.appendChild(pageBtn);
        }
        if (!bar.querySelector('[data-web-sync-pick-node]')) {
            const pickBtn = markDom(document.createElement('button'));
            pickBtn.setAttribute('data-web-sync-pick-node', '1');
            pickBtn.textContent = '点选 (P)';
            pickBtn.title = '点选 (P)：开启后在画布点击节点；再按 P 或点此按钮取消；Alt+点击单次选中';
            pickBtn.onclick = (e) => { e.stopPropagation(); togglePickMode(); };
            bar.appendChild(pickBtn);
        }
        state.pickBtn = bar.querySelector('[data-web-sync-pick-node]');
        state.devtoolsButtonsMounted = true;
        updatePickUiState();
        return true;
    }
    function tryMountDevtoolsButtons() {
        tryMountRefreshHeaderBtn();
        tryMountSyncPanel();
        syncPanelVisibility();
        const bar = document.querySelector('.tree-search-bar');
        if (!bar) {
            state.devtoolsButtonsMounted = false;
            return;
        }
        if (bar.querySelector('[data-web-sync-current-page]')) {
            state.devtoolsButtonsMounted = true;
            return;
        }
        state.devtoolsButtonsMounted = false;
        mountDevtoolsButtons();
    }
    /** DevTools 面板是否打开 */
    function isDevtoolsOpen() {
        return !!localStorage.getItem('cc_devtools_show') && !!document.getElementById('cc-devtools');
    }
    /** 同步 WebSync 底栏显示 */
    function syncPanelVisibility() {
        if (!isDevtoolsOpen()) {
            clearSyncUiRefs();
            return;
        }
        const panel = state.syncPanel || document.querySelector('[data-web-sync-panel]');
        if (!panel) return;
        panel.dataset.open = '1';
    }
    /** 应用节点树刷新模式 */
    function applyTreeRefreshRate(mode) {
        window.__ccDevToolsTreeRefreshMode = mode;
        localStorage.setItem('cc_devtools_tree_refresh_mode', String(mode));
        if (typeof window.__ccDevToolsRescheduleTree === 'function') window.__ccDevToolsRescheduleTree();
        updateRefreshBtnLabel();
    }
    /** 读取当前刷新模式 */
    function getTreeRefreshMode() {
        return window.__ccDevToolsTreeRefreshMode || '1000';
    }
    /** 刷新模式说明 */
    function treeRefreshModeTitle(mode) {
        if (mode === 'full') return '节点树刷新：原版（约 60 次/秒，requestAnimationFrame）';
        if (mode === 'half') return '节点树刷新：原版一半（约 30 次/秒，隔帧刷新）';
        if (mode === '1000') return '节点树刷新：每 1 秒一次';
        if (mode === 'off') return '节点树刷新：已暂停';
        return '节点树刷新：' + mode;
    }
    /** 更新树刷新按钮文案 */
    function updateRefreshBtnLabel() {
        if (!state.refreshBtn) return;
        const mode = getTreeRefreshMode();
        const idx = state.treeRefreshOptions.indexOf(mode);
        state.refreshBtn.textContent = state.treeRefreshLabels[idx >= 0 ? idx : 2] + ' (C)';
        state.refreshBtn.title = treeRefreshModeTitle(mode);
    }
    /** 循环切换树刷新模式 */
    function cycleTreeRefreshRate() {
        const opts = state.treeRefreshOptions;
        let idx = opts.indexOf(getTreeRefreshMode());
        if (idx < 0) idx = 2;
        applyTreeRefreshRate(opts[(idx + 1) % opts.length]);
    }
    /** 缓存按钮 SVG 图标 */
    const CACHE_TOGGLE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>';
    /** 将 ImageBitmap 转为 data URL */
    function imageBitmapToDataUrl(bitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext('2d').drawImage(bitmap, 0, 0);
        return canvas.toDataURL('image/png');
    }
    /** 从 ImageAsset / DOM 对象解析可显示的预览地址 */
    function getImageAssetPreviewSrc(image) {
        if (!image) return '';
        const rawUrl = image.nativeUrl || image._nativeUrl || '';
        if (rawUrl && rawUrl.indexOf('db://') !== 0) return normalizePreviewUrl(rawUrl);
        const data = image.data || image._data;
        if (data instanceof HTMLImageElement && data.src) return data.src;
        if (data instanceof HTMLCanvasElement) return data.toDataURL('image/png');
        if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) return imageBitmapToDataUrl(data);
        const native = image.nativeAsset || image._nativeAsset;
        if (native instanceof HTMLImageElement && native.src) return native.src;
        if (native instanceof HTMLCanvasElement) return native.toDataURL('image/png');
        if (typeof ImageBitmap !== 'undefined' && native instanceof ImageBitmap) return imageBitmapToDataUrl(native);
        return '';
    }
    /** 将相对 / 绝对路径转为预览页可访问 URL */
    function normalizePreviewUrl(url) {
        if (!url) return '';
        if (/^(https?:|blob:|data:)/i.test(url)) return url;
        if (url.indexOf('//') === 0) return window.location.protocol + url;
        const origin = window.location.origin;
        return url.charAt(0) === '/' ? origin + url : origin + '/' + url.replace(/^\//, '');
    }
    /** 从 URL / 路径提取文件名 */
    function getFileNameFromUrl(url) {
        if (!url || /^data:/i.test(url) || /^blob:/i.test(url)) return '';
        const clean = String(url).split('?')[0].split('#')[0];
        const slash = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
        const base = slash >= 0 ? clean.slice(slash + 1) : clean;
        if (!base || base.indexOf('@') === 0) return '';
        try { return decodeURIComponent(base); } catch (e) { return base; }
    }
    /** 安全转为 uuid 字符串（避免 object 上 String() 抛错） */
    function toUuidString(value) {
        if (value == null || value === '') return '';
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (typeof value === 'object') {
            if (typeof value.uuid === 'string') return value.uuid;
            if (typeof value._uuid === 'string') return value._uuid;
            if (typeof value.value === 'string') return value.value;
            return '';
        }
        try { return String(value); } catch (e) { return ''; }
    }
    /** 判断字符串是否像 UUID（含 @subId / .png 后缀） */
    function isUuidLike(text) {
        const s = toUuidString(text);
        if (!s) return false;
        const base = s.split('?')[0].split('#')[0].replace(/\.[a-z0-9]+$/i, '').split('@')[0];
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base);
    }
    /** 取资源 uuid */
    function getAssetUuid(item) {
        if (!item) return '';
        return toUuidString(item.uuid) || toUuidString(item._uuid);
    }
    /** 从 bundle 资源路径取源文件名 */
    function getSourceFileNameFromPath(path, nativeExt) {
        if (!path) return '';
        const clean = String(path).replace(/\\/g, '/');
        const slash = clean.lastIndexOf('/');
        const base = slash >= 0 ? clean.slice(slash + 1) : clean;
        if (!base || isUuidLike(base)) return '';
        if (nativeExt && nativeExt.charAt(0) === '.' && base.indexOf('.') < 0) return base + nativeExt;
        return base;
    }
    /** 遍历已加载 bundle */
    function eachAssetBundle(fn) {
        const cc = ccMod();
        const bundles = cc && cc.assetManager && cc.assetManager.bundles;
        if (!bundles) return;
        if (typeof bundles.forEach === 'function') {
            bundles.forEach((bundle, name) => fn(bundle, name));
            return;
        }
        const map = bundles._map || bundles;
        for (const key in map) {
            if (key === '_map') continue;
            fn(map[key], key);
        }
    }
    /** 在 assetManager.assets 里查找资源对应的缓存键 */
    function findAssetCacheKey(target) {
        if (!target) return '';
        const assets = cc.assetManager && cc.assetManager.assets;
        if (!assets) return '';
        let found = '';
        const tryMatch = (v, k) => {
            if (found || v !== target) return;
            found = toUuidString(k);
        };
        if (typeof assets.forEach === 'function') assets.forEach((v, k) => tryMatch(v, k));
        else if (assets._map) { for (const k in assets._map) tryMatch(assets._map[k], k); }
        else { for (const k in assets) tryMatch(assets[k], k); }
        return found;
    }
    /** 读取资源上可能携带的编辑器路径 / 文件名 */
    function readAssetFileHint(item, nativeExt) {
        if (!item) return '';
        const hints = [
            item._file, item.file, item._path, item.path, item.displayName,
            item._name, item.name,
        ];
        for (let i = 0; i < hints.length; i++) {
            const hint = hints[i];
            if (typeof hint !== 'string' || !hint) continue;
            if (hint.indexOf('/') >= 0 || hint.indexOf('\\') >= 0) {
                const fromPath = getSourceFileNameFromPath(hint, nativeExt);
                if (fromPath) return fromPath;
            } else if (!isUuidLike(hint)) {
                if (nativeExt && nativeExt.charAt(0) === '.' && hint.indexOf('.') < 0) return hint + nativeExt;
                return hint;
            }
        }
        return '';
    }
    function expandUuidLookupKeys(value) {
        const keys = [];
        const push = (v) => {
            const s = toUuidString(v);
            if (!s || keys.indexOf(s) >= 0) return;
            keys.push(s);
            const base = s.split('@')[0];
            if (base && keys.indexOf(base) < 0) keys.push(base);
        };
        push(value);
        const cc = ccMod();
        const utils = cc && cc.assetManager && cc.assetManager.utils;
        const base = toUuidString(value).split('@')[0];
        if (utils && base) {
            if (typeof utils.decodeUuid === 'function') {
                try { push(utils.decodeUuid(base)); } catch (e) { /* ignore */ }
            }
            if (typeof utils.compressUuid === 'function') {
                try { push(utils.compressUuid(base, true)); } catch (e) { /* ignore */ }
            }
        }
        return keys;
    }
    /** 构建 uuid → bundle 源路径 索引（每次打开缓存弹窗重建） */
    function buildUuidPathMap() {
        if (state.uuidPathMap) return state.uuidPathMap;
        const map = Object.create(null);
        const remember = (uuidKey, path) => {
            if (!uuidKey || !path) return;
            expandUuidLookupKeys(uuidKey).forEach((k) => { if (!map[k]) map[k] = path; });
        };
        eachAssetBundle((bundle) => {
            const config = bundle._config || bundle.config;
            if (!config) return;
            const utils = ccMod().assetManager && ccMod().assetManager.utils;
            const infos = config.assetInfos;
            if (infos) {
                const infoMap = infos._map || infos;
                for (const k in infoMap) {
                    const info = infoMap[k];
                    if (!info || !info.path) continue;
                    remember(k, info.path);
                    remember(info.uuid, info.path);
                    if (utils && typeof utils.decodeUuid === 'function' && k && k.indexOf('-') < 0) {
                        try { remember(utils.decodeUuid(k), info.path); } catch (e) { /* ignore */ }
                    }
                }
            }
            if (config.paths) {
                for (const path in config.paths) {
                    const val = config.paths[path];
                    let id = '';
                    if (Array.isArray(val)) {
                        id = toUuidString(val[0]);
                        if (!id && typeof val[0] === 'number' && config.uuids) id = toUuidString(config.uuids[val[0]]);
                    } else {
                        id = toUuidString(val);
                    }
                    remember(id, path);
                }
            }
        });
        state.uuidPathMap = map;
        return map;
    }
    /** 在 assetInfos 里模糊匹配 uuid */
    function lookupPathInAssetInfoMap(infoMap, keys) {
        if (!infoMap || !keys.length) return '';
        for (const k in infoMap) {
            const info = infoMap[k];
            if (!info || !info.path) continue;
            const infoUuid = toUuidString(info.uuid) || toUuidString(k);
            for (let i = 0; i < keys.length; i++) {
                const t = keys[i];
                if (!t) continue;
                if (k === t || infoUuid === t) return info.path;
                if (k.split('@')[0] === t.split('@')[0]) return info.path;
                if (infoUuid && infoUuid.split('@')[0] === t.split('@')[0]) return info.path;
            }
        }
        return '';
    }
    /** 在单个 bundle 内用 uuid 查资源路径 */
    function lookupAssetPathInBundle(bundle, keys) {
        if (!bundle || !keys.length) return '';
        if (typeof bundle.getAssetInfo === 'function') {
            for (let i = 0; i < keys.length; i++) {
                if (!keys[i]) continue;
                try {
                    const info = bundle.getAssetInfo(keys[i]);
                    if (info && info.path) return info.path;
                } catch (e) { /* ignore */ }
            }
        }
        const config = bundle._config || bundle.config;
        if (!config) return '';
        const infos = config.assetInfos;
        if (infos) {
            const path = lookupPathInAssetInfoMap(infos._map || infos, keys);
            if (path) return path;
        }
        if (config.paths) {
            for (const path in config.paths) {
                const val = config.paths[path];
                let id = '';
                if (Array.isArray(val)) {
                    id = toUuidString(val[0]);
                    if (!id && typeof val[0] === 'number' && config.uuids) id = toUuidString(config.uuids[val[0]]);
                } else {
                    id = toUuidString(val);
                }
                if (!id) continue;
                for (let i = 0; i < keys.length; i++) {
                    const t = keys[i];
                    if (!t) continue;
                    if (id === t || id.split('@')[0] === t.split('@')[0]) return path;
                }
            }
        }
        return '';
    }
    /** 用 uuid / cacheKey 反查 bundle 源路径 */
    function lookupAssetSourcePathByKeys(keys) {
        if (!keys || !keys.length) return '';
        const map = buildUuidPathMap();
        for (let i = 0; i < keys.length; i++) {
            const path = map[keys[i]];
            if (path) return path;
        }
        let found = '';
        eachAssetBundle((bundle) => {
            if (found) return;
            const path = lookupAssetPathInBundle(bundle, keys);
            if (path) found = path;
        });
        return found;
    }
    /** 收集用于反查路径的 key（含 assets 缓存键） */
    function collectAssetLookupKeys(item, cacheKey) {
        const keys = [];
        const push = (v) => {
            expandUuidLookupKeys(v).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); });
        };
        push(cacheKey);
        push(getAssetUuid(item));
        if (item.image) push(getAssetUuid(item.image));
        if (item.texture) push(getAssetUuid(item.texture));
        return keys;
    }
    /** 从预览 URL 中提取真实文件名（跳过 UUID 命名） */
    function extractFileNameFromPreviewUrl(url) {
        if (!url || /^data:/i.test(url) || /^blob:/i.test(url)) return '';
        const tail = getFileNameFromUrl(url);
        if (tail && !isUuidLike(tail)) return tail;
        const m = String(url).match(/\/([a-zA-Z0-9_-]+\.(png|jpe?g|webp|gif))(?:\?|#|$)/i);
        if (m && m[1] && !isUuidLike(m[1])) return m[1];
        return '';
    }
    function extractSourcePathFromUrls(item) {
        if (!item) return '';
        const urls = [];
        if (item.nativeUrl) urls.push(item.nativeUrl);
        if (item._nativeUrl) urls.push(item._nativeUrl);
        if (item.image) {
            if (item.image.nativeUrl) urls.push(item.image.nativeUrl);
            if (item.image._nativeUrl) urls.push(item.image._nativeUrl);
        }
        for (let i = 0; i < urls.length; i++) {
            const u = urls[i];
            if (!u) continue;
            const fromPreview = extractFileNameFromPreviewUrl(u);
            if (fromPreview) return fromPreview;
            if (u.indexOf('db://') === 0) {
                const p = u.replace(/^db:\/\//, '').replace(/^assets\//, '');
                if (p && !isUuidLike(getSourceFileNameFromPath(p, ''))) return p;
            }
            const m = String(u).match(/\/assets\/([^?#]+)/i);
            if (m && m[1] && !isUuidLike(getSourceFileNameFromPath(m[1], ''))) return m[1];
        }
        return '';
    }
    /** 解析缓存条目显示名（bundle 源路径文件名，非 native UUID） */
    function resolveAssetCacheName(item, cacheKey) {
        if (!item || typeof item !== 'object') return '_';
        const nativeExt = item._native || (item.image && item.image._native) || '';
        const content = (item.constructor && item.constructor.name) || item.__classname__ || '';
        if ((content === 'cc.Texture2D' || content === 'Texture2D') && item.image) {
            const imageKey = findAssetCacheKey(item.image);
            const imageName = resolveAssetCacheName(item.image, imageKey);
            if (imageName !== '_') return imageName;
        }
        const keys = collectAssetLookupKeys(item, cacheKey || findAssetCacheKey(item));
        const path = lookupAssetSourcePathByKeys(keys);
        let fileName = getSourceFileNameFromPath(path, nativeExt);
        if (fileName) return fileName;
        fileName = getSourceFileNameFromPath(extractSourcePathFromUrls(item), nativeExt);
        if (fileName) return fileName;
        fileName = readAssetFileHint(item, nativeExt);
        if (fileName) return fileName;
        if (item.image) {
            fileName = readAssetFileHint(item.image, nativeExt);
            if (fileName) return fileName;
        }
        fileName = extractFileNameFromPreviewUrl(resolveAssetPreviewSrc(item));
        if (fileName) return fileName;
        return '_';
    }
    /** 从 Texture2D / SpriteFrame 等资源解析预览图地址 */
    function resolveAssetPreviewSrc(item) {
        if (!item || typeof item !== 'object') return '';
        const content = (item.constructor && item.constructor.name) || item.__classname__ || '';
        if (content === 'cc.SpriteFrame' || content === 'SpriteFrame') {
            const tex = item.texture;
            if (tex) return resolveAssetPreviewSrc(tex);
            return normalizePreviewUrl(item.nativeUrl || '');
        }
        const direct = item.nativeUrl || (item._nativeAsset && item._nativeAsset.url) || '';
        if (direct && direct.indexOf('db://') !== 0) return normalizePreviewUrl(direct);
        if (item.image) {
            const fromImage = getImageAssetPreviewSrc(item.image);
            if (fromImage) return fromImage;
        }
        const native = item.nativeAsset || item._nativeAsset;
        if (native instanceof HTMLImageElement && native.src) return native.src;
        if (native instanceof HTMLCanvasElement) return native.toDataURL('image/png');
        if (typeof ImageBitmap !== 'undefined' && native instanceof ImageBitmap) return imageBitmapToDataUrl(native);
        return '';
    }
    /** 同步缓存 toggle 与 DevTools 开关的位置 / 高亮 */
    function syncCacheTogglePosition() {
        if (!state.cacheBtn) return;
        const devToggle = document.querySelector('button.ccdev-toggle:not([data-web-sync-cache-toggle])');
        if (devToggle) {
            state.cacheBtn.style.top = devToggle.style.top || '';
            state.cacheBtn.style.transform = devToggle.style.transform || 'translateY(-50%)';
        } else {
            state.cacheBtn.style.top = '25px';
            state.cacheBtn.style.transform = 'translateY(-50%)';
        }
        const open = !!(state.cacheDialogEl && state.cacheDialogEl.dataset.open === '1');
        state.cacheBtn.classList.toggle('active', open);
    }
    /** 在 DevTools 开关左侧挂载缓存 toggle（固定于预览页右上角） */
    function mountCacheToggleBtn() {
        let btn = document.querySelector('[data-web-sync-cache-toggle]');
        if (!btn) {
            btn = markDom(document.createElement('button'));
            btn.setAttribute('data-web-sync-cache-toggle', '1');
            btn.className = 'ccdev-toggle web-sync-cache-toggle';
            btn.title = '查看 assetManager 缓存资源（R）';
            btn.innerHTML = CACHE_TOGGLE_ICON;
            btn.onclick = (e) => { e.stopPropagation(); toggleCacheDialog(); };
            document.body.appendChild(btn);
        }
        state.cacheBtn = btn;
        state.cacheToggleMounted = true;
        syncCacheTogglePosition();
    }
    /** 格式化缓存条目大小 */
    function formatCacheSize(size) {
        return size === -1 || size === undefined ? '_' : (size + 'MB');
    }
    /** 收集 assetManager 缓存；2.4 优先 cc.cache，3.x 遍历 assets */
    function collectAssetCache() {
        if (typeof cc.cache === 'function') {
            state.uuidPathMap = null;
            buildUuidPathMap();
            const pair = cc.cache();
            const cacheData = (pair[0] || []).map((row) => {
                if (row.name && row.name !== '_' && !isUuidLike(row.name)) return row;
                const path = lookupAssetSourcePathByKeys(expandUuidLookupKeys(row.id || row.uuid || ''));
                const fromPath = getSourceFileNameFromPath(path, '');
                if (fromPath) return { ...row, name: fromPath };
                const fromUrl = row.preview ? getFileNameFromUrl(row.preview) : '';
                if (fromUrl && !isUuidLike(fromUrl)) return { ...row, name: fromUrl };
                return row;
            });
            return { cacheData, cacheTitle: pair[1] || '缓存' };
        }
        state.uuidPathMap = null;
        buildUuidPathMap();
        const cacheData = [];
        let totalTextureSize = 0;
        const assets = cc.assetManager && cc.assetManager.assets;
        if (!assets) return { cacheData, cacheTitle: '缓存 [文件总数:0][纹理缓存:0M]' };
        const visit = (item, key) => {
            if (!item || typeof item !== 'object') return;
            const content = (item.constructor && item.constructor.name) || item.__classname__ || '_';
            const rawType = item.type || '';
            if (rawType === 'js' || rawType === 'json') return;
            let itemName = resolveAssetCacheName(item, key);
            let preview = '';
            let formatSize = -1;
            if (content === 'cc.Texture2D' || content === 'Texture2D') {
                preview = resolveAssetPreviewSrc(item);
                const bpp = (item._native === '.jpg' || (preview && /\.jpe?g(\?|$)/i.test(preview))) ? 3 : 4;
                const textureSize = item.width * item.height * bpp / 1024 / 1024;
                totalTextureSize += textureSize;
                formatSize = Math.round(textureSize * 1000) / 1000;
            } else if (content === 'cc.SpriteFrame' || content === 'SpriteFrame') {
                preview = resolveAssetPreviewSrc(item);
            } else if (item.nativeUrl) preview = normalizePreviewUrl(item.nativeUrl);
            cacheData.push({ type: content, name: itemName, preview, assetRef: item, id: getAssetUuid(item) || toUuidString(key) || '_', size: formatSize });
        };
        if (typeof assets.forEach === 'function') assets.forEach((v, k) => visit(v, k));
        else if (assets._map) { for (const k in assets._map) visit(assets._map[k], k); }
        else { for (const k in assets) visit(assets[k], k); }
        return { cacheData, cacheTitle: `缓存 [文件总数:${cacheData.length}][纹理缓存:${totalTextureSize.toFixed(2)}M]` };
    }
    /** 过滤并排序缓存表数据 */
    function getFilteredCacheRows() {
        let rows = state.cacheRawData.slice();
        if (state.cacheOnlyTexture) rows = rows.filter((r) => r.type === 'cc.Texture2D' || r.type === 'Texture2D');
        const q = (state.cacheSearchText || '').trim().toLowerCase();
        if (q) rows = rows.filter((r) => (r.type + r.name + r.id).toLowerCase().indexOf(q) >= 0);
        rows.sort((a, b) => (b.size === -1 ? -Infinity : b.size) - (a.size === -1 ? -Infinity : a.size));
        return rows;
    }
    /** 取缓存条目预览地址 */
    function getCacheItemPreviewSrc(item) {
        if (!item) return '';
        return item.preview ? normalizePreviewUrl(item.preview) : (item.assetRef ? resolveAssetPreviewSrc(item.assetRef) : '');
    }
    /** 选中单元格文本，便于拷贝 */
    function selectCellText(td) {
        if (!td) return;
        const range = document.createRange();
        range.selectNodeContents(td);
        const sel = window.getSelection();
        if (!sel) return;
        sel.removeAllRanges();
        sel.addRange(range);
    }
    /** 同步预览链接 href 为图片实际地址 */
    function syncCachePreviewLinkHref(link, img, fallbackSrc) {
        if (!link || !img) return '';
        const href = img.currentSrc || img.src || fallbackSrc || '';
        if (href) link.href = href;
        return href;
    }
    /** 将 data URL 转为 blob URL，便于新窗口打开 */
    function dataUrlToBlobUrl(dataUrl) {
        try {
            const comma = dataUrl.indexOf(',');
            if (comma < 0) return '';
            const header = dataUrl.slice(0, comma);
            const data = dataUrl.slice(comma + 1);
            const mime = (header.match(/data:([^;]+)/) || [])[1] || 'image/png';
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return URL.createObjectURL(new Blob([bytes], { type: mime }));
        } catch (e) {
            return '';
        }
    }
    /** 新窗口直接打开图片地址（不用 document.write） */
    function openCachePreviewInNewWindow(src) {
        if (!src) return false;
        let win = window.open(src, '_blank', 'noopener,noreferrer');
        if (win) return true;
        if (/^data:/i.test(src)) {
            const blobUrl = dataUrlToBlobUrl(src);
            if (blobUrl) {
                win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
                if (win) {
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                    return true;
                }
                URL.revokeObjectURL(blobUrl);
            }
        }
        return false;
    }
    /** 渲染缓存表 tbody */
    function renderCacheTableBody(tbody) {
        tbody.textContent = '';
        const rows = getFilteredCacheRows();
        rows.forEach((item) => {
            const tr = markDom(document.createElement('tr'));
            [item.type, item.name || '_'].forEach((text) => {
                const td = markDom(document.createElement('td'));
                td.textContent = text;
                tr.appendChild(td);
            });
            const tdPreview = markDom(document.createElement('td'));
            const previewSrc = getCacheItemPreviewSrc(item);
            if (previewSrc) {
                const wrap = markDom(document.createElement('div'));
                wrap.className = 'web-sync-cache-preview';
                const img = markDom(document.createElement('img'));
                img.src = previewSrc;
                img.draggable = false;
                img.alt = item.name || item.id || 'preview';
                const link = markDom(document.createElement('a'));
                link.className = 'web-sync-cache-preview-link';
                link.href = previewSrc;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.title = '点击查看原图（新窗口）';
                link.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const href = syncCachePreviewLinkHref(link, img, previewSrc);
                    openCachePreviewInNewWindow(href);
                };
                img.onload = () => syncCachePreviewLinkHref(link, img, previewSrc);
                img.onerror = () => {
                    if (!item.assetRef) return;
                    const retry = resolveAssetPreviewSrc(item.assetRef);
                    if (retry && retry !== img.src) {
                        img.src = retry;
                        link.href = retry;
                    }
                };
                link.appendChild(img);
                wrap.appendChild(link);
                syncCachePreviewLinkHref(link, img, previewSrc);
                tdPreview.appendChild(wrap);
            } else tdPreview.textContent = '_';
            tr.appendChild(tdPreview);
            const tdId = markDom(document.createElement('td'));
            tdId.className = 'web-sync-cache-id';
            tdId.textContent = item.id || '_';
            tdId.title = '双击选中 ID';
            tdId.ondblclick = (e) => { e.stopPropagation(); selectCellText(tdId); };
            tr.appendChild(tdId);
            const tdSize = markDom(document.createElement('td'));
            tdSize.textContent = formatCacheSize(item.size);
            tr.appendChild(tdSize);
            tbody.appendChild(tr);
        });
    }
    /** 创建缓存弹窗 DOM（只建一次） */
    function ensureCacheDialog() {
        if (state.cacheDialogEl) return state.cacheDialogEl;
        const overlay = markDom(document.createElement('div'));
        overlay.className = 'web-sync-cache-overlay';
        overlay.dataset.open = '0';
        overlay.onclick = (e) => { if (e.target === overlay) closeCacheDialog(); };
        const card = markDom(document.createElement('div'));
        card.className = 'web-sync-cache-card';
        card.onclick = (e) => e.stopPropagation();
        const titleRow = markDom(document.createElement('div'));
        titleRow.className = 'web-sync-cache-title';
        const title = markDom(document.createElement('span'));
        title.setAttribute('data-web-sync-cache-title', '1');
        titleRow.appendChild(title);
        const search = markDom(document.createElement('input'));
        search.type = 'text';
        search.placeholder = 'Search';
        search.className = 'web-sync-cache-search';
        search.oninput = () => {
            state.cacheSearchText = search.value;
            renderCacheTableBody(overlay.querySelector('[data-web-sync-cache-tbody]'));
        };
        titleRow.appendChild(search);
        card.appendChild(titleRow);
        const tableWrap = markDom(document.createElement('div'));
        tableWrap.className = 'web-sync-cache-table-wrap';
        const table = markDom(document.createElement('table'));
        table.className = 'web-sync-cache-table';
        table.innerHTML = '<thead><tr><th>Type</th><th>Name</th><th>Preview</th><th>ID</th><th>Size</th></tr></thead>';
        const tbody = markDom(document.createElement('tbody'));
        tbody.setAttribute('data-web-sync-cache-tbody', '1');
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        card.appendChild(tableWrap);
        const actions = markDom(document.createElement('div'));
        actions.className = 'web-sync-cache-actions';
        const closeBtn = markDom(document.createElement('button'));
        closeBtn.type = 'button';
        closeBtn.className = 'web-sync-cache-close';
        closeBtn.textContent = 'Close';
        closeBtn.onclick = () => closeCacheDialog();
        actions.appendChild(closeBtn);
        const texLabel = markDom(document.createElement('label'));
        texLabel.className = 'web-sync-cache-textures-only';
        const texSwitch = markDom(document.createElement('input'));
        texSwitch.type = 'checkbox';
        texSwitch.checked = true;
        texSwitch.onchange = () => {
            state.cacheOnlyTexture = texSwitch.checked;
            renderCacheTableBody(tbody);
        };
        texLabel.appendChild(texSwitch);
        texLabel.appendChild(document.createTextNode('只显示纹理'));
        actions.appendChild(texLabel);
        card.appendChild(actions);
        overlay.appendChild(card);
        document.body.appendChild(overlay);
        state.cacheDialogEl = overlay;
        return overlay;
    }
    /** 打开资源缓存弹窗 */
    function openCacheDialog() {
        const cc = ccMod();
        if (!cc) { showTip('引擎未就绪', true); return; }
        const { cacheData, cacheTitle } = collectAssetCache();
        state.cacheRawData = cacheData;
        state.cacheSearchText = '';
        const overlay = ensureCacheDialog();
        const title = overlay.querySelector('[data-web-sync-cache-title]');
        if (title) title.textContent = cacheTitle;
        const search = overlay.querySelector('.web-sync-cache-search');
        if (search) search.value = '';
        const texSwitch = overlay.querySelector('.web-sync-cache-textures-only input');
        if (texSwitch) texSwitch.checked = state.cacheOnlyTexture;
        renderCacheTableBody(overlay.querySelector('[data-web-sync-cache-tbody]'));
        overlay.dataset.open = '1';
        syncCacheTogglePosition();
    }
    /** 关闭资源缓存弹窗 */
    function closeCacheDialog() {
        if (state.cacheDialogEl) state.cacheDialogEl.dataset.open = '0';
        syncCacheTogglePosition();
    }
    /** 切换资源缓存弹窗 */
    function toggleCacheDialog() {
        if (state.cacheDialogEl && state.cacheDialogEl.dataset.open === '1') closeCacheDialog();
        else openCacheDialog();
    }
    /** 创建 WebSync 底栏（挂在 #cc-devtools 内） */
    function createSyncPanel() {
        const host = document.getElementById('cc-devtools');
        if (!host) return;
        const existing = host.querySelector('[data-web-sync-panel]');
        if (existing) {
            bindSyncPanelRefs(existing);
            updateUiState();
            updatePickUiState();
            return;
        }
        const panel = markDom(document.createElement('div'));
        panel.setAttribute('data-web-sync-panel', '1');
        panel.className = 'web-sync-panel';
        panel.dataset.open = isDevtoolsOpen() ? '1' : '0';
        const statusLabel = markDom(document.createElement('div'));
        statusLabel.className = 'web-sync-status';
        panel.appendChild(statusLabel);
        state.statusLabel = statusLabel;
        const toolbar = markDom(document.createElement('div'));
        toolbar.className = 'web-sync-toolbar';
        const baselineBtn = markDom(document.createElement('button'));
        baselineBtn.className = 'web-sync-btn';
        baselineBtn.dataset.role = 'baseline';
        baselineBtn.textContent = '记录基准';
        baselineBtn.onclick = (e) => { e.stopPropagation(); recordBaselineForVisiblePrefabs(true); };
        toolbar.appendChild(baselineBtn);
        state.baselineBtn = baselineBtn;
        const syncBtn = markDom(document.createElement('button'));
        syncBtn.className = 'web-sync-btn';
        syncBtn.dataset.role = 'sync';
        syncBtn.dataset.dim = '1';
        syncBtn.textContent = '同步 (S)';
        syncBtn.onclick = (e) => { e.stopPropagation(); exportSyncCode(); };
        toolbar.appendChild(syncBtn);
        state.syncBtn = syncBtn;
        panel.appendChild(toolbar);
        host.appendChild(panel);
        state.syncPanel = panel;
        updateUiState();
        updatePickUiState();
    }
    function tryMountSyncPanel() {
        const host = document.getElementById('cc-devtools');
        if (!host) return false;
        if (state.syncPanel && host.contains(state.syncPanel)) {
            syncPanelVisibility();
            return true;
        }
        createSyncPanel();
        return !!state.syncPanel;
    }
    function updateUiState() {
        const summary = getPendingSummary();
        const totalCount = state.accumulatedChanges.size;
        const current = getTopVisiblePrefabName();
        const baselined = isTopPageBaselined();
        const cache = state.uiCache;
        if (state.baselineBtn) {
            const baselineText = baselined ? '重新记录基准' : '记录基准';
            const baselineActive = baselined ? '1' : '0';
            if (cache.baselineText !== baselineText) {
                cache.baselineText = baselineText;
                state.baselineBtn.textContent = baselineText;
            }
            if (cache.baselineBg !== baselineActive) {
                cache.baselineBg = baselineActive;
                state.baselineBtn.dataset.active = baselineActive;
            }
        }
        if (state.syncBtn) {
            const syncText = totalCount ? `同步 (${totalCount})` : '同步 (S)';
            const syncDim = totalCount ? '0' : '1';
            if (cache.syncText !== syncText) {
                cache.syncText = syncText;
                state.syncBtn.textContent = syncText;
            }
            if (cache.syncOpacity !== syncDim) {
                cache.syncOpacity = syncDim;
                state.syncBtn.dataset.dim = syncDim;
            }
        }
        if (state.statusLabel) {
            const pending = summary.map((p) => `${p.name}(${p.count})`).join(', ');
            const currentState = baselined ? '已记录' : '未记录';
            const statusText = pending
                ? `待同步: ${pending} | ${current} · ${currentState}`
                : `${current} · ${currentState}`;
            const statusBaselined = baselined ? '1' : '0';
            if (cache.status !== statusText) {
                cache.status = statusText;
                state.statusLabel.textContent = statusText;
            }
            if (cache.statusBaselined !== statusBaselined) {
                cache.statusBaselined = statusBaselined;
                state.statusLabel.dataset.baselined = statusBaselined;
            }
        }
    }
    function checkPageChanged() {
        const topPage = getTopVisiblePrefabName();
        if (topPage === '(无 Prefab 页)' || topPage === state.lastVisibleLabel) return false;
        if (isTopPageBaselined()) flushVisibleSceneChanges();
        state.lastVisibleLabel = topPage;
        return true;
    }
    function tick() {
        let dirty = checkPageChanged();
        if (isTopPageBaselined()) {
            const before = state.accumulatedChanges.size;
            flushVisibleSceneChanges();
            if (state.accumulatedChanges.size !== before) dirty = true;
        }
        if (dirty) updateUiState();
    }
    function isTypingInPageInput() {
        const active = document.activeElement;
        if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && !active.isContentEditable)) return false;
        if (active.tagName === 'INPUT') {
            const input = active;
            if (input.type === 'hidden') return false;
            const rect = input.getBoundingClientRect();
            if (rect.width < 2 || rect.height < 2) return false;
        }
        return true;
    }
    function isSyncShortcut(e) {
        const isS = e.key === 's' || e.key === 'S' || e.keyCode === 83;
        if (!isS || e.shiftKey) return false;
        if (e.ctrlKey && e.shiftKey) return true;
        return !e.ctrlKey && !e.metaKey && !e.altKey;
    }
    function onDomKeyDown(e) {
        if (e.key === 'Escape' && state.cacheDialogEl && state.cacheDialogEl.dataset.open === '1') {
            e.preventDefault();
            e.stopImmediatePropagation();
            closeCacheDialog();
            return;
        }
        if (e.key === 'Escape' && state.pickModeActive) {
            e.preventDefault();
            e.stopImmediatePropagation();
            setPickModeActive(false);
            showTip('已取消点选');
            return;
        }
        if (isTypingInPageInput()) return;
        const isD = e.key === 'd' || e.key === 'D' || e.keyCode === 68;
        if (isD && !e.ctrlKey && !e.metaKey && !e.altKey && typeof window.__ccDevToolsToggle === 'function') {
            e.preventDefault();
            e.stopImmediatePropagation();
            window.__ccDevToolsToggle();
            return;
        }
        const isC = e.key === 'c' || e.key === 'C' || e.keyCode === 67;
        if (isC && !e.ctrlKey && !e.metaKey && !e.altKey && isDevtoolsOpen()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            cycleTreeRefreshRate();
            return;
        }
        const isR = e.key === 'r' || e.key === 'R' || e.keyCode === 82;
        if (isR && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            toggleCacheDialog();
            return;
        }
        const isP = e.key === 'p' || e.key === 'P' || e.keyCode === 80;
        if (isP && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            e.stopImmediatePropagation();
            onPickShortcut();
            return;
        }
        if (!isSyncShortcut(e)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        exportSyncCode();
    }
    function exportSyncCode() {
        if (state.isExporting) return;
        const changes = getAllPendingChanges();
        if (!changes.length) {
            showTip('没有待同步改动，请先在目标页点「记录基准」再改 UI');
            return;
        }
        state.isExporting = true;
        sendToEditor(changes, () => { state.isExporting = false; });
    }
    function sendToEditor(changes, done) {
        const onSuccess = (res) => {
            const applied = res && res.applied !== undefined ? res.applied : changes.length;
            const missed = res && res.missed !== undefined ? res.missed : 0;
            const syncedPrefabs = res && res.syncedPrefabs ? res.syncedPrefabs : [];
            const missedPrefabs = res && res.missedPrefabs ? res.missedPrefabs : [];
            const okLabel = syncedPrefabs.map((p) => `${p.name}(${p.count})`).join(', ');
            const missLabel = missedPrefabs.map((p) => `${p.name}(${p.count})`).join(', ');
            let msg = okLabel ? `${okLabel} 已写入 Prefab` : `已同步 ${applied} 个节点`;
            let isError = applied === 0;
            if (missLabel) {
                msg = `${okLabel ? okLabel + ' 已写入；' : ''}${missLabel} 未写入`;
                isError = true;
            } else if (missed > 0) {
                msg = `部分未同步 ${applied}/${changes.length}`;
                isError = true;
            }
            if (applied > 0) {
                markChangesSynced(changes);
                state.baselinedPrefabs.clear();
            }
            updateUiState();
            showTip(msg, isError);
            done();
        };
        const onFail = (msg) => { showTip(msg, true); done(); };
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `http://127.0.0.1:${SYNC_PORT}/web-sync`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = () => {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try { onSuccess(JSON.parse(xhr.responseText || '{}')); }
                catch (e) { onSuccess({ applied: changes.length, missed: 0 }); }
                return;
            }
            onFail(`同步失败(${xhr.status})，请确认 web-sync-helper 扩展已启用`);
        };
        xhr.onerror = () => onFail('无法连接编辑器，请确认 Cocos Creator 已打开');
        xhr.send(JSON.stringify({ changes }));
    }
    /** 启动 web-sync 调试 */
    async function boot() {
        await waitCC();
        const cc = ccMod();
        if (!cc || !cc.sys || !cc.sys.isBrowser) return;
        applyTreeRefreshRate(getTreeRefreshMode());
        mountCacheToggleBtn();
        bindPickCanvasListeners();
        state.domKeyHandler = (e) => onDomKeyDown(e);
        window.addEventListener('keydown', state.domKeyHandler, true);
        state.tickTimer = window.setInterval(tick, 200);
        state.mountBtnTimer = window.setInterval(tryMountDevtoolsButtons, 500);
        setInterval(syncPanelVisibility, 800);
        setInterval(() => { if (state.cacheToggleMounted) syncCacheTogglePosition(); }, 400);
        const origToggle = window.__ccDevToolsToggle;
        if (typeof origToggle === 'function') {
            window.__ccDevToolsToggle = function () {
                origToggle();
                scheduleDevtoolsRemount();
            };
        }
        window.webSyncExport = () => exportSyncCode();
        window.webSyncBaseline = () => recordBaselineForVisiblePrefabs(true);
        window.webSyncLocateCurrentPage = () => locateCurrentPageInDevtools();
        window.webSyncTogglePick = () => togglePickMode();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
