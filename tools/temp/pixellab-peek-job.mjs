import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

function crc32(buf) {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
        c ^= buf[i];
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return ~c >>> 0;
}

function chunk(type, data) {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    out.write(type, 4);
    data.copy(out, 8);
    const crcBuf = Buffer.concat([Buffer.from(type), data]);
    out.writeUInt32BE(crc32(crcBuf), 8 + data.length);
    return out;
}

function rgbaToPng(rgba, w, h) {
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
        raw[y * (w * 4 + 1)] = 0;
        rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0);
    ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

function saveMaybePng(b64, name, w, h) {
    const buf = Buffer.from(b64, "base64");
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    const png = isPng ? buf : rgbaToPng(buf, w, h);
    const path = join("d:/creator/FFrame/docs/素材/试用/圣经-E", name);
    writeFileSync(path, png);
    console.log("wrote", name, isPng ? "png" : `rgba->png ${w}x${h}`, png.length);
}

const mcp = JSON.parse(readFileSync(join(process.env.USERPROFILE, ".cursor", "mcp.json"), "utf8"));
const token = (mcp?.mcpServers?.pixellab?.headers?.Authorization || "").replace(/^Bearer\s+/i, "").trim();
const jobId = process.argv[2];
const res = await fetch(`https://api.pixellab.ai/v2/background-jobs/${jobId}`, {
    headers: { Authorization: `Bearer ${token}` },
});
const data = await res.json();
const lr = data.last_response || {};
const walk = (obj, prefix) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            if (typeof v.base64 === "string") console.log(p, "has base64", v.base64.length);
            else walk(v, p);
        } else if (Array.isArray(v)) {
            console.log(p, "array", v.length, v[0] && typeof v[0] === "object" ? Object.keys(v[0]) : typeof v[0]);
            if (v[0] && v[0].base64) console.log(p + "[0].base64", v[0].base64.length);
        } else if (k !== "base64") {
            console.log(p, typeof v === "string" && v.length > 80 ? `${v.slice(0, 60)}...` : v);
        }
    }
};
console.log("top", Object.keys(data));
walk(data, "");
if (lr.image?.base64) saveMaybePng(lr.image.base64, "miner-empty-2.png", 32, 64);
if (lr.quantized_image?.base64) saveMaybePng(lr.quantized_image.base64, "miner-empty-2q.png", 32, 64);
