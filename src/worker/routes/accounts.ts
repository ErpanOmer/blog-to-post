import { Hono } from "hono";
import type { Env, PlatformType } from "@/worker/types";
import {
    listPlatformAccounts,
    getPlatformAccount,
    createPlatformAccount,
    updatePlatformAccount,
    deletePlatformAccount,
    verifyPlatformAccount
} from "@/worker/db/platform-accounts";
import { getAccountStatistics, listAccountStatistics } from "@/worker/db/publications";
import { getPlatformPublishSettings } from "@/worker/services/platform-settings";
import { isPublishablePlatform } from "@/shared/platform-settings";
import {
    AccountImageTestError,
    testAccountImageUpload,
} from "@/worker/services/account-image-test";
import { ImagePipelineError, sanitizeImageErrorMessage } from "@/worker/utils/media";

const app = new Hono<{ Bindings: Env }>();

function normalizeCredentialValue(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildWechatCredentialToken(appId?: string | null, appSecret?: string | null): string | null {
    const normalizedAppId = normalizeCredentialValue(appId);
    const normalizedAppSecret = normalizeCredentialValue(appSecret);
    if (!normalizedAppId || !normalizedAppSecret) return null;

    return JSON.stringify({
        appId: normalizedAppId,
        appSecret: normalizedAppSecret,
    });
}

function buildWebsiteCredentialToken(
    baseUrl?: string | null,
    adminToken?: string | null,
    author?: string | null,
): string | null {
    const normalizedBaseUrl = normalizeCredentialValue(baseUrl);
    const normalizedAdminToken = normalizeCredentialValue(adminToken);
    const normalizedAuthor = normalizeCredentialValue(author);
    if (!normalizedBaseUrl || !normalizedAdminToken) return null;

    return JSON.stringify({
        baseUrl: normalizedBaseUrl,
        adminToken: normalizedAdminToken,
        author: normalizedAuthor || "ErpanOmer",
    });
}

function resolveAuthTokenForCreate(payload: {
    platform: PlatformType;
    authToken?: string | null;
    appId?: string | null;
    appSecret?: string | null;
    baseUrl?: string | null;
    adminToken?: string | null;
    author?: string | null;
}): string | null {
    if (payload.platform === "wechat") {
        const wechatToken = buildWechatCredentialToken(payload.appId, payload.appSecret);
        if (wechatToken) return wechatToken;
    }
    if (payload.platform === "website") {
        const websiteToken = buildWebsiteCredentialToken(payload.baseUrl, payload.adminToken, payload.author);
        if (websiteToken) return websiteToken;
    }
    return normalizeCredentialValue(payload.authToken);
}

function resolveAuthTokenForUpdate(payload: {
    platform: PlatformType;
    authToken?: string | null;
    appId?: string | null;
    appSecret?: string | null;
    baseUrl?: string | null;
    adminToken?: string | null;
    author?: string | null;
}): string | null {
    if (payload.platform === "wechat") {
        const wechatToken = buildWechatCredentialToken(payload.appId, payload.appSecret);
        if (wechatToken) return wechatToken;
    }
    if (payload.platform === "website") {
        const websiteToken = buildWebsiteCredentialToken(payload.baseUrl, payload.adminToken, payload.author);
        if (websiteToken) return websiteToken;
    }
    return normalizeCredentialValue(payload.authToken);
}

// Get all account statistics
app.get("/statistics", async (c) => {
    const platform = c.req.query("platform") as PlatformType | undefined;
    const stats = await listAccountStatistics(c.env.DB, platform);
    return c.json(stats);
});

// List accounts
app.get("/", async (c) => {
    const platform = c.req.query("platform") as PlatformType | undefined;
    const accounts = await listPlatformAccounts(c.env.DB, platform, c.env.ENCRYPTION_KEY);
    return c.json(accounts);
});

// Get single account
app.get("/:id", async (c) => {
    const account = await getPlatformAccount(c.env.DB, c.req.param("id"), c.env.ENCRYPTION_KEY);
    if (!account) {
        return c.json({ message: "not found" }, 404);
    }
    return c.json(account);
});

// Create account
app.post("/", async (c) => {
    const payload = (await c.req.json()) as {
        platform: PlatformType;
        authToken?: string | null;
        appId?: string | null;
        appSecret?: string | null;
        baseUrl?: string | null;
        adminToken?: string | null;
        author?: string | null;
        description?: string | null;
    };
    if (!payload.platform) {
        return c.json({ message: "platform is required" }, 400);
    }
    const platformSettings = await getPlatformPublishSettings(c.env);
    if (!isPublishablePlatform(payload.platform)) {
        return c.json({ message: "unsupported platform" }, 400);
    }
    if (platformSettings[payload.platform]?.enabled === false) {
        return c.json({ message: "platform is disabled in settings" }, 403);
    }

    const resolvedAuthToken = resolveAuthTokenForCreate(payload);

    const now = Date.now();
    const { account, verifyResult, isDuplicate } = await createPlatformAccount(c.env.DB, {
        id: crypto.randomUUID(),
        platform: payload.platform,
        authToken: resolvedAuthToken,
        description: payload.description ?? null,
        createdAt: now,
        updatedAt: now,
    }, c.env.ENCRYPTION_KEY);

    if (!account) {
        return c.json(
            { message: verifyResult.message, valid: verifyResult.valid },
            verifyResult.valid ? 200 : 400,
        );
    }

    return c.json({
        ...account,
        verifyMessage: verifyResult.message,
        isVerified: verifyResult.valid,
        isDuplicate,
    });
});

// Update account
app.put("/:id", async (c) => {
    const accountId = c.req.param("id");
    const payload = (await c.req.json()) as {
        authToken?: string | null;
        appId?: string | null;
        appSecret?: string | null;
        baseUrl?: string | null;
        adminToken?: string | null;
        author?: string | null;
        description?: string | null;
        isActive?: boolean;
    };

    const existingAccount = await getPlatformAccount(c.env.DB, accountId, c.env.ENCRYPTION_KEY);
    if (!existingAccount) {
        return c.json({ message: "not found" }, 404);
    }
    const platformSettings = await getPlatformPublishSettings(c.env);
    if (isPublishablePlatform(existingAccount.platform) && platformSettings[existingAccount.platform]?.enabled === false) {
        return c.json({ message: "platform is disabled in settings" }, 403);
    }

    const shouldUpdateCredential = (
        Object.prototype.hasOwnProperty.call(payload, "authToken")
        || Object.prototype.hasOwnProperty.call(payload, "appId")
        || Object.prototype.hasOwnProperty.call(payload, "appSecret")
        || Object.prototype.hasOwnProperty.call(payload, "baseUrl")
        || Object.prototype.hasOwnProperty.call(payload, "adminToken")
        || Object.prototype.hasOwnProperty.call(payload, "author")
    );
    const nextAuthToken = shouldUpdateCredential
        ? resolveAuthTokenForUpdate({
            platform: existingAccount.platform,
            authToken: payload.authToken,
            appId: payload.appId,
            appSecret: payload.appSecret,
            baseUrl: payload.baseUrl,
            adminToken: payload.adminToken,
            author: payload.author,
        })
        : undefined;

    const account = await updatePlatformAccount(c.env.DB, accountId, {
        authToken: nextAuthToken,
        description: payload.description,
        isActive: payload.isActive,
    }, c.env.ENCRYPTION_KEY);
    if (!account) {
        return c.json({ message: "not found" }, 404);
    }
    return c.json(account);
});

// Verify account
app.post("/:id/verify", async (c) => {
    const account = await getPlatformAccount(c.env.DB, c.req.param("id"), c.env.ENCRYPTION_KEY);
    if (!account) {
        return c.json({ message: "not found" }, 404);
    }
    const platformSettings = await getPlatformPublishSettings(c.env);
    if (isPublishablePlatform(account.platform) && platformSettings[account.platform]?.enabled === false) {
        return c.json({ message: "platform is disabled in settings" }, 403);
    }
    const result = await verifyPlatformAccount(c.env.DB, c.req.param("id"), c.env.ENCRYPTION_KEY);
    return c.json(result);
});

app.post("/:id/image-test", async (c) => {
    const payload = (await c.req.json().catch(() => null)) as { sourceUrl?: unknown } | null;
    if (!payload || typeof payload.sourceUrl !== "string" || !payload.sourceUrl.trim()) {
        return c.json({
            success: false,
            error_code: "IMAGE_SOURCE_INVALID",
            message: "sourceUrl is required",
            timestamp: Date.now(),
        }, 400);
    }

    try {
        return c.json(await testAccountImageUpload(c.env, c.req.param("id"), payload.sourceUrl));
    } catch (error) {
        if (error instanceof AccountImageTestError) {
            return c.json({
                success: false,
                error_code: error.code,
                message: error.message,
                platform: error.platform,
                timestamp: Date.now(),
            }, error.status);
        }
        if (error instanceof ImagePipelineError) {
            return c.json({
                success: false,
                error_code: error.code,
                message: error.message,
                stage: error.stage,
                attempts: error.attempts,
                timestamp: Date.now(),
            }, error.code === "IMAGE_SOURCE_INVALID" ? 400 : 502);
        }
        return c.json({
            success: false,
            error_code: "IMAGE_PLATFORM_UPLOAD_FAILED",
            message: sanitizeImageErrorMessage(error),
            timestamp: Date.now(),
        }, 502);
    }
});

// Delete account
app.delete("/:id", async (c) => {
    const success = await deletePlatformAccount(c.env.DB, c.req.param("id"));
    if (!success) {
        return c.json({ message: "not found" }, 404);
    }
    return c.json({ success: true });
});

// Get account statistics
app.get("/:id/statistics", async (c) => {
    const stats = await getAccountStatistics(c.env.DB, c.req.param("id"));
    return c.json(stats || {});
});

export default app;
