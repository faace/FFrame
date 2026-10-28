import { assetManager, AssetManager, settings, SpriteFrame, Texture2D } from 'cc';
import { EDITOR, PREVIEW } from 'cc/env';
import type { GMAsyncComplete } from '../resource/GMAsyncCallback';

/** 游戏界面图所在 Bundle。资源在 assets/game/bundles/Skin，不在 gmajor */
export const SKIN_BUNDLE = 'Skin';

const SKIN_DB = 'db://assets/game/bundles/Skin';
const BUILTIN_WHITE = '7d8f9b89-4fd1-4c9f-a3ab-38ec7cded7ca@f9941'; // default_sprite_splash

const editing = EDITOR && !PREVIEW;

let frames: Map<string, SpriteFrame> | null = null;
let waiters: Array<GMAsyncComplete> | null = null;
let missingBundle = false;
const logged = new Set<string>();
let white: SpriteFrame | null = null;
const editorWait = new Map<string, Array<(frame: SpriteFrame) => void>>();

type EditorHost = {
    Message?: { request: (module: string, method: string, url: string) => Promise<string> };
};

/** 开机或使用方调用。没有 Skin 包也算完成，缺的槽用白图 */
export function loadSkin(onComplete: GMAsyncComplete): void {
    if (frames) return onComplete(null);
    if (waiters) return waiters.push(onComplete);
    waiters = [onComplete];
    if (editing) {
        frames = new Map();
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
            missingBundle = true;
            frames = new Map();
            noteMissing('*');
            finish(null);
            return;
        }
        bundle.loadDir('', SpriteFrame, (_loadErr, assets) => {
            frames = indexFrames(assets ?? [], bundle);
            if (!frames.size) {
                missingBundle = true;
                noteMissing('*');
            }
            finish(null);
        });
    });
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
