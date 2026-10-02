import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";

const dir = join("d:/creator/FFrame/docs/素材/试用/圣经-D");

function readPng(path) {
    const buf = readFileSync(path);
    let off = 8;
    let w = 0, h = 0, bit = 8, color = 6;
    const chunks = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString("ascii", off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === "IHDR") {
            w = data.readUInt32BE(0);
            h = data.readUInt32BE(4);
            bit = data[8];
            color = data[9];
        }
        if (type === "IDAT") chunks.push(data);
        off += 12 + len;
        if (type === "IEND") break;
    }
    const raw = inflateSync(Buffer.concat(chunks));
    const bpp = color === 6 ? 4 : color === 2 ? 3 : 0;
    if (!bpp || bit !== 8) throw new Error(`unsupported ${path} color=${color} bit=${bit}`);
    const stride = w * bpp;
    const pixels = Buffer.alloc(w * h * 4);
    let src = 0;
    for (let y = 0; y < h; y++) {
        const filter = raw[src++];
        const row = raw.subarray(src, src + stride);
        src += stride;
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            const r = row[x * bpp];
            const g = row[x * bpp + 1];
            const b = row[x * bpp + 2];
            const a = bpp === 4 ? row[x * bpp + 3] : 255;
            let pr = r, pg = g, pb = b, pa = a;
            if (filter === 1 && x > 0) {
                pr += pixels[i - 4]; pg += pixels[i - 3]; pb += pixels[i - 2]; pa += pixels[i - 1];
            } else if (filter === 2 && y > 0) {
                const u = ((y - 1) * w + x) * 4;
                pr += pixels[u]; pg += pixels[u + 1]; pb += pixels[u + 2]; pa += pixels[u + 3];
            }
            pixels[i] = pr & 255; pixels[i + 1] = pg & 255; pixels[i + 2] = pb & 255; pixels[i + 3] = pa & 255;
        }
    }
    return { w, h, pixels };
}

function diff(a, b) {
    const n = a.pixels.length / 4;
    let d = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
        if (a.pixels[i] !== b.pixels[i] || a.pixels[i + 1] !== b.pixels[i + 1] || a.pixels[i + 2] !== b.pixels[i + 2] || a.pixels[i + 3] !== b.pixels[i + 3]) d++;
    }
    return `${d}/${n} (${((100 * d) / n).toFixed(1)}%)`;
}

for (const name of ["cell-1.png", "cell-2.png", "cell-3.png", "mine-0.png", "mine-1.png", "mine-2.png", "mine-3.png", "mine-4.png"]) {
    const img = readPng(join(dir, name));
    console.log(name, `${img.w}x${img.h}`);
}
const frames = [0, 1, 2, 3, 4].map((i) => readPng(join(dir, `mine-${i}.png`)));
for (let i = 0; i < 4; i++) console.log(`mine-${i} vs mine-${i + 1}:`, diff(frames[i], frames[i + 1]));
console.log("mine-0 vs mine-4:", diff(frames[0], frames[4]));
