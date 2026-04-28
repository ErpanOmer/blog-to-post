import { Hono } from "hono";
import type { Context } from "hono";
import type { Env, PlatformType } from "@/worker/types";
import type { AccountConfig, PublicationStatus, PublishTaskStatus } from "@/worker/types/publications";
import {
	createPublishTaskService,
	getPublishTaskStatus,
	cancelPublishTask,
	quickPublish,
} from "@/worker/services/publish";
import {
	listPublishTasks,
	listPublishTaskSteps,
	listArticlePublications,
} from "@/worker/db/publications";
import { getPlatformAccount } from "@/worker/db/platform-accounts";
import {
	PublishErrorCodes,
	type PublishErrorCode,
	PublishServiceError,
	toPublishServiceError,
} from "@/worker/services/publish-errors";
import { getPlatformPublishSettings } from "@/worker/services/platform-settings";
import { isPublishablePlatform } from "@/shared/platform-settings";
import { createRequestId, logger } from "@/worker/utils/logger";

const app = new Hono<{ Bindings: Env }>();

const allowedTaskStatuses: PublishTaskStatus[] = ["pending", "processing", "completed", "failed", "cancelled"];
const allowedPublicationStatuses: PublicationStatus[] = ["pending", "draft_created", "publishing", "published", "failed", "cancelled"];
const allowedPlatforms: PlatformType[] = ["juejin", "zhihu", "xiaohongshu", "wechat", "csdn", "cnblogs", "segmentfault", ""];

function parseTaskStatus(value?: string): PublishTaskStatus | undefined {
	if (!value) return undefined;
	return allowedTaskStatuses.includes(value as PublishTaskStatus) ? (value as PublishTaskStatus) : undefined;
}

function parsePublicationStatus(value?: string): PublicationStatus | undefined {
	if (!value) return undefined;
	return allowedPublicationStatuses.includes(value as PublicationStatus)
		? (value as PublicationStatus)
		: undefined;
}

function parsePlatform(value?: string): PlatformType | undefined {
	if (!value) return undefined;
	return allowedPlatforms.includes(value as PlatformType) ? (value as PlatformType) : undefined;
}

async function applyGlobalPlatformPublishSettings(
	env: Env,
	accountConfigs: AccountConfig[],
): Promise<AccountConfig[]> {
	const settings = await getPlatformPublishSettings(env);
	return accountConfigs.map((config) => {
		if (!isPublishablePlatform(config.platform)) {
			throw new PublishServiceError({
				code: PublishErrorCodes.UNSUPPORTED_PLATFORM,
				status: 400,
				message: `Unsupported platform: ${config.platform}`,
				details: { platform: config.platform },
			});
		}
		const setting = settings[config.platform];
		if (!setting?.enabled) {
			throw new PublishServiceError({
				code: PublishErrorCodes.INVALID_REQUEST,
				status: 400,
				message: `Platform is disabled in settings: ${config.platform}`,
				details: { platform: config.platform },
			});
		}
		return {
			...config,
			draftOnly: typeof config.draftOnly === "boolean" ? config.draftOnly : setting.draftOnly,
			contentSlots: {
				useCoverImageAsHeader:
					config.contentSlots?.useCoverImageAsHeader ?? setting.useCoverImageAsHeader,
				headerSlot: config.contentSlots?.headerSlot ?? setting.headerSlot,
				footerSlot: config.contentSlots?.footerSlot ?? setting.footerSlot,
				headerMarkdown:
					config.contentSlots?.headerMarkdown
					?? config.contentSlots?.headerSlot
					?? setting.headerSlot,
				headerHtml:
					config.contentSlots?.headerHtml
					?? config.contentSlots?.headerSlot
					?? setting.headerSlot,
				footerMarkdown:
					config.contentSlots?.footerMarkdown
					?? config.contentSlots?.footerSlot
					?? setting.footerSlot,
				footerHtml:
					config.contentSlots?.footerHtml
					?? config.contentSlots?.footerSlot
					?? setting.footerSlot,
			},
		};
	});
}

function normalizeRouteError(
	error: unknown,
	fallbackCode: PublishErrorCode = PublishErrorCodes.INTERNAL_ERROR,
): PublishServiceError {
	if (error instanceof PublishServiceError) {
		return error;
	}

	const message = error instanceof Error ? error.message : "Unknown publish route error";
	if (message === "Task not found") {
		return new PublishServiceError({
			code: PublishErrorCodes.TASK_NOT_FOUND,
			status: 404,
			message,
		});
	}

	return toPublishServiceError(error, fallbackCode);
}

function jsonError(
	c: Context<{ Bindings: Env }>,
	requestId: string,
	error: unknown,
	fallbackCode: PublishErrorCode = PublishErrorCodes.INTERNAL_ERROR,
) {
	const publishError = normalizeRouteError(error, fallbackCode);
	logger.error({
		module: "publish.route",
		event: "request.failed",
		requestId,
		errorCode: publishError.code,
		message: publishError.message,
		details: publishError.details,
		path: c.req.path,
		method: c.req.method,
	});

	return c.json(
		{
			success: false,
			errorCode: publishError.code,
			message: publishError.message,
			details: publishError.details,
			requestId,
		},
		publishError.status as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
	);
}

