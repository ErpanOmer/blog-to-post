import { Hono } from "hono";
import type { Env } from "@/worker/types";
import { isPublishablePlatform } from "@/shared/platform-settings";
import {
	getPlatformPublishSettings,
	setPlatformPublishSettings,
	updatePlatformPublishSetting,
} from "@/worker/services/platform-settings";
import {
	getWebsiteSlugSettings,
	setWebsiteSlugSettings,
} from "@/worker/services/website-slug-settings";

const app = new Hono<{ Bindings: Env }>();

app.get("/platform-publish", async (c) => {
	const settings = await getPlatformPublishSettings(c.env);
	return c.json(settings);
});

app.put("/platform-publish", async (c) => {
	const payload = await c.req.json().catch(() => null) as unknown;
	const settings = await setPlatformPublishSettings(c.env, payload);
	return c.json(settings);
});

app.put("/platform-publish/:platform", async (c) => {
	const platform = c.req.param("platform");
	if (!isPublishablePlatform(platform)) {
		return c.json({ message: "Unsupported platform" }, 400);
	}

	const payload = await c.req.json().catch(() => null) as unknown;
	const settings = await updatePlatformPublishSetting(c.env, platform, payload);
	return c.json(settings);
});

app.get("/website-slug", async (c) => {
	const settings = await getWebsiteSlugSettings(c.env);
	return c.json(settings);
});

app.put("/website-slug", async (c) => {
	const payload = await c.req.json().catch(() => null) as unknown;
	const settings = await setWebsiteSlugSettings(c.env, payload);
	return c.json(settings);
});

export default app;
