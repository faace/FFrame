import { assetManager, AssetManager, settings, SpriteAtlas, SpriteFrame, Texture2D } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import type { GMAsyncComplete } from '../resource/GMAsyncCallback';

/** 游戏界面图所在 Bundle。资源在 assets/game/bundles/Skin，不在 gmajor */
export const SKIN_BUNDLE = 'Skin';

const SKIN_DB = 'db://assets/game/bundles/Skin';
const BUILTIN_WHITE = '7d8f9b89-4fd1-4c9f-a3ab-38ec7cded7ca@f9941'; // default_sprite_splash

const editing = EDITOR && !PREVIEW;

let frames: Map<string, SpriteFrame> | null = null;
let loadedTheme = ''; // 空字符串 = 旧的逐张图；有值 = Skin/<主题>/
let pendingTheme = '';
let packed = false; // 当前主题是 plist 图集。缺槽不再去找同名 png
let waiters: Array<GMAsyncComplete> | null = null;
let missingBundle = false;
const logged = new Set<string>();
let white: SpriteFrame | null = null;
const editorWait = new Map<string, Array<(frame: SpriteFrame) => void>>();

let editorSheets = ''; // 编辑器里已经切好的主题；空表示还没切
let editorSheetWait: Array<() => void> | null = null;

/** 游戏在 import 时调用。编辑器里 PfGM* 取图早于 gm.boot */
export function setSkinTheme(theme: string): void {
    if (!theme || theme === loadedTheme) return;
    loadedTheme = theme;
    editorSheets = '';
    if (frames) dropCurrent();
}

type EditorHost = {
    Message?: { request: (module: string, method: string, url: string) => Promise<string> };
};

/** 开机或使用方调用。不传主题时仍按逐张图加载。传了主题则读 Skin/<主题>/ctrl.plist、item.plist。没有 Skin 包也算完成，缺的槽用白图 */
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
    if (editing) return finish(null); // 编辑器里由 applySkin 按主题切，不在这里铺空表
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

/** 主题目录有 ctrl.plist 就用引擎导入的图集；没有就按该目录里的逐张图 */
function loadTheme(bundle: AssetManager.Bundle, theme: string, done: () => void): void {
    loadDeps(bundle, () => {
        bundle.load(theme + '/ctrl', SpriteAtlas, (err, ctrl) => {
            if (err || !ctrl) {
                bundle.loadDir(theme, SpriteFrame, (_loadErr, assets) => loadLoose(assets ?? [], bundle, theme, done));
                return;
            }
            const map = new Map<string, SpriteFrame>();
            frames = map;
            packed = true;
            missingBundle = false;
            addAtlas(map, ctrl);
            bundle.load(theme + '/item', SpriteAtlas, (itemErr, item) => {
                if (itemErr || !item) noteMissing('item');
                else addAtlas(map, item);
                done();
            });
        });
    });
}

function addAtlas(map: Map<string, SpriteFrame>, sheet: SpriteAtlas): void {
    const list = sheet.spriteFrames;
    for (const key of Object.keys(list)) {
        const frame = list[key];
        if (!frame) continue;
        const name = key.replace(/\.png$/i, '');
        if (!map.has(name)) map.set(name, frame); // 控件图先收，物品图不覆盖同名槽
    }
}

function loadLoose(list: SpriteFrame[], bundle: AssetManager.Bundle, theme: string, done: () => void): void {
    const loose = list.filter((asset): asset is SpriteFrame => asset instanceof SpriteFrame);
    frames = indexFrames(loose, bundle, theme);
    packed = false;
    if (!frames.size) {
        missingBundle = true;
        noteMissing('*');
    } else missingBundle = false;
    done();
}

function dropCurrent(): void {
    frames = null;
    packed = false;
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

function indexFrames(assets: SpriteFrame[], bundle: AssetManager.Bundle, dir = ''): Map<string, SpriteFrame> {
    const map = new Map<string, SpriteFrame>();
    const byUuid = new Map(assets.map((frame) => [frame.uuid, frame]));
    for (const info of bundle.getDirWithPath(dir, SpriteFrame)) {
        const parts = info.path.split('/').filter((part) => part && part !== 'spriteFrame');
        const name = parts[parts.length - 1]; // 主题目录在前，槽名在最后
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
        ensureEditorTheme(() => ensureEditorSheets(() => applyInEditorSlot(name, apply)));
    });
}

let editorThemeWait: Array<() => void> | null = null;

/** 还没人调用 setSkinTheme 时，有 ZooV7 图集就用它，否则按散图主题 */
function ensureEditorTheme(done: () => void): void {
    if (loadedTheme) return done();
    if (editorThemeWait) return void editorThemeWait.push(done);
    editorThemeWait = [done];
    queryUuid(SKIN_DB + '/ZooV7/ctrl.plist', (uuid) => {
        if (!loadedTheme) loadedTheme = uuid ? 'ZooV7' : 'LegacyV3';
        const pending = editorThemeWait ?? [];
        editorThemeWait = null;
        pending.forEach((fn) => fn());
    });
}

function ensureEditorSheets(done: () => void): void {
    if (editorSheets === loadedTheme && frames) return done();
    if (editorSheetWait) return void editorSheetWait.push(done);
    editorSheetWait = [done];
    const theme = loadedTheme;
    queryUuid(`${SKIN_DB}/${theme}/ctrl.plist`, (plistUuid) => {
        if (!plistUuid) {
            packed = false;
            return finishEditorSheets(theme);
        }
        loadEditorAtlas(plistUuid, (ctrl) => {
            if (!ctrl) {
                packed = false;
                return finishEditorSheets(theme);
            }
            const map = new Map<string, SpriteFrame>();
            frames = map;
            packed = true;
            missingBundle = false;
            addAtlas(map, ctrl);
            queryUuid(`${SKIN_DB}/${theme}/item.plist`, (itemUuid) => {
                if (!itemUuid) {
                    noteMissing('item');
                    return finishEditorSheets(theme);
                }
                loadEditorAtlas(itemUuid, (item) => {
                    if (item) addAtlas(map, item);
                    else noteMissing('item');
                    finishEditorSheets(theme);
                });
            });
        });
    });
}

function finishEditorSheets(theme: string): void {
    editorSheets = theme;
    if (!frames) frames = new Map();
    const pending = editorSheetWait ?? [];
    editorSheetWait = null;
    pending.forEach((fn) => fn());
}

function loadEditorAtlas(uuid: string, done: (sheet: SpriteAtlas | null) => void): void {
    assetManager.loadAny({ uuid }, (err: Error | null, asset: SpriteAtlas) => {
        if (err || !asset?.spriteFrames) return done(null);
        done(asset);
    });
}

function applyInEditorSlot(name: string, apply: (frame: SpriteFrame) => void): void {
    const hit = frames?.get(name);
    if (hit) return apply(hit);
    if (packed) { // 图集里没有这一槽，不再去找同名 png
        noteMissing(name);
        return apply(whiteFrame());
    }
    const queue = editorWait.get(name);
    if (queue) return queue.push(apply);
    editorWait.set(name, [apply]);
    const theme = loadedTheme;
    const url = theme ? `${SKIN_DB}/${theme}/${name}.png/spriteFrame` : `${SKIN_DB}/${name}.png/spriteFrame`;
    queryUuid(url, (uuid) => {
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
