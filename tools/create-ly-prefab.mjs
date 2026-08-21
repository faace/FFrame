#!/usr/bin/env node
/**
 * 生成 Ly* 预制体默认结构：根（脚本+UITransform）+ 空 panel。mask 不进 prefab。
 * 用法：node tools/create-ly-prefab.mjs <目录> Ly名字
 * 例：node tools/create-ly-prefab.mjs assets/bundles/Demo/DemoHome LyShop
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function compressUuid(uuid) {
    const hex = uuid.replace(/-/g, '');
    const head = hex.slice(0, 5);
    const rest = hex.slice(5);
    let out = head;
    for (let i = 0; i < rest.length; i += 3) {
        const num = parseInt(rest.slice(i, i + 3).padEnd(3, '0'), 16);
        out += B64[(num >> 6) & 63] + B64[num & 63];
    }
    return out;
}

function fileId() {
    return crypto.randomBytes(8).toString('base64url').slice(0, 11);
}

function relImportToGmajor(absDir) {
    const from = path.relative(absDir, path.join(ROOT, 'assets', 'gmajor')).replace(/\\/g, '/');
    return from.startsWith('.') ? from : './' + from;
}

function tsMeta(uuid) {
    return `{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "${uuid}",
  "files": [],
  "subMetas": {},
  "userData": {}
}
`;
}

function prefabMeta(uuid, name) {
    return `{
  "ver": "1.1.50",
  "importer": "prefab",
  "imported": true,
  "uuid": "${uuid}",
  "files": [
    ".json"
  ],
  "subMetas": {},
  "userData": {
    "syncNodeName": "${name}"
  }
}
`;
}

function prefabJson(name, scriptCid, ids) {
    return `[
  {
    "__type__": "cc.Prefab",
    "_name": "${name}",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_native": "",
    "data": { "__id__": 1 },
    "optimizationPolicy": 0,
    "persistent": false,
    "nestedPrefabInstanceRoots": null
  },
  {
    "__type__": "cc.Node",
    "_name": "${name}",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_parent": null,
    "_children": [{ "__id__": 7 }],
    "_active": true,
    "_components": [{ "__id__": 2 }, { "__id__": 3 }],
    "_prefab": { "__id__": 4 },
    "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
    "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
    "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
    "_mobility": 0,
    "_layer": 33554432,
    "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
    "_id": ""
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": { "__id__": 1 },
    "_enabled": true,
    "__prefab": { "__id__": 5 },
    "_contentSize": { "__type__": "cc.Size", "width": 100, "height": 100 },
    "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 },
    "_id": ""
  },
  {
    "__type__": "${scriptCid}",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": { "__id__": 1 },
    "_enabled": true,
    "__prefab": { "__id__": 6 },
    "_id": ""
  },
  {
    "__type__": "cc.PrefabInfo",
    "root": { "__id__": 1 },
    "asset": { "__id__": 0 },
    "fileId": "${ids.root}",
    "instance": null,
    "targetOverrides": null,
    "nestedPrefabInstanceRoots": null
  },
  { "__type__": "cc.CompPrefabInfo", "fileId": "${ids.rootUit}" },
  { "__type__": "cc.CompPrefabInfo", "fileId": "${ids.rootTs}" },
  {
    "__type__": "cc.Node",
    "_name": "panel",
    "_objFlags": 0,
    "__editorExtras__": {},
    "_parent": { "__id__": 1 },
    "_children": [],
    "_active": true,
    "_components": [{ "__id__": 8 }],
    "_prefab": { "__id__": 9 },
    "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
    "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
    "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
    "_mobility": 0,
    "_layer": 33554432,
    "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
    "_id": ""
  },
  {
    "__type__": "cc.UITransform",
    "_name": "",
    "_objFlags": 0,
    "__editorExtras__": {},
    "node": { "__id__": 7 },
    "_enabled": true,
    "__prefab": { "__id__": 10 },
    "_contentSize": { "__type__": "cc.Size", "width": 100, "height": 100 },
    "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 },
    "_id": ""
  },
  {
    "__type__": "cc.PrefabInfo",
    "root": { "__id__": 1 },
    "asset": { "__id__": 0 },
    "fileId": "${ids.panel}",
    "instance": null,
    "targetOverrides": null,
    "nestedPrefabInstanceRoots": null
  },
  { "__type__": "cc.CompPrefabInfo", "fileId": "${ids.panelUit}" }
]
`;
}

function tsSource(name, importPath) {
    return `import { _decorator } from 'cc';
import { GMLayer } from '${importPath}';

const { ccclass } = _decorator;

/** Layer：内容挂 this.panel；mask 由基类克隆 */
@ccclass('${name}')
export class ${name} extends GMLayer {
    onInit(): void {
        if (!this.panel) return;
    }
}
`;
}

const dirArg = process.argv[2];
const name = process.argv[3];
if (!dirArg || !name) {
    console.error('用法: node tools/create-ly-prefab.mjs <目录> Ly名字');
    process.exit(1);
}
if (!/^Ly[A-Z][A-Za-z0-9]*$/.test(name)) {
    console.error('名字必须是 Ly + 大驼峰，例如 LyShop');
    process.exit(1);
}

const absDir = path.resolve(ROOT, dirArg);
if (!fs.existsSync(absDir)) {
    console.error('目录不存在', absDir);
    process.exit(1);
}

const tsPath = path.join(absDir, name + '.ts');
const prefabPath = path.join(absDir, name + '.prefab');
if (fs.existsSync(tsPath) || fs.existsSync(prefabPath)) {
    console.error('已存在，未覆盖', name);
    process.exit(1);
}

const tsUuid = crypto.randomUUID();
const prefabUuid = crypto.randomUUID();
const importPath = relImportToGmajor(absDir);
fs.writeFileSync(tsPath, tsSource(name, importPath));
fs.writeFileSync(tsPath + '.meta', tsMeta(tsUuid));
fs.writeFileSync(prefabPath, prefabJson(name, compressUuid(tsUuid), {
    root: fileId(),
    rootUit: fileId(),
    rootTs: fileId(),
    panel: fileId(),
    panelUit: fileId(),
}));
fs.writeFileSync(prefabPath + '.meta', prefabMeta(prefabUuid, name));
console.info('[create-ly-prefab] 已生成', path.relative(ROOT, tsPath), '（含 panel）');
