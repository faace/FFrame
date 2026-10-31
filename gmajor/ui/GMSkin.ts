import { assetManager, Asset, AssetManager, ImageAsset, JsonAsset, Rect, settings, Size, SpriteFrame, Texture2D } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import type { GMAsyncComplete } from '../resource/GMAsyncCallback';

/** 游戏界面图所在 Bundle。资源在 assets/game/bundles/Skin，不在 gmajor */
export const SKIN_BUNDLE = 'Skin';

const SKIN_DB = 'db://assets/game/bundles/Skin';
const BUILTIN_WHITE = '7d8f9b89-4fd1-4c9f-a3ab-38ec7cded7ca@f9941'; // default_sprite_splash

const editing = EDITOR && !PREVIEW;

type SkinSlot = {
    rect: [number, number, number, number];
    border?: [number, number, number, number];
    sliced?: boolean;
    reserved?: boolean;
};

type SkinSheet = {
    size?: [number, number];
    slots?: Record<string, SkinSlot>;
};

let frames: Map<string, SpriteFrame> | null = null;
let loadedTheme = ''; // 空字符串 = 旧的逐张图；有值 = Skin/<主题>/ 的两张图集
let pendingTheme = '';
let atlas = false; // 当前 frames 是不是本文件切出来的，切出来的才销毁
const ownedFrames = new Set<SpriteFrame>();
const ownedTextures = new Set<Texture2D>();
let waiters: Array<GMAsyncComplete> | null = null;
let missingBundle = false;
const logged = new Set<string>();
let white: SpriteFrame | null = null;
const editorWait = new Map<string, Array<(frame: SpriteFrame) => void>>();

type EditorHost = {
    Message?: { request: (module: string, method: string, url: string) => Promise<string> };
};

/** 开机或使用方调用。不传主题时仍按逐张图加载。传了主题则读 Skin/<主题>/ctrl、item 两张图集。没有 Skin 包也算完成，缺的槽用白图 */
export function loadSkin(onComplete: GMAsyncComplete): void;
export function loadSkin(theme: string, onComplete: GMAsyncComplete): void;
export function loadSkin(a: string | GMAsyncComplete, b?: GMAsyncComplete): void {
    const theme = typeof a === 'string' ? a : '';
    const onComplete = typeof a === 'string' ? b : a;
    if (typeof onComplete !== 'function') return;
    if (frames && loadedTheme === theme) return onComplete(null);
    if (waiters) {
        if (pendingTheme === theme) return void waiters.push(onComplete);
        return void waiters.push(() => { // 换主题等当前这次结束再载
            if (theme) loadSkin(theme, onComplete);
            else loadSkin(onComplete);
        });
    }
    waiters = [onComplete];
    pendingTheme = theme;
    if (frames) dropCurrent();
    loadedTheme = theme;
    if (editing) {
        frames = new Map(); // 编辑器不切图集，预览用白图或原来的单张 png，不崩
        finish(null);
        return;
    }
    const known = settings.querySettings<string[]>('assets', 'projectBundles'); // 工程里有哪些 Bundle；没有 Skin 就不去加载，免得打 404 红日志、弹预览错误框
    if (known && known.length && known.indexOf(SKIN_BUNDLE) < 0) {
        missingBundle = true;
        frames = new Map();
        noteMissing('*');
        finish(null);
        return;
    }
    assetManager.loadBundle(SKIN_BUNDLE, (err, bundle) => {
        if (err || !bundle) {
            console.warn('[Skin] 加载 Skin 包失败', err);
            missingBundle = true;
            frames = new Map();
            noteMissing('*');
            finish(null);
            return;
        }
        if (theme) return loadTheme(bundle, theme, () => finish(null));
        loadDeps(bundle, () => bundle.loadDir('', SpriteFrame, (loadErr, assets) => {
            frames = indexFrames(assets ?? [], bundle);
            if (!frames.size) {
                if (loadErr) console.warn('[Skin] 界面图加载失败', loadErr);
                missingBundle = true;
                noteMissing('*');
            }
            finish(null);
        }));
    });
}

/** Skin 的图和别的 Bundle 共用资源时，Creator 会把共用部分放到高优先级的包里，Skin 就依赖它。先把依赖的包加载好，不然 loadDir 会报 Please load bundle X first */
function loadDeps(bundle: AssetManager.Bundle, done: () => void): void {
    const deps = ((bundle as unknown as { deps?: string[] }).deps ?? []).filter((name) => !assetManager.bundles.has(name));
    if (!deps.length) return done();
    let left = deps.length;
    deps.forEach((name) => assetManager.loadBundle(name, (err) => {
        if (err) console.warn('[Skin] 依赖包加载失败', name, err);
        if (--left === 0) done();
    }));
}