// Create publish task
app.post("/tasks", async (c) => {
	const requestId = createRequestId();

	try {
		const { articleIds, accountConfigs, scheduleTime, idempotencyKey } =
			(await c.req.json()) as {
				articleIds: string[];
				accountConfigs: AccountConfig[];
				scheduleTime?: number | null;
				idempotencyKey?: string;
			};

		if (!articleIds?.length || !accountConfigs?.length) {
			throw new PublishServiceError({
				code: PublishErrorCodes.INVALID_REQUEST,
				status: 400,
				message: "articleIds and accountConfigs are required",
			});
		}

		const normalizedAccountConfigs = await applyGlobalPlatformPublishSettings(c.env, accountConfigs);

		const result = await createPublishTaskService(
			c.env.DB,
			{
				articleIds,
				accountConfigs: normalizedAccountConfigs,
				scheduleTime,
				idempotencyKey,
			},
			c.executionCtx,
			{ requestId, encryptionKey: c.env.ENCRYPTION_KEY },
		);

		return c.json({ ...result, requestId });
	} catch (error) {
		return jsonError(c, requestId, error, PublishErrorCodes.INVALID_REQUEST);
	}
});

// List publish tasks
app.get("/tasks", async (c) => {
	const requestId = createRequestId();
	try {
		const status = parseTaskStatus(c.req.query("status"));
		const limitRaw = c.req.query("limit");
		const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
		if (limitRaw && (!parsedLimit || parsedLimit <= 0)) {
			throw new PublishServiceError({
				code: PublishErrorCodes.INVALID_REQUEST,
				status: 400,
				message: "limit must be a positive integer",
			});
		}

		const tasks = await listPublishTasks(c.env.DB, { status, limit: parsedLimit });
		return c.json(tasks);
	} catch (error) {
		return jsonError(c, requestId, error, PublishErrorCodes.INVALID_REQUEST);
	}
});

// Get task detail
app.get("/tasks/:id", async (c) => {
	const requestId = createRequestId();
	try {
		const { task, steps } = await getPublishTaskStatus(c.env.DB, c.req.param("id"));
		return c.json({ task, steps });
	} catch (error) {
		return jsonError(c, requestId, error, PublishErrorCodes.TASK_NOT_FOUND);
	}
});

// Get all publications history
app.get("/history", async (c) => {
	const requestId = createRequestId();
	try {
		const filters = {
			articleId: c.req.query("articleId"),
			accountId: c.req.query("accountId"),
			platform: parsePlatform(c.req.query("platform")),
			status: parsePublicationStatus(c.req.query("status")),
		};
		const publications = await listArticlePublications(c.env.DB, filters);
		return c.json(publications);
	} catch (error) {
		return jsonError(c, requestId, error);
	}
});

// Cancel task
app.post("/tasks/:id/cancel", async (c) => {
	const requestId = createRequestId();
	try {
		const result = await cancelPublishTask(c.env.DB, c.req.param("id"));
		const statusCode = result.success ? 200 : 400;
		return c.json(result, statusCode as 200 | 400);
	} catch (error) {
		return jsonError(c, requestId, error);
	}
});

// Get task steps
app.get("/tasks/:id/steps", async (c) => {
	const requestId = createRequestId();
	try {
		const steps = await listPublishTaskSteps(c.env.DB, c.req.param("id"));
		return c.json(steps);
	} catch (error) {
		return jsonError(c, requestId, error);
	}
});

// Quick publish
app.post("/quick", async (c) => {
	const requestId = createRequestId();
	try {
		const { articleId, accountId, draftOnly = false, contentSlots = null } = (await c.req.json()) as {
			articleId: string;
			accountId: string;
			draftOnly?: boolean;
			contentSlots?: AccountConfig["contentSlots"];
		};

		if (!articleId || !accountId) {
			throw new PublishServiceError({
				code: PublishErrorCodes.INVALID_REQUEST,
				status: 400,
				message: "articleId and accountId are required",
			});
		}

		const account = await getPlatformAccount(c.env.DB, accountId, c.env.ENCRYPTION_KEY);
		if (!account) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ACCOUNT_NOT_FOUND,
				status: 404,
				message: "Account not found",
				details: { accountId },
			});
		}
		const [normalizedConfig] = await applyGlobalPlatformPublishSettings(c.env, [{
			accountId,
			platform: account.platform,
			draftOnly,
			contentSlots,
		}]);

		const result = await quickPublish(
			c.env.DB,
			articleId,
			accountId,
			normalizedConfig.draftOnly,
			c.executionCtx,
			{ requestId, encryptionKey: c.env.ENCRYPTION_KEY },
			normalizedConfig.contentSlots ?? null,
		);
		return c.json({ ...result, requestId });
	} catch (error) {
		return jsonError(c, requestId, error, PublishErrorCodes.INVALID_REQUEST);
	}
});

export default app;
