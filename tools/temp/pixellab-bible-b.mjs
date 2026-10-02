import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "素材", "试用", "圣经-B");
const style =
    "Stardew Valley 16-bit pixel art, cozy farm warmth, limited palette, 1px hard outlines, no anti-aliasing, no text, no watermark";

const jobs = [
    { file: "palette-1.png", w: 96, h: 32, bg: false, description: `${style}, horizontal color palette strip, 12 flat square swatches in one row: cream, wheat gold, moss green, dirt brown, stone gray, sky teal, wood, coal, copper, steel, dusk purple, lantern yellow` },
    { file: "palette-2.png", w: 96, h: 32, bg: false, description: `${style}, horizontal color palette strip, 12 flat square swatches, slightly duskier mine tones: ochre, rust, slate, pine, parchment, copper ore, lamp orange` },
    { file: "palette-3.png", w: 96, h: 32, bg: false, description: `${style}, horizontal color palette strip, 12 flat square swatches, brighter spring farm plus mine: grass, sky, soil, wood, iron, gold fleck` },
    { file: "tile-1.png", w: 32, h: 32, bg: true, description: `${style}, top-down seamless square packed dirt cave floor tile, small pebbles, mine shaft ground, no frame` },
    { file: "tile-2.png", w: 32, h: 32, bg: true, description: `${style}, top-down seamless square dark stone mine floor tile, grey rock, tiny copper flecks, no frame` },
    { file: "tile-3.png", w: 32, h: 32, bg: true, description: `${style}, top-down seamless square wooden mine shaft plank floor tile, nail heads, no frame` },
    { file: "worker-1.png", w: 32, h: 64, bg: true, description: `${style}, south-facing full-body miner standing idle, Stardew villager proportions, brown hair, beige shirt, dark pants, pickaxe in hand` },
    { file: "worker-2.png", w: 32, h: 64, bg: true, description: `${style}, south-facing full-body miner standing idle, straw hat, orange shirt, pickaxe on shoulder` },
    { file: "worker-3.png", w: 32, h: 64, bg: true, description: `${style}, south-facing full-body cute short miner standing idle, lantern on belt, pickaxe` },
    { file: "panel-1.png", w: 96, h: 64, bg: true, description: `${style}, empty 9-slice game UI window, wooden frame, parchment center, simple corner ornaments, no buttons, no text` },
    { file: "panel-2.png", w: 96, h: 64, bg: true, description: `${style}, empty 9-slice game UI window, dark wood border, cream stone fill, no buttons, no text` },
    { file: "panel-3.png", w: 96, h: 64, bg: true, description: `${style}, empty 9-slice cozy UI window, green cloth center, wooden rim, no buttons, no text` },
];

function readToken() {
    const fromEnv = process.env.PIXELLAB_TOKEN;
    if (fromEnv) return fromEnv;
    const mcp = JSON.parse(readFileSync(join(process.env.USERPROFILE, ".cursor", "mcp.json"), "utf8"));
    const header = mcp?.mcpServers?.pixellab?.headers?.Authorization || "";
    const token = header.replace(/^Bearer\s+/i, "").trim();
    if (!token) throw new Error("no PixelLab token");
    return token;
}

async function generate(token, job) {
    const res = await fetch("https://api.pixellab.ai/v2/create-image-pixen", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            description: job.description,
            image_size: { width: job.w, height: job.h },
            no_background: job.bg,
        }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${job.file} ${res.status} ${text.slice(0, 400)}`);
    const data = JSON.parse(text);
    const b64 = data?.image?.base64;
    if (!b64) throw new Error(`${job.file} no image: ${text.slice(0, 400)}`);
    writeFileSync(join(outDir, job.file), Buffer.from(b64, "base64"));
    return data.usage;
}

mkdirSync(outDir, { recursive: true });
const token = readToken();
const log = [];
for (const job of jobs) {
    const started = Date.now();
    process.stdout.write(`gen ${job.file} ... `);
    try {
        const usage = await generate(token, job);
        console.log(`ok ${Date.now() - started}ms`, usage);
        log.push({ ...job, ok: true, usage, ms: Date.now() - started });
    } catch (err) {
        console.log(`fail ${err.message}`);
        log.push({ file: job.file, ok: false, error: String(err.message) });
    }
}
writeFileSync(join(outDir, "prompts.json"), JSON.stringify({ style, jobs: log }, null, 2));
const cards = log.map((job) => {
    const src = job.file;
    const ok = job.ok !== false;
    return `<article class="card">
            <h3>${src}${ok ? "" : " · 失败"}</h3>
            <div class="stage">${ok ? `<img src="${src}" alt="${src}">` : "<p class=meta>生成失败</p>"}</div>
            <p class="meta">${(job.description || job.error || "").replace(/</g, "")}</p>
        </article>`;
});
const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>素材预览</title>
<style>
body{margin:0;background:#1a1814;color:#f4efe4;font:15px/1.5 "Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:28px 18px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.card{background:#2a261f;border:1px solid #3f392e;border-radius:10px;padding:12px}
.stage{display:flex;align-items:center;justify-content:center;min-height:180px;background:#241f19;border-radius:8px}
.stage img{image-rendering:pixelated;height:128px;width:auto}
.meta{font-size:12px;color:#9a9184}
@media(max-width:800px){.row{grid-template-columns:1fr}}
</style></head>
<body><div class="wrap"><h1>素材预览</h1>
<p class="meta">最近邻放大。生成失败的格子会标出来。</p>
<div class="row">${cards.join("\n")}</div>
</div></body></html>
`;
writeFileSync(join(outDir, "preview.html"), html);
console.log("done", outDir);
