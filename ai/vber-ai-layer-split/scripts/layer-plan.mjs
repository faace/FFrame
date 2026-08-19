#!/usr/bin/env node

import fs from "node:fs";

function readJson(path) {
    return JSON.parse(fs.readFileSync(path, "utf8"));
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

export function validatePlan(input) {
    const errors = [];
    const warnings = [];
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        return { errors: ["计划必须是 JSON 对象"], warnings, plan: null };
    }
    if (input.version !== 1) errors.push("version 必须为 1");
    if (typeof input.imageName !== "string" || !input.imageName.trim()) errors.push("imageName 不能为空");
    const source = input.source || {};
    if (!isFiniteNumber(source.width) || source.width <= 0) errors.push("source.width 必须为正数");
    if (!isFiniteNumber(source.height) || source.height <= 0) errors.push("source.height 必须为正数");
    if (!Array.isArray(input.regions)) errors.push("regions 必须是数组");

    const ids = new Set();
    const reuse = new Map();
    const regions = Array.isArray(input.regions) ? input.regions.map((region, index) => {
        const path = `regions[${index}]`;
        if (!region || typeof region !== "object" || Array.isArray(region)) {
            errors.push(`${path} 必须是对象`);
            return null;
        }
        const id = typeof region.id === "string" ? region.id.trim() : "";
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) errors.push(`${path}.id 必须使用小写连字符格式`);
        if (ids.has(id)) errors.push(`${path}.id 重复: ${id}`);
        ids.add(id);
        if (typeof region.name !== "string" || !region.name.trim()) errors.push(`${path}.name 不能为空`);
        const rect = region.rect || {};
        for (const key of ["x", "y", "width", "height"]) {
            if (!isFiniteNumber(rect[key])) errors.push(`${path}.rect.${key} 必须是有限数字`);
        }
        if (isFiniteNumber(rect.width) && rect.width <= 0) errors.push(`${path}.rect.width 必须为正数`);
        if (isFiniteNumber(rect.height) && rect.height <= 0) errors.push(`${path}.rect.height 必须为正数`);
        if (isFiniteNumber(rect.x) && rect.x < 0) errors.push(`${path}.rect.x 不能为负数`);
        if (isFiniteNumber(rect.y) && rect.y < 0) errors.push(`${path}.rect.y 不能为负数`);
        if (isFiniteNumber(source.width) && isFiniteNumber(rect.x) && isFiniteNumber(rect.width) && rect.x + rect.width > source.width) errors.push(`${path} 超出源图右边界`);
        if (isFiniteNumber(source.height) && isFiniteNumber(rect.y) && isFiniteNumber(rect.height) && rect.y + rect.height > source.height) errors.push(`${path} 超出源图下边界`);
        const priority = Number.isInteger(region.priority) ? region.priority : 0;
        if (!Number.isInteger(region.priority)) warnings.push(`${path}.priority 未提供整数，已使用 0`);
        const include = region.include !== false;
        const reuseKey = typeof region.reuseKey === "string" && region.reuseKey.trim() ? region.reuseKey.trim() : id;
        if (include) {
            const prior = reuse.get(reuseKey);
            if (prior && input.options?.deduplicate !== false) warnings.push(`${path} 与 ${prior} 使用相同 reuseKey: ${reuseKey}`);
            else reuse.set(reuseKey, id);
        }
        return {
            ...region,
            id,
            name: typeof region.name === "string" ? region.name.trim() : "",
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            priority,
            reuseKey,
            include
        };
    }).filter(Boolean) : [];

    for (let i = 0; i < regions.length; i++) {
        if (!regions[i].include) continue;
        for (let j = i + 1; j < regions.length; j++) {
            if (!regions[j].include) continue;
            const overlap = overlapRatio(regions[i].rect, regions[j].rect);
            if (overlap >= 0.9 && regions[i].reuseKey !== regions[j].reuseKey) {
                warnings.push(`${regions[i].id} 与 ${regions[j].id} 高度重合 (${Math.round(overlap * 100)}%)，请检查是否重复框选`);
            }
        }
    }

    const plan = {
        ...input,
        imageName: typeof input.imageName === "string" ? input.imageName.trim() : "",
        regions
    };
    return { errors, warnings, plan: errors.length ? null : plan };
}

export function overlapRatio(a, b) {
    const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
    const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    const intersection = width * height;
    if (!intersection) return 0;
    return intersection / Math.min(a.width * a.height, b.width * b.height);
}

export function targetOrder(plan) {
    return plan.regions
        .map((region, index) => ({ region, index }))
        .filter(({ region }) => region.include !== false)
        .sort((a, b) => b.region.priority - a.region.priority || a.index - b.index)
        .map(({ region }) => region.id);
}

export function adjacentMoves(current, target) {
    if (!Array.isArray(current) || !Array.isArray(target)) throw new Error("current 和 target 必须是数组");
    if (current.length !== target.length || [...current].sort().join("\0") !== [...target].sort().join("\0")) {
        throw new Error("current 与 target 必须包含完全相同的唯一 ID");
    }
    const work = [...current];
    const moves = [];
    for (let desiredIndex = 0; desiredIndex < target.length; desiredIndex++) {
        const id = target[desiredIndex];
        let currentIndex = work.indexOf(id);
        while (currentIndex > desiredIndex) {
            moves.push({ id, direction: "up", from: currentIndex, to: currentIndex - 1 });
            [work[currentIndex - 1], work[currentIndex]] = [work[currentIndex], work[currentIndex - 1]];
            currentIndex--;
        }
    }
    return moves;
}

function print(value) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [command, ...args] = process.argv.slice(2);
    try {
        if (command === "validate" && args.length === 1) {
            const result = validatePlan(readJson(args[0]));
            print(result);
            if (result.errors.length) process.exitCode = 1;
        } else if (command === "target" && args.length === 1) {
            const result = validatePlan(readJson(args[0]));
            if (result.errors.length) throw new Error(result.errors.join("; "));
            print(targetOrder(result.plan));
        } else if (command === "moves" && args.length === 2) {
            print(adjacentMoves(readJson(args[0]), readJson(args[1])));
        } else {
            throw new Error("用法: layer-plan.mjs validate <plan.json> | target <plan.json> | moves <current.json> <target.json>");
        }
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
        process.exitCode = 1;
    }
}

