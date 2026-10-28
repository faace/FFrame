import type { GMAsyncCompleteWith } from '../resource/GMAsyncCallback';
import type { GMEventManager } from '../event/GMEventManager';

/**
 * 平台身份 + 本进程 TS↔外面的通道。游戏只握 gp。
 * 公开：call 问并等回；send 只发。主动推不走 gp.on，进 gm.events，名前缀 Gp。
 * 具名方法以后封装 call/send，二次处理后再 onComplete；msgid 不外露。
 */
export type GMPlatformId = 'web' | 'electron' | 'wechat' | 'android' | 'ios';

export type GMPlatformParams = { [key: string]: string }; // 普通对象；Web/Electron 填 URL query

export type GMPlatformMsg = {
    msgid: string; // 一次 call 的对账号；send / 主动推可空
    msgName: string; // 通道指令名；推送进事件时变成 Gp + 大驼峰
    msgData: unknown; // 入站已转成对象；带 error 字符串则当失败
};

const CALL_TIMEOUT_MS = 10000; // call 超时清 pending，避免泄漏

/** 从当前页 URL 取 query；无 location 则空表 */
export function readUrlParams(): GMPlatformParams {
    const href = (globalThis as { location?: { href?: string } }).location?.href;
    if (!href) return {};
    try {
        const out: GMPlatformParams = {};
        new URL(href).searchParams.forEach((v, k) => { out[k] = v; });
        return out;
    } catch {
        return {};
    }
}

/** ui-closed / getClip → UiClosed / GetClip */
export function toPascalName(name: string): string {
    const parts = name.split(/[-_.\s]+/);
    let out = '';
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p) continue;
        out += p.charAt(0).toUpperCase() + p.slice(1);
    }
    if (out) return out;
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

/** 平台推送事件名：大类前缀 Gp + 大驼峰。已是 GpX 则不叠 */
export function toGpEventName(msgName: string): string {
    const pascal = toPascalName(msgName);
    if (/^Gp[A-Z]/.test(pascal)) return pascal;
    return 'Gp' + pascal;
}

/** 平台基类；Web 无通道。Electron/原生子类 override wire*，入站调 recv */
export class GMPlatform {
    private seq = 0; // msgid 序号
    private readonly pending: { [id: string]: GMAsyncCompleteWith<unknown> } = {}; // 等待回包的 call
    private readonly pendingTimer: { [id: string]: ReturnType<typeof setTimeout> } = {}; // 对应超时器
    private events: GMEventManager | null = null; // 启动器注入；推送走这里

    constructor(
        readonly id: GMPlatformId, // web / electron / wechat / android / ios
        readonly params: GMPlatformParams, // 启动参数，如 ?role=
        readonly hasWindow = false, // 能否开第二扇 OS 窗；仅 electron
    ) {}

    /** 仅 GMLauncher 调用，接到全局事件总线 */
    attachEvents(events: GMEventManager): void {
        this.events = events;
    }

    /** 问外面并等回包。onComplete(err, data)；无通道立刻失败，不挡开机 */
    call(name: string, data: unknown, onComplete: GMAsyncCompleteWith<unknown>): void {
        if (!name) return onComplete(new Error('[gp.call] 缺 name'));
        const msgid = this.nextId();
        this.pending[msgid] = onComplete;
        this.pendingTimer[msgid] = setTimeout(() => {
            this.finish(msgid, new Error(`[gp.call] 超时 ${name}`));
        }, CALL_TIMEOUT_MS);
        if (this.wireCall({ msgid, msgName: name, msgData: data ?? {} })) return; // 子类已发出
        this.finish(msgid, new Error(`[gp.call] 无通道 ${name}`)); // 预览/Web
    }

    /** 只发不等回。埋点、ready 用这个；无通道则忽略 */
    send(name: string, data?: unknown): void {
        if (!name) return;
        this.wireSend({ msgid: '', msgName: name, msgData: data ?? {} });
    }

    /** 仅平台子类：ipc/jsb 回调里 this.recv(原文)。游戏禁止 gp.recv */
    protected recv(raw: unknown): void {
        const msg = this.decodeMsg(raw);
        if (!msg) return;
        if (msg.msgid && this.pending[msg.msgid]) {
            const pack = msg.msgData && typeof msg.msgData === 'object' && !Array.isArray(msg.msgData) ? msg.msgData as { error?: unknown } : null;
            if (pack && typeof pack.error === 'string') return this.finish(msg.msgid, new Error(pack.error));
            return this.finish(msg.msgid, null, msg.msgData);
        }
        this.emitPush(msg.msgName, msg.msgData);
    }

    /** 真正发「问」：有 ipc/jsb 的子类 override，发出后 return true */
    protected wireCall(_msg: GMPlatformMsg): boolean {
        return false; // 基类=无通道
    }

    /** 真正发「扔」：有通道的子类 override，发出后 return true */
    protected wireSend(_msg: GMPlatformMsg): boolean {
        return false;
    }

    private nextId(): string { // 生成本次 call 的 msgid
        this.seq += 1;
        return 'p' + this.seq;
    }

    /** 结束一次 call：摘 pending、清超时、喊 onComplete */
    private finish(msgid: string, err: Error | null, result?: unknown): void {
        const cb = this.pending[msgid];
        if (!cb) return;
        delete this.pending[msgid];
        const timer = this.pendingTimer[msgid];
        if (timer) {
            clearTimeout(timer);
            delete this.pendingTimer[msgid];
        }
        if (err) return cb(err);
        cb(null, result);
    }

    /** 把入站原文收成信封；字符串先 JSON.parse */
    private decodeMsg(raw: unknown): GMPlatformMsg | null {
        const root = this.toObject(raw);
        if (!root || root instanceof Error || typeof root !== 'object' || Array.isArray(root)) return null;
        const o = root as { msgid?: unknown; msgName?: unknown; msgData?: unknown };
        if (typeof o.msgName !== 'string' || !o.msgName) return null;
        const msgid = typeof o.msgid === 'string' ? o.msgid : '';
        let msgData: unknown = o.msgData;
        if (typeof msgData === 'string') msgData = this.toObject(msgData); // 底层常再包一层 JSON 字符串
        if (msgData instanceof Error) return null;
        return { msgid, msgName: o.msgName, msgData };
    }

    /** 已是对象原样返回；字符串则 parse，失败返回 Error */
    private toObject(raw: unknown): unknown {
        if (typeof raw !== 'string') return raw;
        const text = raw.trim();
        if (!text) return {};
        try {
            return JSON.parse(text);
        } catch {
            console.error('[gp] 入站 JSON 无法解析');
            return new Error('[gp] 入站 JSON 无法解析');
        }
    }

    /** 主动推：gm.events.emit('Gp' + 大驼峰)；游戏 this.on('GpUiClosed') */
    private emitPush(msgName: string, data: unknown): void {
        if (!this.events) return console.error('[gp] 事件总线未接');
        this.events.emit(toGpEventName(msgName), data);
    }
}
