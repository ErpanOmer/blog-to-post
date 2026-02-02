import { Hono } from "hono";
import type { Env } from "../types";
import type { AccountConfig } from "../types/publications";
import {
    createPublishTaskService,
    getPublishTaskStatus,
    cancelPublishTask,
    quickPublish
} from "../services/publish";
import {
    listPublishTasks,
    listPublishTaskSteps,
    listArticlePublications
} from "../db/publications";

const app = new Hono<{ Bindings: Env }>();

// Create publish task
app.post("/tasks", async (c) => {
    try {
        const { articleIds, accountConfigs, scheduleTime } = await c.req.json() as {
            articleIds: string[];
            accountConfigs: AccountConfig[];
            scheduleTime?: number | null;
        };

        if (!articleIds?.length || !accountConfigs?.length) {
            return c.json({ message: "文章ID列表和账号配置不能为空" }, 400);
        }

        // 至少选择一个账号
        if (accountConfigs.length === 0) {
            return c.json({ message: "至少选择一个发布账号" }, 400);
        }

        const result = await createPublishTaskService(c.env.DB, {
            articleIds,
            accountConfigs,
            scheduleTime,
        });

        return c.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "创建发布任务失败";
        return c.json({ message }, 400);
    }
});

// List publish tasks
app.get("/tasks", async (c) => {
    try {
        const status = c.req.query("status") as "pending" | "processing" | "completed" | "failed" | "cancelled" | undefined;
        const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined;

        const tasks = await listPublishTasks(c.env.DB, { status, limit });
        return c.json(tasks);
    } catch (error) {
        const message = error instanceof Error ? error.message : "获取任务列表失败";
        return c.json({ message }, 500);
    }
});

// Get task detail
app.get("/tasks/:id", async (c) => {
    try {
        const { task, steps } = await getPublishTaskStatus(c.env.DB, c.req.param("id"));
        return c.json({ task, steps });
    } catch (error) {
        const message = error instanceof Error ? error.message : "获取任务详情失败";
        return c.json({ message }, 404);
    }
});

// Get all publications history
app.get("/history", async (c) => {
    try {
        const filters = {
            articleId: c.req.query("articleId"),
            accountId: c.req.query("accountId"),
            platform: c.req.query("platform") as any,
            status: c.req.query("status") as any
        };
        const publications = await listArticlePublications(c.env.DB, filters);
        return c.json(publications);
    } catch (error) {
        const message = error instanceof Error ? error.message : "获取发布记录失败";
        return c.json({ message }, 500);
    }
});

// Cancel task
app.post("/tasks/:id/cancel", async (c) => {
    try {
        const result = await cancelPublishTask(c.env.DB, c.req.param("id"));
        return c.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "取消任务失败";
        return c.json({ message, success: false }, 500);
    }
});

// Get task steps (Restored P0 fix)
app.get("/tasks/:id/steps", async (c) => {
    try {
        const steps = await listPublishTaskSteps(c.env.DB, c.req.param("id"));
        return c.json(steps);
    } catch (error) {
        const message = error instanceof Error ? error.message : "获取任务步骤失败";
        return c.json({ message }, 500);
    }
});

// Quick publish
app.post("/quick", async (c) => {
    try {
        const { articleId, accountId, draftOnly = false } = await c.req.json() as {
            articleId: string;
            accountId: string;
            draftOnly?: boolean;
        };

        if (!articleId || !accountId) {
            return c.json({ message: "文章ID和账号ID不能为空", success: false }, 400);
        }

        const result = await quickPublish(c.env.DB, articleId, accountId, draftOnly);
        return c.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "快速发布失败";
        return c.json({ message, success: false }, 500);
    }
});

export default app;
