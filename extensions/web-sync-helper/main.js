'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { applyChangesToProject } = require('./lib/prefab-sync');

const SYNC_PORT = 7457;
let server = null;
let prefabNameCache = null;
let prefabNameCacheAt = 0;

/** 把目录里的 prefab 按根节点名放进索引；后扫的不覆盖已有名字 */
function indexPrefabDir(dir, map) {
    if (!fs.existsSync(dir)) return;
    const walk = (current) => {
        for (const ent of fs.readdirSync(current, { withFileTypes: true })) {
            const p = path.join(current, ent.name);
            if (ent.isDirectory()) walk(p);
            else if (ent.name.endsWith('.prefab')) {
                try {
                    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                    const prefabAsset = data[0];
                    if (!prefabAsset || prefabAsset.__type__ !== 'cc.Prefab') continue;
                    const root = data[prefabAsset.data.__id__];
                    if (root && root._name && !map.has(root._name)) map.set(root._name, p);
                } catch (e) {
                    console.warn('[web-sync-helper] 跳过无效 prefab:', p, e.message);
                }
            }
        }
    };
    walk(dir);
}

/** 扫描 assets，以及本仓库里的 gmajor（框架预制体不在 assets 下） */
function buildPrefabIndex(projectRoot) {
    const map = new Map();
    indexPrefabDir(path.join(projectRoot, 'assets'), map);
    indexPrefabDir(path.join(projectRoot, 'gmajor'), map);
    return map;
}

/** 获取 prefab 索引（带 30s 缓存） */
function getPrefabIndex(projectRoot) {
    const now = Date.now();
    if (!prefabNameCache || now - prefabNameCacheAt > 30000) {
        prefabNameCache = buildPrefabIndex(projectRoot);
        prefabNameCacheAt = now;
    }
    return prefabNameCache;
}

/** 处理 POST /web-sync */
function handleWebSync(projectRoot, body) {
    let payload;
    try {
        payload = JSON.parse(body || '{}');
    } catch (e) {
        return { status: 400, json: { error: 'invalid json' } };
    }
    const changes = Array.isArray(payload.changes) ? payload.changes : [];
    if (!changes.length) return { status: 200, json: { applied: 0, missed: 0, syncedPrefabs: [], missedPrefabs: [] } };
    const index = getPrefabIndex(projectRoot);
    const result = applyChangesToProject(projectRoot, index, changes);
    prefabNameCache = null;
    if (typeof Editor !== 'undefined' && Editor.Message) {
        const touched = new Set(result.touchedFiles || []);
        touched.forEach((filePath) => {
            const rel = path.relative(projectRoot, filePath).replace(/\\/g, '/');
            const url = 'db://' + rel.replace(/^assets\//, 'assets/');
            Editor.Message.send('asset-db', 'refresh-asset', url).catch(() => {});
        });
    }
    if (typeof Editor !== 'undefined' && Editor.success) {
        Editor.success(`[web-sync-helper] 已写入 ${result.applied} 项，未命中 ${result.missed} 项`);
    }
    return { status: 200, json: result };
}

/** 启动 HTTP 服务 */
function startServer(projectRoot) {
    if (server) return;
    server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method !== 'POST' || req.url !== '/web-sync') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not found' }));
            return;
        }
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const out = handleWebSync(projectRoot, body);
            res.writeHead(out.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(out.json));
        });
    });
    server.on('error', (err) => {
        console.error('[web-sync-helper] 端口占用或启动失败:', err.message);
    });
    server.listen(SYNC_PORT, '127.0.0.1', () => {
        console.log(`[web-sync-helper] 监听 http://127.0.0.1:${SYNC_PORT}/web-sync`);
        if (typeof Editor !== 'undefined' && Editor.success) {
            Editor.success(`[web-sync-helper] 已启动 (${SYNC_PORT})`);
        }
    });
}

/** 停止 HTTP 服务 */
function stopServer() {
    if (!server) return;
    server.close();
    server = null;
}

exports.load = function () {
    const projectRoot = Editor.Project.path;
    startServer(projectRoot);
};

exports.unload = function () {
    stopServer();
    prefabNameCache = null;
};
