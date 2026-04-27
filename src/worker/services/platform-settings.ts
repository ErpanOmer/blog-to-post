import type { Env } from "@/worker/types";
import type { PlatformPublishSettingsMap, PublishablePlatformType } from "@/shared/types";
import {
	createDefaultPlatformPublishSetting,
	normalizePlatformPublishSettings,
} from "@/shared/platform-settings";

const PLATFORM_PUBLISH_SETTINGS_KV_KEY = "settings:platform-publish";

export async function getPlatformPublishSettings(env: Env): Promise<PlatformPublishSettingsMap> {
	const raw = await env.PROMPTS.get(PLATFORM_PUBLISH_SETTINGS_KV_KEY);
	if (!raw) return normalizePlatformPublishSettings();

	try {
		return normalizePlatformPublishSettings(JSON.parse(raw) as unknown);
	} catch {
		return normalizePlatformPublishSettings();
	}
}

export async function setPlatformPublishSettings(
	env: Env,
	settings: unknown,
): Promise<PlatformPublishSettingsMap> {
	const normalized = normalizePlatformPublishSettings(settings);
	await env.PROMPTS.put(PLATFORM_PUBLISH_SETTINGS_KV_KEY, JSON.stringify(normalized));
	return normalized;
}

export async function updatePlatformPublishSetting(
	env: Env,
	platform: PublishablePlatformType,
	patch: unknown,
): Promise<PlatformPublishSettingsMap> {
	const current = await getPlatformPublishSettings(env);
	const source = patch && typeof patch === "object" ? patch as Record<string, unknown> : {};
	const next = {
		...current,
		[platform]: {
			...createDefaultPlatformPublishSetting(platform),
			...current[platform],
			...source,
			platform,
		},
	};
	return await setPlatformPublishSettings(env, next);
}
