// 把 ui-sheet-v3 外圈奶油底抠掉，按连通块切成透明 PNG，并写成 Cocos 3.8 九宫格 meta
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';

const srcPath = resolve('tools/temp/ui-style/ui-sheet-v3.png');
const outDir = resolve('assets/game/bundles/GameUI/Skin');
const png = PNG.sync.read(readFileSync(srcPath));
const { width, height, data } = png;

function at(x, y) {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

const bg = { r: 0, g: 0, b: 0, n: 0 };
for (let y = 8; y < 24; y++) {
    for (let x = 8; x < 24; x++) {
        const [r, g, b] = at(x, y);
        bg.r += r; bg.g += g; bg.b += b; bg.n++;
    }
}
bg.r = Math.round(bg.r / bg.n);
bg.g = Math.round(bg.g / bg.n);
bg.b = Math.round(bg.b / bg.n);

function nearBg(x, y) {
    const [r, g, b, a] = at(x, y);
    if (a < 8) return true;
    const dr = r - bg.r, dg = g - bg.g, db = b - bg.b;
    return dr * dr + dg * dg + db * db < 26 * 26;
}

const seen = new Uint8Array(width * height);
const qx = new Int32Array(width * height);
const qy = new Int32Array(width * height);
let qs = 0, qe = 0;
function push(x, y) {
    const k = y * width + x;
    if (seen[k] || !nearBg(x, y)) return;
    seen[k] = 1;
    qx[qe] = x; qy[qe] = y; qe++;
}
for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
while (qs < qe) {
    const x = qx[qs], y = qy[qs]; qs++;
    const i = (y * width + x) * 4;
    data[i + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x + 1 < width) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y + 1 < height) push(x, y + 1);
}

const label = new Int32Array(width * height);
label.fill(-1);
const boxes = [];
for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
        const k = y * width + x;
        if (data[k * 4 + 3] < 20 || label[k] !== -1) continue;
        let minX = x, maxX = x, minY = y, maxY = y, count = 0;
        const id = boxes.length;
        qs = 0; qe = 0;
        qx[qe] = x; qy[qe] = y; qe++;
        label[k] = id;
        while (qs < qe) {
            const cx = qx[qs], cy = qy[qs]; qs++;
            count++;
            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;
            const nbs = [[cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]];
            for (const [nx, ny] of nbs) {
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                const nk = ny * width + nx;
                if (label[nk] !== -1 || data[nk * 4 + 3] < 20) continue;
                label[nk] = id;
                qx[qe] = nx; qy[qe] = ny; qe++;
            }
        }
        const w = maxX - minX + 1, h = maxY - minY + 1;
        if (count < 80 || w < 8 || h < 8) continue;
        boxes.push({ x: minX, y: minY, w, h, count, cx: minX + w / 2, cy: minY + h / 2 });
    }
}

function gap(a, b) {
    const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));
    const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
    return Math.max(dx, dy);
}
let merged = boxes.slice();
let didMerge = true;
while (didMerge) {
    didMerge = false;
    outer: for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
            const a = merged[i], b = merged[j];
            if (Math.min(a.w, a.h, b.w, b.h) > 40) continue; // 只合并掉下来的小碎片，不把两颗按钮粘在一起
            if (gap(a, b) > 12) continue;
            const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
            const r = Math.max(a.x + a.w, b.x + b.w), bo = Math.max(a.y + a.h, b.y + b.h);
            merged.splice(j, 1);
            merged.splice(i, 1, { x, y, w: r - x, h: bo - y, cx: (x + r) / 2, cy: (y + bo) / 2 });
            didMerge = true;
            break outer;
        }
    }
}

function pick(list, pred) {
    const i = list.findIndex(pred);
    if (i < 0) return null;
    return list.splice(i, 1)[0];
}
function nameBox(box, name) {
    if (!box) { console.log('missing', name); return null; }
    box.name = name;
    return box;
}

const pool = merged.slice();
const named = [];
function add(box, name) {
    const n = nameBox(box, name);
    if (n) named.push(n);
}

const buttons = pool.filter((b) => b.x < 120 && b.w > 250).sort((a, b) => a.y - b.y);
for (const b of buttons) pool.splice(pool.indexOf(b), 1);
['BtnPrimary', 'BtnSecondary', 'BtnAd', 'BtnGold', 'BtnDiamond'].forEach((name, i) => add(buttons[i], name));

