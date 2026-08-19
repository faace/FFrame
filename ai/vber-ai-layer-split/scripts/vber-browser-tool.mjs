function assertFiniteRect(rect, label) {
    if (!rect || typeof rect !== "object") throw new Error(`${label} 必须是矩形对象`);
    for (const key of ["x", "y", "width", "height"]) {
        if (typeof rect[key] !== "number" || !Number.isFinite(rect[key])) throw new Error(`${label}.${key} 必须是有限数字`);
    }
    if (rect.width <= 0 || rect.height <= 0) throw new Error(`${label} 宽高必须为正数`);
}

export function toViewportRect(sourceRect, sourceSize, displayedImageRect, insetPx = 0) {
    assertFiniteRect(sourceRect, "sourceRect");
    assertFiniteRect(displayedImageRect, "displayedImageRect");
    if (!sourceSize || !Number.isFinite(sourceSize.width) || !Number.isFinite(sourceSize.height) || sourceSize.width <= 0 || sourceSize.height <= 0) {
        throw new Error("sourceSize 必须包含正数 width 和 height");
    }
    const scaleX = displayedImageRect.width / sourceSize.width;
    const scaleY = displayedImageRect.height / sourceSize.height;
    const x = displayedImageRect.x + sourceRect.x * scaleX + insetPx;
    const y = displayedImageRect.y + sourceRect.y * scaleY + insetPx;
    const width = sourceRect.width * scaleX - insetPx * 2;
    const height = sourceRect.height * scaleY - insetPx * 2;
    if (width <= 1 || height <= 1) throw new Error("换算后的矩形过小，请减小 insetPx 或检查源矩形");
    return { x, y, width, height, scaleX, scaleY };
}

async function sleep(ms) {
    if (ms <= 0) return;
    await new Promise(resolve => setTimeout(resolve, ms));
}

export async function dragRectWithCdp(cdp, rect, options = {}) {
    assertFiniteRect(rect, "rect");
    if (!cdp || typeof cdp.send !== "function") throw new Error("需要支持 send(method, params) 的 CDP 会话");
    const steps = Number.isInteger(options.steps) && options.steps > 0 ? options.steps : 4;
    const startX = rect.x;
    const startY = rect.y;
    const endX = rect.x + rect.width;
    const endY = rect.y + rect.height;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: startX, y: startY });
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: startX, y: startY, button: "left", buttons: 1, clickCount: 1 });
    for (let step = 1; step <= steps; step++) {
        const ratio = step / steps;
        await cdp.send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x: startX + (endX - startX) * ratio,
            y: startY + (endY - startY) * ratio,
            button: "left",
            buttons: 1
        });
    }
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: endX, y: endY, button: "left", buttons: 0, clickCount: 1 });
}

export async function drawRegionsWithCdp(cdp, plan, displayedImageRect, options = {}) {
    if (!plan || plan.version !== 1 || !Array.isArray(plan.regions)) throw new Error("需要已经校验的 version 1 分层计划");
    const pauseMs = Number.isFinite(options.pauseMs) ? Math.max(0, options.pauseMs) : 80;
    const insetPx = Number.isFinite(options.insetPx) ? options.insetPx : 0;
    const included = plan.regions.filter(region => region.include !== false);
    const results = [];
    for (const region of included) {
        const viewportRect = toViewportRect(region.rect, plan.source, displayedImageRect, insetPx);
        await dragRectWithCdp(cdp, viewportRect, options);
        results.push({ id: region.id, viewportRect });
        await sleep(pauseMs);
    }
    return { drawn: results.length, regions: results };
}

