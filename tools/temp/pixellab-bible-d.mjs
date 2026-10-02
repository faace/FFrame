import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = join(root, "docs", "素材", "试用", "圣经-D");
const style =
    "Stardew Valley warm 16-bit pixel art, Terraria side-view front-view, limited palette, 1px hard outlines, no anti-aliasing, no watermark";

const cellHint =
    "ONE complete underground mine CELL, taller than wide, NOT a landscape. " +
    "OUTER CONTOUR: thick dark cave-rock rim completely surrounding all four sides like a window into a dug-out shaft. " +
    "INSIDE the rim: a clear 3-columns by 4-rows grid of square ore tiles (exactly 12 tiles), grey packed stones, some tiles have gold chunks embedded, thin dark grid lines between tiles. " +
    "Front-view cross-section, no character, no sky, no house, no tree, no well, no text, no readable letters";

const jobs = [
    {
        file: "cell-1.png",
        w: 64,
        h: 80,
        bg: false,
        description: `${style}, ${cellHint}, compact 64 by 80 canvas, the rim is about 4 pixels thick`,
    },
    {
        file: "cell-2.png",
        w: 48,
        h: 64,
        bg: false,
        description: `${style}, ${cellHint}, canvas is exactly 3 by 4 of 16-pixel tiles plus the rim squeezed to the edges`,
    },
    {
        file: "cell-3.png",
        w: 96,
        h: 128,
        bg: false,
        description: `${style}, ${cellHint}, larger 96 by 128 canvas so the 3 by 4 grid is obvious, wooden-stone frame optional on the rim`,
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

function authHeaders(token) {
    return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function collectImages(data) {
    const list = [];
    const push = (item) => {
        const b64 = item?.base64 || item?.image?.base64;
        if (b64) list.push(b64);
    };
    if (data?.image?.base64) push(data.image);
    if (Array.isArray(data?.images)) data.images.forEach(push);
    if (Array.isArray(data?.last_response?.images)) data.last_response.images.forEach(push);
    return list;
}

async function postJson(token, path, body) {
    const res = await fetch(`https://api.pixellab.ai${path}`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${path} ${res.status} ${text.slice(0, 480)}`);
    return JSON.parse(text);
}

async function pollJob(token, jobId, label) {
    for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 4000));
        const res = await fetch(`https://api.pixellab.ai/v2/background-jobs/${jobId}`, {
            headers: authHeaders(token),
        });
        const text = await res.text();
        if (!res.ok) throw new Error(`poll ${res.status} ${text.slice(0, 360)}`);
        const data = JSON.parse(text);
        const status = data.status || data.last_response?.status;
        process.stdout.write(`\r${label} job ${status || "?"} ${data.progress ?? ""}   `);
        if (status === "completed" || status === "done") return data;
        if (status === "failed") throw new Error(`job failed ${text.slice(0, 360)}`);
        if (collectImages(data).length && (status === "completed" || data.last_response?.status === "completed")) {
            return data;
        }
    }
    throw new Error(`poll timeout ${jobId}`);
}

async function generatePixen(token, job, w, h) {
    const data = await postJson(token, "/v2/create-image-pixen", {
        description: job.description,
        image_size: { width: w, height: h },
        no_background: job.bg,
    });
    const images = collectImages(data);
    if (!images.length) throw new Error(`no image ${JSON.stringify(data).slice(0, 360)}`);
    writeFileSync(join(outDir, job.file), Buffer.from(images[0], "base64"));
    return { usage: data.usage, w, h };
}

async function generateCell(token, job) {
    try {
        return await generatePixen(token, job, job.w, job.h);
    } catch (err) {
        if (!job.alt) throw err;
        console.log(`retry ${job.file} ${job.alt[0]}x${job.alt[1]} (${err.message.slice(0, 80)})`);
        return await generatePixen(token, job, job.alt[0], job.alt[1]);
    }
}

function saveAnimFrames(images, prefix) {
    const files = [];
    images.forEach((b64, i) => {
        const file = `${prefix}-${i}.png`;
        writeFileSync(join(outDir, file), Buffer.from(b64, "base64"));
        files.push(file);
    });
    return files;
}

async function generateMineAnim(token) {
    const workerPath = join(root, "docs", "素材", "试用", "圣经-C", "worker-2.png");
    const first = {
        type: "base64",
        format: "png",
        base64: readFileSync(workerPath).toString("base64"),
    };
    const body = {
        first_frame: first,
        action: "side-view miner facing right, yellow hard hat stays on, swings pickaxe down in a mining strike then lifts it back, looping pickaxe swing, no extra effects, no particles, no text",
        frame_count: 4,
        no_background: true,
    };
    process.stdout.write("anim mine-v3 32x64 x4 ... ");
    const started = await postJson(token, "/v2/animate-with-text-v3", body);
    let data = started;
    const jobId = started.background_job_id || started.job_id;
    if (jobId && !collectImages(started).length) {
        console.log(`job ${jobId}`);
        data = await pollJob(token, jobId, "anim");
        console.log("");
    }
    const images = collectImages(data);
    if (!images.length) throw new Error(`no anim frames ${JSON.stringify(data).slice(0, 480)}`);
    const files = saveAnimFrames(images, "mine");
    return { files, usage: data.usage || data.last_response?.usage, rawKeys: Object.keys(data) };
}

mkdirSync(outDir, { recursive: true });
const token = readToken();
const log = [];

for (const job of jobs) {
    const started = Date.now();
    process.stdout.write(`gen ${job.file} ${job.w}x${job.h} ... `);
    try {
        const info = await generateCell(token, job);
        console.log(`ok ${info.w}x${info.h} ${Date.now() - started}ms`, info.usage);
        log.push({ ...job, ok: true, outW: info.w, outH: info.h, usage: info.usage, ms: Date.now() - started });
    } catch (err) {
        console.log(`fail ${err.message}`);
        log.push({ file: job.file, ok: false, error: String(err.message) });
    }
}

try {
    const started = Date.now();
    const info = await generateMineAnim(token);
    console.log(`ok frames ${info.files.join(",")} ${Date.now() - started}ms`, info.usage);
    log.push({ file: "mine-*.png", ok: true, files: info.files, usage: info.usage, ms: Date.now() - started });
} catch (err) {
    console.log(`fail ${err.message}`);
    log.push({ file: "mine-*.png", ok: false, error: String(err.message) });
}

writeFileSync(join(outDir, "prompts.json"), JSON.stringify({ style, jobs: log }, null, 2));
console.log("done", outDir);
