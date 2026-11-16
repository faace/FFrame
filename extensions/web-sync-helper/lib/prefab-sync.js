'use strict';

const fs = require('fs');
const path = require('path');

const LAYOUT_PROPS = ['spacingX', 'spacingY', 'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'];

/** 解析 prefab JSON 内 __id__ 引用 */
function resolveRef(data, ref) {
    if (!ref || ref.__id__ === undefined) return null;
    return data[ref.__id__];
}

/** 取节点子节点对象列表 */
function getNodeChildren(data, node) {
    const result = [];
    if (!node._children) return result;
    for (const ref of node._children) {
        const child = resolveRef(data, ref);
        if (child) result.push(child);
    }
    return result;
}

/** 取节点组件对象列表 */
function getNodeComponents(data, node) {
    const result = [];
    if (!node._components) return result;
    for (const ref of node._components) {
        const comp = resolveRef(data, ref);
        if (comp) result.push(comp);
    }
    return result;
}

/** 按类型名查找组件 */
function findComponent(data, node, typeName) {
    return getNodeComponents(data, node).find((c) => c.__type__ === typeName) || null;
}

/** 按相对路径查找 prefab 内节点 */
function findNodeByPath(data, rootNode, prefabPath) {
    if (!prefabPath) return null;
    let node = rootNode;
    const parts = prefabPath.split('/').filter(Boolean);
    for (const part of parts) {
        const child = getNodeChildren(data, node).find((c) => c._name === part);
        if (!child) return null;
        node = child;
    }
    return node;
}

/** 将单条变更写入 prefab 数据 */
function applyChangeToNode(data, node, change) {
    if (!node) return false;
    if (change.x !== undefined || change.y !== undefined) {
        if (!node._lpos) node._lpos = { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 };
        if (change.x !== undefined) node._lpos.x = change.x;
        if (change.y !== undefined) node._lpos.y = change.y;
    }
    if (change.scaleX !== undefined || change.scaleY !== undefined) {
        if (!node._lscale) node._lscale = { __type__: 'cc.Vec3', x: 1, y: 1, z: 1 };
        if (change.scaleX !== undefined) node._lscale.x = change.scaleX;
        if (change.scaleY !== undefined) node._lscale.y = change.scaleY;
    }
    if (change.angle !== undefined) {
        if (!node._euler) node._euler = { __type__: 'cc.Vec3', x: 0, y: 0, z: 0 };
        node._euler.z = change.angle;
    }
    const ui = findComponent(data, node, 'cc.UITransform');
    if (ui && (change.width !== undefined || change.height !== undefined)) {
        if (!ui._contentSize) ui._contentSize = { __type__: 'cc.Size', width: 100, height: 100 };
        if (change.width !== undefined) ui._contentSize.width = change.width;
        if (change.height !== undefined) ui._contentSize.height = change.height;
    }
    const layout = findComponent(data, node, 'cc.Layout');
    if (layout) {
        LAYOUT_PROPS.forEach((p) => {
            if (change[p] !== undefined) layout[p] = change[p];
        });
    }
    const uiOpacity = findComponent(data, node, 'cc.UIOpacity');
    if (uiOpacity && change.opacity !== undefined) uiOpacity._opacity = change.opacity;
    if (change.color) {
        const label = findComponent(data, node, 'cc.Label');
        const sprite = findComponent(data, node, 'cc.Sprite');
        const target = label || sprite;
        if (target) {
            if (!target._color) target._color = { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 };
            Object.assign(target._color, change.color);
        }
    }
    return true;
}

/** 加载 prefab 根节点 */
function loadPrefabRoot(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const prefabAsset = data[0];
    if (!prefabAsset || prefabAsset.__type__ !== 'cc.Prefab') return null;
    const root = resolveRef(data, prefabAsset.data);
    if (!root || root.__type__ !== 'cc.Node') return null;
    return { data, root, filePath };
}

/** 批量应用变更并写盘 */
function applyChangesToProject(_projectRoot, prefabIndex, changes) {
    const grouped = new Map();
    for (const change of changes) {
        if (!change.prefabName || !change.prefabPath) continue;
        if (!grouped.has(change.prefabName)) grouped.set(change.prefabName, []);
        grouped.get(change.prefabName).push(change);
    }
    let applied = 0;
    let missed = 0;
    const syncedPrefabs = [];
    const missedPrefabs = [];
    const touchedFiles = new Set();
    for (const [prefabName, list] of grouped.entries()) {
        const filePath = prefabIndex.get(prefabName);
        if (!filePath) {
            missed += list.length;
            missedPrefabs.push({ name: prefabName, count: list.length });
            continue;
        }
        let doc;
        try {
            doc = loadPrefabRoot(filePath);
        } catch (e) {
            missed += list.length;
            missedPrefabs.push({ name: prefabName, count: list.length });
            continue;
        }
        let ok = 0;
        let fail = 0;
        for (const change of list) {
            const node = findNodeByPath(doc.data, doc.root, change.prefabPath);
            if (node && applyChangeToNode(doc.data, node, change)) ok++;
            else fail++;
        }
        if (ok > 0) {
            fs.writeFileSync(filePath, JSON.stringify(doc.data, null, 2) + '\n', 'utf8');
            touchedFiles.add(filePath);
            syncedPrefabs.push({ name: prefabName, count: ok });
        }
        applied += ok;
        missed += fail;
        if (fail > 0 && ok === 0) missedPrefabs.push({ name: prefabName, count: fail });
    }
    return { applied, missed, syncedPrefabs, missedPrefabs, touchedFiles: [...touchedFiles] };
}

module.exports = { applyChangesToProject };
