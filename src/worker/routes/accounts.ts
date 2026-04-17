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

const app = new Hono<{ Bindings: Env }>();

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
    const payload = (await c.req.json()) as { platform: PlatformType; authToken?: string; description?: string };
    if (!payload.platform) {
        return c.json({ message: "platform is required" }, 400);
    }
    const now = Date.now();
    const { account, verifyResult, isDuplicate } = await createPlatformAccount(c.env.DB, {
        id: crypto.randomUUID(),
        platform: payload.platform,
        authToken: payload.authToken ?? null,
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
    const payload = (await c.req.json()) as { authToken?: string | null; description?: string | null; isActive?: boolean };
    const account = await updatePlatformAccount(c.env.DB, c.req.param("id"), payload, c.env.ENCRYPTION_KEY);
    if (!account) {
        return c.json({ message: "not found" }, 404);
    }
    return c.json(account);
});

// Verify account
app.post("/:id/verify", async (c) => {
    const result = await verifyPlatformAccount(c.env.DB, c.req.param("id"), c.env.ENCRYPTION_KEY);
    return c.json(result);
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
