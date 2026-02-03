/**
 * 延迟执行工具函数
 * @param ms 延迟时间（毫秒）
 * @returns Promise，在指定时间后 resolve
 * 
 * @example
 * await sleep(3000); // 延迟 3 秒
 * await sleep(500);  // 延迟 500 毫秒
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 为防止 API 频繁调用被限流，添加随机延迟
 * @param minMs 最小延迟时间（毫秒）
 * @param maxMs 最大延迟时间（毫秒）
 * @returns Promise
 * 
 * @example
 * await randomDelay(1000, 3000); // 随机延迟 1-3 秒
 */
export const randomDelay = (minMs: number, maxMs: number): Promise<void> => {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return sleep(delay);
};
