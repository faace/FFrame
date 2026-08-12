#!/usr/bin/env node
/**
 * 扫描 .cursor/rules/*.mdc，重写 00-meta.mdc 中自动清单区。
 * 手写区（场景表、#rule 流程）不动。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const RULES_DIR = path.join(ROOT, '.cursor', 'rules');
const META_FILE = path.join(RULES_DIR, '00-meta.mdc');
const START = '<!-- AUTO-RULES-START -->';
const END = '<!-- AUTO-RULES-END -->';

function parseFrontmatter(raw) {
    if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return null;
    const end = raw.indexOf('\n---', 3);
    if (end < 0) return null;
    const fm = raw.slice(4, end).replace(/\r/g, '');
    const out = {};
    for (const line of fm.split('\n')) {
        const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (!m) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        out[m[1]] = v;
    }
    return out;
}

function triggerLabel(fm) {
    if (fm.alwaysApply === 'true') return 'Always';
    const parts = [];
    if (fm.globs) parts.push(`globs: \`${fm.globs}\``);
    if (fm.description) parts.push('Agent/按需');
    return parts.length ? parts.join('；') : 'Manual/@';
}

function buildAutoBlock(entries) {
    const lines = [
        START,
        '',
        '| 规则 | 触发 | description |',
        '|------|------|-------------|',
    ];
    for (const e of entries) {
        const desc = (e.description || '（无）').replace(/\|/g, '\\|');
        lines.push(`| \`${e.name}\` | ${e.trigger} | ${desc} |`);
    }
    lines.push('', END);
    return lines.join('\n');
}

function main() {
    if (!fs.existsSync(META_FILE)) {
        console.error('[sync-cursor-rules-index] 缺少', META_FILE);
        process.exit(1);
    }

    const files = fs.readdirSync(RULES_DIR)
        .filter((f) => f.endsWith('.mdc'))
        .sort((a, b) => a.localeCompare(b));

    const entries = [];
    for (const name of files) {
        const raw = fs.readFileSync(path.join(RULES_DIR, name), 'utf8');
        const fm = parseFrontmatter(raw) || {};
        entries.push({
            name,
            description: fm.description || '',
            trigger: triggerLabel(fm),
        });
    }

    const meta = fs.readFileSync(META_FILE, 'utf8');
    const i0 = meta.indexOf(START);
    const i1 = meta.indexOf(END);
    if (i0 < 0 || i1 < 0 || i1 < i0) {
        console.error('[sync-cursor-rules-index] 00-meta.mdc 缺少 AUTO-RULES 标记');
        process.exit(1);
    }

    const next = meta.slice(0, i0) + buildAutoBlock(entries) + meta.slice(i1 + END.length);
    fs.writeFileSync(META_FILE, next, 'utf8');
    console.log(`[sync-cursor-rules-index] 已更新清单：${entries.length} 条 → ${path.relative(ROOT, META_FILE)}`);
}

main();