/** 主题目录整份没有打一条 info；缺 ctrl 或 item 的某一张打一条 warn。清单原点在左上，纹理原点在左下 */
function loadTheme(bundle: AssetManager.Bundle, theme: string, done: () => void): void {
    loadDeps(bundle, () => bundle.loadDir(theme, (err, assets) => {
        const list = assets ?? [];
        const map = new Map<string, SpriteFrame>();
        frames = map;
        atlas = true;
        if (err && !list.length) {
            missingBundle = true;
            noteMissing('*');
            done();
            return;
        }
        const ctrlImage = findImage(list, 'ctrl');
        const itemImage = findImage(list, 'item');
        const ctrlJson = findJson(list, 'ctrl');
        const itemJson = findJson(list, 'item');
        const failed = [
            ctrlImage ? '' : 'ctrl.png',
            ctrlJson ? '' : 'ctrl.json',
            itemImage ? '' : 'item.png',
            itemJson ? '' : 'item.json',
        ].filter((name) => name);
        if (failed.length === 4) {
            missingBundle = true;
            noteMissing('*');
            done();
            return;
        }
        missingBundle = false;
        failed.forEach((name) => noteMissing(name));
        if (ctrlImage && ctrlJson) fillSlots(map, ctrlImage, ctrlJson.json as SkinSheet); // 控件优先，同名槽不让物品图盖掉
        if (itemImage && itemJson) fillSlots(map, itemImage, itemJson.json as SkinSheet);
        done();
    }));
}

function findImage(assets: Asset[], name: string): ImageAsset | null {
    for (const asset of assets) {
        if (asset instanceof ImageAsset && asset.name === name) return asset;
        if (asset instanceof Texture2D && asset.name === name && asset.image instanceof ImageAsset) return asset.image;
    }
    for (const asset of assets) { // 导入出来的子资源名叫 spriteFrame，图名在纹理上
        if (!(asset instanceof SpriteFrame) || !(asset.texture instanceof Texture2D)) continue;
        const image = asset.texture.image;
        if (image instanceof ImageAsset && (image.name === name || asset.texture.name === name)) return image;
    }
    return null;
}

function findJson(assets: Asset[], name: string): JsonAsset | null {
    for (const asset of assets) {
        if (asset instanceof JsonAsset && asset.name === name) return asset;
    }
    return null;
}

function fillSlots(map: Map<string, SpriteFrame>, image: ImageAsset, sheet: SkinSheet): void {
    const slots = sheet.slots;
    if (!slots) return;
    const tex = new Texture2D();
    tex.image = image;
    ownedTextures.add(tex);
    const sheetH = sheet.size?.[1] || image.height;
    for (const name of Object.keys(slots)) {
        const slot = slots[name];
        if (!slot || slot.reserved || map.has(name)) continue;
        const [x, y, w, h] = slot.rect;
        if (!(w > 0 && h > 0)) continue;
        const frame = new SpriteFrame();
        frame.texture = tex;
        frame.rect = new Rect(x, sheetH - y - h, w, h);
        frame.originalSize = new Size(w, h);
        frame.packable = false;
        if (slot.sliced && slot.border) {
            const [l, r, t, b] = slot.border;
            frame.insetLeft = l;
            frame.insetRight = r;
            frame.insetTop = t;
            frame.insetBottom = b;
        }
        map.set(name, frame);
        ownedFrames.add(frame);
    }
}

function dropCurrent(): void {
    if (atlas) {
        ownedFrames.forEach((frame) => frame.destroy());
        ownedFrames.clear();
        ownedTextures.forEach((tex) => tex.destroy());
        ownedTextures.clear();
    }
    frames = null;
    atlas = false;
    logged.clear();
}

/** 已载入才有值。缺槽时是白图，不是 null */
export function skinFrame(name: string): SpriteFrame | null {
    if (!frames) return null;
    return take(name);
}

/** 把槽贴到调用方。编辑器按路径取，播放用已载入的表 */
export function applySkin(name: string, apply: (frame: SpriteFrame) => void): void {
    if (editing) return applyInEditor(name, apply);
    if (frames) return apply(take(name));
    loadSkin(() => apply(take(name)));
}

function finish(err: Error | null): void {
    const pending = waiters ?? [];
    waiters = null;
    pending.forEach((fn) => fn(err));
}

