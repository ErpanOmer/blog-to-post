import type { Env } from "../types";
import fetchJuejinTopTitles from "../juejin";

const CACHE_KEY = "juejin:titles";
const CACHE_TIMESTAMP_KEY = "juejin:titles:timestamp";
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24小时

interface TitlesData {
	userTitles: string[];
	juejinTitles: string[];
}

/**
 * 获取掘金Top20标题，带服务器端缓存
 * 缓存24小时，过期后自动刷新
 */
export async function getCachedJuejinTitles(env: Env): Promise<TitlesData> {
	try {
		// 尝试从KV缓存获取
		const cachedData = await env.PROMPTS.get(CACHE_KEY);
		const cachedTimestamp = await env.PROMPTS.get(CACHE_TIMESTAMP_KEY);

		if (cachedData && cachedTimestamp) {
			const timestamp = parseInt(cachedTimestamp, 10);
			const now = Date.now();

			// 检查缓存是否过期
			if (now - timestamp < CACHE_EXPIRY_MS) {
				console.log("[JuejinCache] 使用KV缓存数据");
				return JSON.parse(cachedData) as TitlesData;
			}
		}

		// 缓存不存在或已过期，从源获取
		console.log("[JuejinCache] 缓存过期，重新获取掘金标题");
		return await refreshJuejinCache(env);
	} catch (error) {
		console.error("[JuejinCache] 获取缓存失败:", error);
		// 如果缓存获取失败，直接获取新数据
		return await refreshJuejinCache(env);
	}
}

/**
 * 强制刷新掘金标题缓存
 */
export async function refreshJuejinCache(env: Env): Promise<TitlesData> {
	try {
		const titlesData = await fetchJuejinTopTitles();

		// 保存到KV缓存
		await env.PROMPTS.put(CACHE_KEY, JSON.stringify(titlesData));
		await env.PROMPTS.put(CACHE_TIMESTAMP_KEY, Date.now().toString());

		console.log("[JuejinCache] 缓存已刷新");
		return titlesData;
	} catch (error) {
		console.error("[JuejinCache] 刷新缓存失败:", error);
		// 如果刷新失败，返回空数据
		return { userTitles: [], juejinTitles: [] };
	}
}

/**
 * 检查缓存是否有效（未过期）
 */
export async function isCacheValid(env: Env): Promise<boolean> {
	try {
		const cachedTimestamp = await env.PROMPTS.get(CACHE_TIMESTAMP_KEY);
		if (!cachedTimestamp) return false;

		const timestamp = parseInt(cachedTimestamp, 10);
		const now = Date.now();

		return now - timestamp < CACHE_EXPIRY_MS;
	} catch {
		return false;
	}
}