add(pick(pool, (b) => b.y < 220 && b.w > 300 && b.h < 120), 'TitleBar');
add(pick(pool, (b) => b.w > 180 && b.h > 180), 'Panel');
const frames = pool.filter((b) => b.y < 450 && b.x > 700 && b.x < 1050 && b.w > 90 && b.h > 100).sort((a, b) => a.x - b.x);
for (const b of frames) pool.splice(pool.indexOf(b), 1);
add(frames[0], 'SlotItem');
add(frames[1], 'FrameSelect');
const corners = pool.filter((b) => b.x > 1000 && b.y < 450 && b.w < 120 && b.h > 60).sort((a, b) => a.x - b.x);
for (const b of corners) pool.splice(pool.indexOf(b), 1);
add(corners[0], 'BtnClose');
add(corners[1], 'BtnHelp');
const tabs = pool.filter((b) => b.w > 180 && b.h > 50 && b.h < 120 && b.y > 500 && b.y < 680).sort((a, b) => a.x - b.x);
for (const b of tabs) pool.splice(pool.indexOf(b), 1);
add(tabs[0], 'TabNormal');
add(tabs[1], 'TabSelected');
add(pick(pool, (b) => b.w > 180 && b.h > 70 && b.y > 650), 'PlateStepper');
const smalls = pool.filter((b) => b.y > 650 && b.y < 860 && b.w > 70 && b.w < 140 && b.h > 70 && b.h < 140).sort((a, b) => a.x - b.x);
for (const b of smalls) pool.splice(pool.indexOf(b), 1);
add(smalls[0], 'BtnSmallPrimary');
add(smalls[1], 'BtnSmallSecondary');
add(pick(pool, (b) => b.h < 40 && b.w > 180 && b.x < 700), 'SliderTrack');
add(pick(pool, (b) => b.h < 50 && b.w > 180), 'ProgressFill');
add(pick(pool, (b) => b.w < 80 && b.h < 80 && b.y > 800 && b.y < 980), 'SliderThumb');
const iconNames = ['IconGold', 'IconDiamond', 'IconEnergy', 'IconMusic', 'IconSfx', 'IconLanguage', 'IconAd', 'IconPlus', 'IconMinus'];
const icons = pool.filter((b) => b.y > 980).sort((a, b) => a.x - b.x);
for (const b of icons) pool.splice(pool.indexOf(b), 1);
icons.forEach((b, i) => add(b, iconNames[i] || `IconExtra${i}`));
pool.forEach((b, i) => add(b, `Extra${i}`));

const sliceDesign = {
    TitleBar: [20, 20, 14, 14, 240, 48],
    Panel: [32, 32, 32, 32, 160, 160],
    BarResource: [16, 16, 16, 16, 96, 64],
    PlateCount: [8, 8, 8, 8, 48, 32],
    BtnPrimary: [16, 16, 16, 16, 288, 80],
    BtnSecondary: [16, 16, 16, 16, 288, 80],
    BtnAd: [16, 16, 16, 16, 288, 80],
    BtnGold: [16, 16, 16, 16, 288, 80],
    BtnDiamond: [16, 16, 16, 16, 288, 80],
    TabNormal: [16, 16, 16, 16, 160, 80],
    TabSelected: [16, 16, 16, 16, 160, 80],
    PlateStepper: [16, 16, 16, 16, 128, 80],
    SliderTrack: [8, 8, 8, 8, 96, 24],
    ProgressFill: [8, 8, 4, 4, 96, 16],
};

function borders(name, w, h) {
    const d = sliceDesign[name];
    if (!d) return [0, 0, 0, 0];
    const [dl, dr, dt, db, dw, dh] = d;
    let l = Math.max(2, Math.round(dl / dw * w));
    let r = Math.max(2, Math.round(dr / dw * w));
    let t = Math.max(2, Math.round(dt / dh * h));
    let b = Math.max(2, Math.round(db / dh * h));
    if (l + r > w - 4) { const s = (w - 4) / (l + r); l = Math.floor(l * s); r = Math.floor(r * s); }
    if (t + b > h - 4) { const s = (h - 4) / (t + b); t = Math.floor(t * s); b = Math.floor(b * s); }
    return [l, r, t, b];
}

function crop(box) {
    const out = new PNG({ width: box.w, height: box.h });
    for (let y = 0; y < box.h; y++) {
        for (let x = 0; x < box.w; x++) {
            const si = ((box.y + y) * width + (box.x + x)) * 4;
            const di = (y * box.w + x) * 4;
            out.data[di] = data[si];
            out.data[di + 1] = data[si + 1];
            out.data[di + 2] = data[si + 2];
            out.data[di + 3] = data[si + 3];
        }
    }
    return out;
}

