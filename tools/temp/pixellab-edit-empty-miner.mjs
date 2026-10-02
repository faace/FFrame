import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "d:/creator/FFrame";
const src = join(root, "docs", "素材", "试用", "圣经-E", "miner-empty.png");
const out = join(root, "docs", "素材", "试用", "圣经-E", "miner-empty-2.png");
const mcp = JSON.parse(readFileSync(join(process.env.USERPROFILE, ".cursor", "mcp.json"), "utf8"));
const token = (mcp?.mcpServers?.pixellab?.headers?.Authorization || "").replace(/^Bearer\s+/i, "").trim();
const first = { type: "base64", format: "png", base64: readFileSync(src).toString("base64") };

const attempts = [
    {
        path: "/v2/edit-image",
        body: {
            image: first,
            image_size: { width: 32, height: 64 },
            width: 32,
            height: 64,
            description: "remove the pickaxe completely, empty hands, same miner, same pose, no tool",
        },
    },
];

function collect(data) {
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

for (const attempt of attempts) {
    process.stdout.write(`try ${attempt.path} ... `);
    const res = await fetch(`https://api.pixellab.ai${attempt.path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(attempt.body),
    });
    const text = await res.text();
    if (!res.ok) {
        console.log(`fail ${res.status} ${text.slice(0, 220)}`);
        continue;
    }
    const data = JSON.parse(text);
    const jobId = data.background_job_id || data.job_id;
    let result = data;
    if (jobId && !collect(data).length) {
        console.log(`job ${jobId}`);
        for (let i = 0; i < 60; i++) {
            await new Promise((r) => setTimeout(r, 4000));
            const poll = await fetch(`https://api.pixellab.ai/v2/background-jobs/${jobId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            result = JSON.parse(await poll.text());
            const status = result.status || result.last_response?.status;
            process.stdout.write(`\rjob ${status || "?"}   `);
            if (status === "completed" || status === "done" || status === "failed") break;
        }
        console.log("");
    }
    const images = collect(result);
    if (!images.length) {
        console.log("no image", Object.keys(result));
        continue;
    }
    writeFileSync(out, Buffer.from(images[0], "base64"));
    console.log("saved", out, result.usage || result.last_response?.usage);
    process.exit(0);
}
console.log("all attempts failed");
process.exit(1);