function indexFrames(assets: SpriteFrame[], bundle: AssetManager.Bundle): Map<string, SpriteFrame> {
    const map = new Map<string, SpriteFrame>();
    const byUuid = new Map(assets.map((frame) => [frame.uuid, frame]));
    for (const info of bundle.getDirWithPath('', SpriteFrame)) {
        const name = info.path.split('/').find((part) => part && part !== 'spriteFrame');
        const frame = byUuid.get(info.uuid) ?? (assetManager.assets.get(info.uuid) as SpriteFrame | undefined);
        if (name && frame) map.set(name, frame);
    }
    if (map.size) return map;
    for (const frame of assets) {
        const name = frame.name.replace(/\/spriteFrame$/, '').replace(/\.png$/i, '');
        if (name && name !== 'spriteFrame') map.set(name, frame);
    }
    return map;
}

function take(name: string): SpriteFrame {
    const hit = frames?.get(name);
    if (hit) return hit;
    noteMissing(missingBundle ? '*' : name);
    return whiteFrame();
}

function noteMissing(key: string): void {
    if (logged.has(key)) return;
    logged.add(key);
    if (key === '*') console.info('[Skin] 没有 Skin 包，用内置白图'); // 整包没有是正常状态（新 app 还没出图），不当警告
    else console.warn('[Skin] 缺', key); // 包在但缺这一张，才是要补的
}

let editorDirOk: boolean | null = null; // 编辑器里 Skin 目录是否存在；null = 还没查
let editorDirWait: Array<() => void> | null = null;

/** 编辑器里先查一次 Skin 目录。没有就记一条「没有 Skin 包」，不对每个槽各报一次 */
function checkEditorDir(done: () => void): void {
    if (editorDirOk !== null) return done();
    if (editorDirWait) return void editorDirWait.push(done);
    editorDirWait = [done];
    queryUuid(SKIN_DB, (uuid) => {
        editorDirOk = !!uuid;
        if (!editorDirOk) {
            missingBundle = true;
            noteMissing('*');
        }
        const pending = editorDirWait ?? [];
        editorDirWait = null;
        pending.forEach((fn) => fn());
    });
}

function applyInEditor(name: string, apply: (frame: SpriteFrame) => void): void {
    checkEditorDir(() => {
        if (!editorDirOk) return apply(whiteFrame());
        applyInEditorSlot(name, apply);
    });
}

function applyInEditorSlot(name: string, apply: (frame: SpriteFrame) => void): void {
    const hit = frames?.get(name);
    if (hit) return apply(hit);
    const queue = editorWait.get(name);
    if (queue) return queue.push(apply);
    editorWait.set(name, [apply]);
    queryUuid(`${SKIN_DB}/${name}.png/spriteFrame`, (uuid) => {
        if (!uuid) return doneEditor(name, null);
        assetManager.loadAny({ uuid }, (err: Error | null, asset: SpriteFrame) => {
            if (err || !asset) return doneEditor(name, null);
            if (!frames) frames = new Map();
            frames.set(name, asset);
            doneEditor(name, asset);
        });
    });
}

function doneEditor(name: string, frame: SpriteFrame | null): void {
    if (!frame) noteMissing(name);
    const list = editorWait.get(name) ?? [];
    editorWait.delete(name);
    const use = frame ?? whiteFrame();
    for (const fn of list) fn(use);
}

function queryUuid(url: string, done: (uuid: string | null) => void): void {
    const editor = (globalThis as { Editor?: EditorHost }).Editor;
    const request = editor?.Message?.request;
    if (!request) return done(null);
    request.call(editor.Message, 'asset-db', 'query-uuid', url).then(
        (uuid: string) => done(uuid || null),
        () => done(null),
    );
}

function whiteFrame(): SpriteFrame {
    if (white?.isValid) return white;
    const builtin = assetManager.assets.get(BUILTIN_WHITE) as SpriteFrame | undefined;
    if (builtin?.isValid) {
        white = builtin;
        return builtin;
    }
    assetManager.loadAny({ uuid: BUILTIN_WHITE }, (err: Error | null, asset: SpriteFrame) => {
        if (!err && asset) white = asset;
    });
    white = makeWhite();
    return white;
}

function makeWhite(): SpriteFrame {
    const tex = new Texture2D();
    tex.reset({ width: 2, height: 2, format: Texture2D.PixelFormat.RGBA8888 });
    tex.uploadData(new Uint8Array(16).fill(255));
    const frame = new SpriteFrame();
    frame.texture = tex;
    return frame;
}
