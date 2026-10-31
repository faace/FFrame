#!/usr/bin/env node
/**
 * Cubence 图像接口（OpenAI Images 兼容）。
 * 文档：https://docs.cubence.com/en/docs/image-models/gpt-image-2
 * 大陆线路 POST {base}/images/generations，模型 gpt-image-2，响应 data[0].b64_json。
 * 密钥不进仓库。读取顺序：环境变量 OPENAI_API_KEY，否则 %USERPROFILE%\.cursor\mcp\image.env。
 * 地址和模型以本文件常量为准；环境变量或 image.env 里的同名项可以覆盖。
 * 用法：node tools/image-gen.mjs --prompt "..." --out out.png
 *       node tools/image-gen.mjs --prompt-file prompt.txt --out out.png [--size 1024x1024] [--n 1]
 *       node tools/image-gen.mjs --show-config
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const IMAGE_BASE = 'https://api-lb.cubence.ai/v1'; // 大陆线路。全球 api.cubence.ai，境外 api.cubence.com
export const IMAGE_MODEL = 'gpt-image-2';

const KEY_FILE = path.join(process.env.USERPROFILE || '', '.cursor', 'mcp', 'image.env');

function parseEnvFile(text) {
    const out = {};
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 1) continue;
        out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return out;
}

function readKeyFile() {
    try {
        return parseEnvFile(readFileSync(KEY_FILE, 'utf8'));
    } catch {
        return {};
    }
}

/** 只返回密钥字符串。调用方不得打印。 */
export function loadApiKey() {
    if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
    const key = readKeyFile().OPENAI_API_KEY;
    if (!key) throw new Error('没有图像密钥。请设置 OPENAI_API_KEY，或写入 ' + KEY_FILE);
    return key;
}

export function resolveBase() {
    return (process.env.OPENAI_BASE_URL || readKeyFile().OPENAI_BASE_URL || IMAGE_BASE).replace(/\/$/, '');
}

export function resolveModel() {
    return process.env.OPENAI_IMAGE_MODEL || readKeyFile().OPENAI_IMAGE_MODEL || IMAGE_MODEL;
}

/** 调 /images/generations，返回 PNG 字节。 */
export async function generateImage({ prompt, size = '1024x1024', n = 1, model, base, apiKey } = {}) {
    if (!prompt) throw new Error('缺少 prompt');
    const key = apiKey || loadApiKey();
    const url = (base || resolveBase()).replace(/\/$/, '') + '/images/generations';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + key,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: model || resolveModel(),
            prompt,
            size,
            n,
        }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error('出图失败 ' + res.status + ' ' + raw.slice(0, 240));
    const b64 = JSON.parse(raw)?.data?.[0]?.b64_json;
    if (!b64) throw new Error('响应里没有图片');
    return Buffer.from(b64, 'base64');
}

function argValue(argv, name) {
    const i = argv.indexOf(name);
    if (i < 0 || i + 1 >= argv.length) return '';
    return argv[i + 1];
}

function isDirectRun() {
    const arg = process.argv[1];
    if (!arg) return false;
    return path.resolve(arg).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.includes('--show-config')) {
        let keyOk = false;
        try {
            loadApiKey();
            keyOk = true;
        } catch { /* 下面只报有没有 */ }
        console.log('base', resolveBase());
        console.log('model', resolveModel());
        console.log('key', keyOk ? '已读取（不显示）' : '没有');
        console.log('keyFile', KEY_FILE);
        if (!keyOk) process.exitCode = 1;
        return;
    }
    const promptFile = argValue(argv, '--prompt-file');
    const prompt = promptFile ? readFileSync(promptFile, 'utf8') : argValue(argv, '--prompt');
    const out = argValue(argv, '--out');
    if (!prompt || !out) {
        console.error('用法：node tools/image-gen.mjs --prompt "..." --out out.png');
        console.error('      node tools/image-gen.mjs --prompt-file prompt.txt --out out.png [--size 1024x1024] [--n 1]');
        process.exitCode = 1;
        return;
    }
    const size = argValue(argv, '--size') || '1024x1024';
    const n = Number(argValue(argv, '--n') || '1');
    const model = argValue(argv, '--model') || undefined;
    const base = argValue(argv, '--base') || undefined;
    const buf = await generateImage({ prompt, size, n, model, base });
    writeFileSync(out, buf);
    console.log('wrote', out, buf.length);
}

if (isDirectRun()) {
    main().catch((err) => {
        console.error(String(err.message || err).slice(0, 300));
        process.exitCode = 1;
    });
}
