/** 项目配置（拷贝新游戏改这里；不要写进 gmajor） */
export const config = {
    v: 1, // 本文件格式
    version: { app: '0.1.0' }, // 游戏版本
    boot: ['Widget', 'User', 'Setting'], // Widget 最先常驻；User 登录后再从开机拿掉
};