function spriteMeta(uuid, name, w, h, border) {
    const [l, r, t, b] = border;
    const hx = w / 2, hy = h / 2;
    return {
        ver: '1.0.27',
        importer: 'image',
        imported: false,
        uuid,
        files: [],
        subMetas: {
            '6c48a': {
                ver: '1.0.22',
                importer: 'texture',
                uuid: `${uuid}@6c48a`,
                imported: false,
                files: [],
                subMetas: {},
                userData: {
                    wrapModeS: 'clamp-to-edge',
                    wrapModeT: 'clamp-to-edge',
                    minfilter: 'linear',
                    magfilter: 'linear',
                    mipfilter: 'none',
                    premultiplyAlpha: false,
                    anisotropy: 0,
                    isUuid: true,
                    imageUuidOrDatabaseUri: uuid,
                    visible: false,
                },
                displayName: name,
                id: '6c48a',
                name: 'texture',
            },
            f9941: {
                ver: '1.0.12',
                importer: 'sprite-frame',
                uuid: `${uuid}@f9941`,
                imported: false,
                files: [],
                subMetas: {},
                userData: {
                    trimType: 'auto',
                    trimThreshold: 1,
                    rotated: false,
                    offsetX: 0,
                    offsetY: 0,
                    trimX: 0,
                    trimY: 0,
                    width: w,
                    height: h,
                    rawWidth: w,
                    rawHeight: h,
                    borderTop: t,
                    borderBottom: b,
                    borderLeft: l,
                    borderRight: r,
                    packable: true,
                    pixelsToUnit: 100,
                    pivotX: 0.5,
                    pivotY: 0.5,
                    meshType: 0,
                    isUuid: true,
                    imageUuidOrDatabaseUri: `${uuid}@6c48a`,
                    vertices: {
                        rawPosition: [-hx, -hy, 0, hx, -hy, 0, -hx, hy, 0, hx, hy, 0],
                        indexes: [0, 1, 2, 2, 1, 3],
                        uv: [0, h, w, h, 0, 0, w, 0],
                        nuv: [0, 0, 1, 0, 0, 1, 1, 1],
                        minPos: [-hx, -hy, 0],
                        maxPos: [hx, hy, 0],
                    },
                },
                displayName: name,
                id: 'f9941',
                name: 'spriteFrame',
            },
        },
        userData: {
            type: 'sprite-frame',
            hasAlpha: true,
            fixAlphaTransparencyArtifacts: false,
            redirect: `${uuid}@6c48a`,
        },
    };
}

await mkdir(outDir, { recursive: true });
const manifest = [];
for (const box of named) {
    const border = borders(box.name, box.w, box.h);
    const file = `${box.name}.png`;
    const uuid = randomUUID();
    await writeFile(resolve(outDir, file), PNG.sync.write(crop(box)));
    await writeFile(resolve(outDir, `${file}.meta`), JSON.stringify(spriteMeta(uuid, box.name, box.w, box.h, border), null, 2));
    manifest.push({ name: box.name, file, x: box.x, y: box.y, w: box.w, h: box.h, border: { left: border[0], right: border[1], top: border[2], bottom: border[3] }, uuid });
}

const pacUuid = randomUUID();
await writeFile(resolve(outDir, 'Skin.pac'), '{\n    "__type__": "cc.SpriteAtlas"\n}\n');
await writeFile(resolve(outDir, 'Skin.pac.meta'), JSON.stringify({
    ver: '1.0.8',
    importer: 'auto-atlas',
    imported: false,
    uuid: pacUuid,
    files: [],
    subMetas: {},
    userData: {
        maxWidth: 1024,
        maxHeight: 1024,
        padding: 2,
        allowRotation: false,
        forceSquared: false,
        powerOfTwo: false,
        algorithm: 'MaxRects',
        format: 'png',
        quality: 80,
        contourBleed: true,
        paddingBleed: true,
        filterUnused: false,
        removeTextureInBundle: true,
        removeImageInBundle: true,
        removeSpriteAtlasInBundle: true,
        compressSettings: {},
        textureSetting: {
            wrapModeS: 'clamp-to-edge',
            wrapModeT: 'clamp-to-edge',
            minfilter: 'linear',
            magfilter: 'linear',
            mipfilter: 'none',
            anisotropy: 0,
        },
    },
}, null, 2));

const dirUuid = randomUUID();
await writeFile(`${outDir}.meta`, JSON.stringify({
    ver: '1.2.0',
    importer: 'directory',
    imported: true,
    uuid: dirUuid,
    files: [],
    subMetas: {},
    userData: {},
}, null, 2));

await writeFile(resolve('tools/temp/ui-style/v3-slices.json'), JSON.stringify({
    source: 'ui-sheet-v3.png',
    background: bg,
    count: manifest.length,
    leftover: pool.map((b) => ({ name: b.name, x: b.x, y: b.y, w: b.w, h: b.h })),
    sprites: manifest,
}, null, 2));

console.log('bg', bg);
console.log('sprites', manifest.length);
for (const s of manifest) console.log(`${s.name}\t${s.w}x${s.h}\tborder ${s.border.left},${s.border.right},${s.border.top},${s.border.bottom}`);
if (pool.length) console.log('unassigned', pool.map((b) => `${b.name} ${b.w}x${b.h}@${b.x},${b.y}`).join(' | '));
