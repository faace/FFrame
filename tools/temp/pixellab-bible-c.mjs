import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "素材", "试用", "圣经-C");
const style =
    "Stardew Valley warm 16-bit pixel art, Terraria side-view front-view, limited palette, 1px hard outlines, no anti-aliasing, no watermark";

const jobs = [
    {
        file: "scene-1.png", w: 128, h: 64, bg: false,
        description: `${style}, wide side-view scene, LEFT a small wooden house, CENTER a wooden mine well / shaft entrance, RIGHT a large tree with a wooden signpost under it, blue sky and white clouds, grass dirt ground, no people, no readable letters on the sign`,
    },
    {
        file: "scene-2.png", w: 128, h: 64, bg: false,
        description: `${style}, wide side-view village-mine strip, left cottage, middle wooden well going into the ground, right oak tree and wooden sign board, bright blue sky fluffy clouds, short grass`,
    },
    {
        file: "well-1.png", w: 16, h: 32, bg: true, alt: [32, 32],
        description: `${style}, single wooden mine well, slight 3/4, rope and bucket, shaft hole in the ground, isolated sprite, no house, no tree`,
    },
    {
        file: "house-1.png", w: 32, h: 32, bg: true,
        description: `${style}, tiny wooden cottage side-view slight 3/4, brown roof, isolated sprite, no well`,
    },
    {
        file: "tree-1.png", w: 32, h: 48, bg: true,
        description: `${style}, large leafy tree side-view, wooden signpost under the canopy, isolated sprite, no readable text`,
    },
    {
        file: "cave-wall-1.png", w: 16, h: 16, bg: false, alt: [32, 32],
        description: `${style}, seamless tileable side-view cave wall rock, dark stone surrounding a pit, no gold, no character, edge-to-edge texture`,
    },
    {
        file: "cave-ore-1.png", w: 16, h: 16, bg: false, alt: [32, 32],
        description: `${style}, seamless tileable side-view cave fill, grey stones packed, a few embedded gold flecks, no character, edge-to-edge`,
    },
    {
        file: "cave-gold-1.png", w: 16, h: 16, bg: false, alt: [32, 32],
        description: `${style}, seamless tileable side-view ore block, dark rock with bright gold chunks embedded, no character, edge-to-edge`,
    },
    {
        file: "cave-hole-1.png", w: 32, h: 32, bg: true, alt: [32, 48],
        description: `${style}, side-view mine pit opening, rock rim surrounding a dark hole, looks like a cave mouth going down, isolated`,
    },
    {
        file: "worker-1.png", w: 16, h: 32, bg: true, alt: [32, 64],
        description: `${style}, side-view miner standing facing right, short body, brown miner's hat with lamp, pickaxe, isolated sprite`,
    },
    {
        file: "worker-2.png", w: 16, h: 32, bg: true, alt: [32, 64],
        description: `${style}, side-view miner standing facing right, yellow hard hat, orange shirt, pickaxe on shoulder, isolated sprite`,
    },
    {
        file: "worker-3.png", w: 16, h: 32, bg: true, alt: [32, 64],
        description: `${style}, side-view miner standing facing right, worn leather cap with candle, pickaxe and satchel, isolated sprite`,
    },
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

async function generateOnce(token, job, w, h) {
    const res = await fetch("https://api.pixellab.ai/v2/create-image-pixen", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            description: job.description,
            image_size: { width: w, height: h },
            no_background: job.bg,
        }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 360)}`);
    const data = JSON.parse(text);
    if (!data?.image?.base64) throw new Error(`no image ${text.slice(0, 360)}`);
    writeFileSync(join(outDir, job.file), Buffer.from(data.image.base64, "base64"));
    return { usage: data.usage, w, h };
}

async function generate(token, job) {
    try {
        return await generateOnce(token, job, job.w, job.h);
    } catch (err) {
        if (!job.alt) throw err;
        console.log(`retry ${job.file} ${job.alt[0]}x${job.alt[1]} (${err.message.slice(0, 80)})`);
        return await generateOnce(token, job, job.alt[0], job.alt[1]);
    }
}

mkdirSync(outDir, { recursive: true });
const token = readToken();
const log = [];
for (const job of jobs) {
    const started = Date.now();
    process.stdout.write(`gen ${job.file} ${job.w}x${job.h} ... `);
    try {
        const info = await generate(token, job);
        console.log(`ok ${info.w}x${info.h} ${Date.now() - started}ms`, info.usage);
        log.push({ ...job, ok: true, outW: info.w, outH: info.h, usage: info.usage, ms: Date.now() - started });
    } catch (err) {
        console.log(`fail ${err.message}`);
        log.push({ file: job.file, ok: false, error: String(err.message) });
    }
}
writeFileSync(join(outDir, "prompts.json"), JSON.stringify({ style, jobs: log }, null, 2));
console.log("done", outDir);
