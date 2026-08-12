/**
 * 带进度的异步回调约定（资源加载等共用）。
 * 签名尾部固定：onComplete 在前，onProgress 可选在后；不需要进度就不传。
 */

export type FFAsyncComplete = (err: Error | null) => void; // 成功时 err 为 null
export type FFAsyncProgress = (finished: number, total: number) => void; // 语义由具体 API 约定
