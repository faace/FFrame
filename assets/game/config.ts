/** 项目配置（跟 game/ 走；gmajor 不 import 本文件） */
export const config = {
    v: 1, // 本文件格式
    version: { app: '0.1.0', gmajor: '0.5.1' }, // app 版本；gmajor = 按哪个框架版本写的，开机只打日志比对
    boot: ['GameUI', 'User', 'Setting'], // 常驻；按平台再拆后置
    entry: { web: 'DemoHome' }, // role → 入口包；缺 key 则 gm.boot 失败
    alert: { bundle: 'GameUI', prefab: 'LyAlert' }, // 确认框皮；GameUI onBind 预载
    skinTheme: 'ZooV7', // bundles/Skin 下的主题目录；改成 LegacyV3 用旧的逐张图
};
