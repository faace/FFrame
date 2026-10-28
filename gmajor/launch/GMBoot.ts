import type { GMAsyncComplete, GMAsyncProgress } from '../resource/GMAsyncCallback';

/** 项目开机配置（住 game/config；gmajor 不 import 该文件） */
export type GMGameConfig = {
    v?: number;
    version: { app: string };
    boot: string[]; // 常驻包，每进程都绑
    entry: { [role: string]: string }; // 参数 → 入口包；缺 key 则失败
    alert: { bundle: string; prefab: string }; // 确认框皮
};

export type GMBootOpts = {
    role: string; // 测试覆盖；默认 gp.params.role || 'web'
};
