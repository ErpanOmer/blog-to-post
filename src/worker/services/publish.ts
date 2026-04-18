import type { D1Database } from "@cloudflare/workers-types";
import type {
	PublishTask,
	AccountConfig,
	PublicationStatus,
	PublishResult,
	PublicationDetail,
	PublishStepType,
} from "@/worker/types/publications";
import type { PlatformType } from "@/worker/types";
import type { AccountService, PublishTraceEvent } from "@/worker/accounts/types";
import { getAccountService } from "@/worker/accounts";
import { getPlatformAccount } from "@/worker/db/platform-accounts";
import { getArticle } from "@/worker/db/articles";
import {
	createPublishTask,
	createPublishTaskStep,
	updatePublishTaskStep,
	createArticlePublication,
	updateArticlePublication,
	createOrUpdateAccountStatistics,
	getPublishTask,
	getPublishTaskByIdempotencyKey,
	updatePublishTask,
	listPublishTaskSteps,
	getPendingScheduledTasks,
} from "@/worker/db/publications";
import { randomDelay } from "../utils/helpers";
import { logger } from "@/worker/utils/logger";
import {
	PublishErrorCodes,
	type PublishErrorCode,
	PublishServiceError,
	toPublishServiceError,
} from "@/worker/services/publish-errors";

interface StepExecutionOutput<T> {
	value: T;
	outputData?: Record<string, unknown>;
}

interface StepContext {
	taskId: string;
	articleId: string | null;
	accountId: string | null;
	platform: PlatformType;
}

interface ProgressState {
	stepSequence: number;
	progressStepNumber: number;
	completedSteps: number;
	failedSteps: number;
	skippedSteps: number;
	currentArticleIndex: number;
	currentAccountIndex: number;
	currentStep: string;
}

interface TaskExecutionOptions {
	encryptionKey?: string;
	requestId?: string;
}

function errorMessageOf(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function compactRecord(input: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
	if (!input) return null;
	const output: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(input)) {
		if (typeof value === "string" && value.length > 1000) {
			output[key] = `${value.slice(0, 1000)}... (truncated)`;
			continue;
		}
		output[key] = value;
	}
	return output;
}

function mapPublishErrorCodeFromMessage(message: string): PublishErrorCode {
	const normalized = message.toLowerCase();
	if (normalized.includes("not found")) {
		if (normalized.includes("article")) return PublishErrorCodes.ARTICLE_NOT_FOUND;
		if (normalized.includes("account")) return PublishErrorCodes.ACCOUNT_NOT_FOUND;
		return PublishErrorCodes.TASK_NOT_FOUND;
	}
	if (normalized.includes("inactive")) return PublishErrorCodes.ACCOUNT_INACTIVE;
	if (normalized.includes("not verified")) return PublishErrorCodes.ACCOUNT_NOT_VERIFIED;
	if (normalized.includes("token")) return PublishErrorCodes.ACCOUNT_TOKEN_MISSING;
	if (normalized.includes("unsupported platform")) return PublishErrorCodes.UNSUPPORTED_PLATFORM;
	return PublishErrorCodes.PUBLISH_EXECUTION_FAILED;
}

async function createTaskStepAndSetRunning(
	db: D1Database,
	params: {
		taskId: string;
		stepNumber: number;
		articleId?: string | null;
		accountId?: string | null;
		platform: PlatformType;
		stepType: PublishStepType;
		inputData?: Record<string, unknown> | null;
	},
): Promise<{ id: string; startedAt: number }> {
	const row = await createPublishTaskStep(db, {
		id: crypto.randomUUID(),
		taskId: params.taskId,
		stepNumber: params.stepNumber,
		articleId: params.articleId ?? null,
		accountId: params.accountId ?? null,
		platform: params.platform,
		stepType: params.stepType,
		inputData: compactRecord(params.inputData),
	});
	const startedAt = Date.now();
	await updatePublishTaskStep(db, row.id, {
		status: "running",
		startTime: startedAt,
	});
	return { id: row.id, startedAt };
}

async function updateTaskProgress(
	db: D1Database,
	task: PublishTask,
	state: ProgressState,
): Promise<void> {
	await updatePublishTask(db, task.id, {
		currentStep: state.progressStepNumber,
		progressData: {
			currentArticleIndex: state.currentArticleIndex,
			totalArticles: task.articleIds.length,
			currentAccountIndex: state.currentAccountIndex,
			totalAccounts: task.accountConfigs.length,
			currentStep: state.currentStep,
			completedSteps: state.completedSteps,
			failedSteps: state.failedSteps,
			skippedSteps: state.skippedSteps,
		},
	});
}

async function runTrackedStep<T>(
	db: D1Database,
	task: PublishTask,
	state: ProgressState,
	params: {
		ctx: StepContext;
		stepType: PublishStepType;
		stepName: string;
		inputData?: Record<string, unknown>;
		execute: () => Promise<StepExecutionOutput<T>>;
	},
): Promise<T> {
	state.stepSequence += 1;
	state.progressStepNumber += 1;
	state.currentStep = params.stepName;
	await updateTaskProgress(db, task, state);

	const step = await createTaskStepAndSetRunning(db, {
		taskId: params.ctx.taskId,
		stepNumber: state.stepSequence,
		articleId: params.ctx.articleId,
		accountId: params.ctx.accountId,
		platform: params.ctx.platform,
		stepType: params.stepType,
		inputData: {
			stepName: params.stepName,
			...compactRecord(params.inputData),
		},
	});

	try {
		const result = await params.execute();
		const duration = Date.now() - step.startedAt;
		await updatePublishTaskStep(db, step.id, {
			status: "completed",
			endTime: Date.now(),
			duration,
			outputData: compactRecord(result.outputData),
		});
		state.completedSteps += 1;
		state.currentStep = `${params.stepName} completed`;
		await updateTaskProgress(db, task, state);
		return result.value;
	} catch (error) {
		const publishError = toPublishServiceError(error, PublishErrorCodes.PUBLISH_EXECUTION_FAILED);
		const duration = Date.now() - step.startedAt;
		await updatePublishTaskStep(db, step.id, {
			status: "failed",
			endTime: Date.now(),
			duration,
			errorMessage: publishError.message,
			outputData: {
				error: publishError.message,
				errorCode: publishError.code,
			},
		});
		state.failedSteps += 1;
		state.currentStep = `${params.stepName} failed`;
		await updateTaskProgress(db, task, state);
		throw publishError;
	}
}

async function markStepSkipped(
	db: D1Database,
	task: PublishTask,
	state: ProgressState,
	params: {
		ctx: StepContext;
		stepType: PublishStepType;
		stepName: string;
		reason: string;
	},
): Promise<void> {
	state.stepSequence += 1;
	state.progressStepNumber += 1;
	state.currentStep = `${params.stepName} skipped`;
	await updateTaskProgress(db, task, state);

	const step = await createTaskStepAndSetRunning(db, {
		taskId: params.ctx.taskId,
		stepNumber: state.stepSequence,
		articleId: params.ctx.articleId,
		accountId: params.ctx.accountId,
		platform: params.ctx.platform,
		stepType: params.stepType,
		inputData: {
			stepName: params.stepName,
			reason: params.reason,
		},
	});

	await updatePublishTaskStep(db, step.id, {
		status: "skipped",
		endTime: Date.now(),
		duration: 0,
		outputData: {
			reason: params.reason,
		},
	});

	state.skippedSteps += 1;
	await updateTaskProgress(db, task, state);
}

async function appendAdapterTrace(
	db: D1Database,
	_task: PublishTask,
	state: ProgressState,
	ctx: StepContext,
	event: PublishTraceEvent,
): Promise<void> {
	state.stepSequence += 1;

	const step = await createTaskStepAndSetRunning(db, {
		taskId: ctx.taskId,
		stepNumber: state.stepSequence,
		articleId: ctx.articleId,
		accountId: ctx.accountId,
		platform: ctx.platform,
		stepType: "adapter_trace",
		inputData: {
			stage: event.stage,
			message: event.message,
			level: event.level ?? "info",
			...(compactRecord(event.metadata) ?? {}),
		},
	});

	await updatePublishTaskStep(db, step.id, {
		status: "completed",
		endTime: Date.now(),
		duration: Date.now() - step.startedAt,
		outputData: compactRecord({
			stage: event.stage,
			message: event.message,
			level: event.level ?? "info",
			...(event.metadata ?? {}),
		}),
	});
}

// Create publish task
export async function createPublishTaskService(
	db: D1Database,
	params: {
		articleIds: string[];
		accountConfigs: AccountConfig[];
		scheduleTime?: number | null;
		idempotencyKey?: string;
	},
	ctx?: ExecutionContext,
	options: TaskExecutionOptions = {},
): Promise<{ task: PublishTask; message: string; reused?: boolean }> {
	const { articleIds, accountConfigs, scheduleTime, idempotencyKey } = params;
	const requestId = options.requestId;

	if (!articleIds?.length || !accountConfigs?.length) {
		throw new PublishServiceError({
			code: PublishErrorCodes.INVALID_REQUEST,
			message: "Article ids and account configs are required",
			status: 400,
		});
	}

	if (idempotencyKey) {
		const existing = await getPublishTaskByIdempotencyKey(db, idempotencyKey);
		if (existing) {
			logger.info({
				module: "publish.service",
				event: "task.idempotent_hit",
				requestId,
				taskId: existing.id,
				idempotencyKey,
				status: existing.status,
			});
			return {
				task: existing,
				message: "Idempotency key matched existing task",
				reused: true,
			};
		}
	}

	for (const articleId of articleIds) {
		const article = await getArticle(db, articleId);
		if (!article) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ARTICLE_NOT_FOUND,
				message: `Article not found: ${articleId}`,
				status: 404,
				details: { articleId },
			});
		}
	}

	for (const config of accountConfigs) {
		const account = await getPlatformAccount(db, config.accountId, options.encryptionKey);
		if (!account) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ACCOUNT_NOT_FOUND,
				message: `Account not found: ${config.accountId}`,
				status: 404,
				details: { accountId: config.accountId },
			});
		}
		if (!account.isActive) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ACCOUNT_INACTIVE,
				message: `Account is inactive: ${account.userName || config.accountId}`,
				status: 400,
				details: { accountId: config.accountId, platform: config.platform },
			});
		}
		if (!account.isVerified) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ACCOUNT_NOT_VERIFIED,
				message: `Account is not verified: ${account.userName || config.accountId}`,
				status: 400,
				details: { accountId: config.accountId, platform: config.platform },
			});
		}
		if (!account.authToken) {
			throw new PublishServiceError({
				code: PublishErrorCodes.ACCOUNT_TOKEN_MISSING,
				message: `Account auth token is missing: ${account.userName || config.accountId}`,
				status: 400,
				details: { accountId: config.accountId, platform: config.platform },
			});
		}
	}

	const now = Date.now();
	const isScheduled = Boolean(scheduleTime && scheduleTime > now);
	const taskType = articleIds.length > 1 ? "batch" : isScheduled ? "scheduled" : "single";

	let task: PublishTask;
	try {
		task = await createPublishTask(db, {
			id: crypto.randomUUID(),
			type: taskType,
			articleIds,
			accountConfigs,
			idempotencyKey: idempotencyKey ?? null,
			scheduleTime: isScheduled ? scheduleTime : null,
		});
	} catch (error) {
		const message = errorMessageOf(error).toLowerCase();
		if (idempotencyKey && message.includes("unique") && message.includes("idempotency")) {
			const existing = await getPublishTaskByIdempotencyKey(db, idempotencyKey);
			if (existing) {
				logger.warn({
					module: "publish.service",
					event: "task.idempotent_race_reused",
					requestId,
					taskId: existing.id,
					idempotencyKey,
					status: existing.status,
				});
				return {
					task: existing,
					message: "Idempotency key matched existing task after race",
					reused: true,
				};
			}
			throw new PublishServiceError({
				code: PublishErrorCodes.IDEMPOTENCY_CONFLICT,
				status: 409,
				message: "Idempotency key conflict",
				details: { idempotencyKey },
			});
		}
		throw toPublishServiceError(error, PublishErrorCodes.INTERNAL_ERROR);
	}

	if (!isScheduled) {
		const execution = executePublishTask(db, task.id, options).catch((error) => {
			const publishError = toPublishServiceError(error);
			logger.error({
				module: "publish.service",
				event: "task.execution_failed",
				requestId,
				taskId: task.id,
				errorCode: publishError.code,
				message: publishError.message,
			});
		});

		if (ctx) {
			ctx.waitUntil(execution);
		} else {
			execution.catch(() => {
				// keep process alive in local dev without throwing to caller
			});
		}
	}

	return {
		task,
		message: isScheduled
			? `Scheduled publish task created, will run at ${new Date(scheduleTime!).toLocaleString()}`
			: "Publish task created and started",
	};
}

function estimateCoreTotalSteps(articleCount: number, accountConfigs: AccountConfig[]): number {
	const perArticle = accountConfigs.reduce((sum, config) => sum + (config.draftOnly ? 9 : 10), 0);
	return articleCount * perArticle;
}

// Execute publish task
export async function executePublishTask(
	db: D1Database,
	taskId: string,
	options: TaskExecutionOptions = {},
): Promise<PublishResult> {
	const requestId = options.requestId;
	const task = await getPublishTask(db, taskId);
	if (!task) {
		throw new PublishServiceError({
			code: PublishErrorCodes.TASK_NOT_FOUND,
			status: 404,
			message: "Task not found",
			details: { taskId },
		});
	}

	if (task.status === "processing") {
		throw new PublishServiceError({
			code: PublishErrorCodes.TASK_ALREADY_PROCESSING,
			status: 409,
			message: "Task is already processing",
			details: { taskId },
		});
	}

	if (task.status === "completed" || task.status === "failed" || task.status === "cancelled") {
		throw new PublishServiceError({
			code: PublishErrorCodes.TASK_ALREADY_FINISHED,
			status: 409,
			message: "Task is already finished",
			details: { taskId, status: task.status },
		});
	}

	const normalizedTotalSteps = estimateCoreTotalSteps(task.articleIds.length, task.accountConfigs);
	if (task.totalSteps !== normalizedTotalSteps) {
		await updatePublishTask(db, taskId, {
			totalSteps: normalizedTotalSteps,
		});
		task.totalSteps = normalizedTotalSteps;
	}

	const progressState: ProgressState = {
		stepSequence: 0,
		progressStepNumber: 0,
		completedSteps: 0,
		failedSteps: 0,
		skippedSteps: 0,
		currentArticleIndex: 0,
		currentAccountIndex: 0,
		currentStep: "Task started",
	};

	await updatePublishTask(db, taskId, {
		status: "processing",
		startedAt: Date.now(),
		currentStep: 0,
		progressData: {
			currentArticleIndex: 0,
			totalArticles: task.articleIds.length,
			currentAccountIndex: 0,
			totalAccounts: task.accountConfigs.length,
			currentStep: progressState.currentStep,
			completedSteps: 0,
			failedSteps: 0,
			skippedSteps: 0,
		},
	});

	const details: PublicationDetail[] = [];

	try {
		for (let articleIndex = 0; articleIndex < task.articleIds.length; articleIndex++) {
			const articleId = task.articleIds[articleIndex];
			progressState.currentArticleIndex = articleIndex;

			for (let accountIndex = 0; accountIndex < task.accountConfigs.length; accountIndex++) {
				const accountConfig = task.accountConfigs[accountIndex];
				progressState.currentAccountIndex = accountIndex;

				const stepCtx: StepContext = {
					taskId,
					articleId,
					accountId: accountConfig.accountId,
					platform: accountConfig.platform,
				};

				const publication = await createArticlePublication(db, {
					id: crypto.randomUUID(),
					articleId,
					accountId: accountConfig.accountId,
					platform: accountConfig.platform,
					publishType: accountConfig.draftOnly ? "draft_only" : "full_publish",
					status: "pending",
				});

				let draftId: string | undefined;
				let draftUrl: string | undefined;
				let draftHtmlContent: string | undefined;
				let publishId: string | undefined;
				let publishedUrl: string | undefined;
				let currentStatus: PublicationStatus = "pending";
				let errorMessage: string | undefined;
				let errorCode: string | undefined;
				const publishStartAt = Date.now();

				let traceChain = Promise.resolve();
				let resolvedService: AccountService | null = null;

				const pushAdapterTrace = async (event: PublishTraceEvent): Promise<void> => {
					traceChain = traceChain
						.then(async () => {
							await appendAdapterTrace(db, task, progressState, stepCtx, event);
							logger.info({
								module: "publish.service",
								event: "adapter.trace",
								requestId,
								taskId,
								articleId,
								accountId: accountConfig.accountId,
								platform: accountConfig.platform,
								stage: event.stage,
								message: event.message,
								level: event.level ?? "info",
							});
						})
						.catch((traceError) => {
							logger.warn({
								module: "publish.service",
								event: "adapter.trace_append_failed",
								requestId,
								taskId,
								error: errorMessageOf(traceError),
							});
						});
					await traceChain;
				};

				try {
					await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "prepare_task",
						stepName: "Prepare publish context",
						inputData: {
							articleIndex,
							accountIndex,
							draftOnly: accountConfig.draftOnly,
						},
						execute: async () => ({
							value: true,
							outputData: {
								articleId,
								accountId: accountConfig.accountId,
								platform: accountConfig.platform,
							},
						}),
					});

					const article = await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "load_article",
						stepName: "Load article",
						inputData: { articleId },
						execute: async () => {
							const loaded = await getArticle(db, articleId);
							if (!loaded) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ARTICLE_NOT_FOUND,
									status: 404,
									message: `Article not found: ${articleId}`,
								});
							}
							return {
								value: loaded,
								outputData: {
									title: loaded.title,
									contentLength: loaded.content.length,
									hasHtmlContent: Boolean(loaded.htmlContent?.trim()),
								},
							};
						},
					});

					const account = await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "load_account",
						stepName: "Load account",
						inputData: { accountId: accountConfig.accountId, platform: accountConfig.platform },
						execute: async () => {
							const loaded = await getPlatformAccount(
								db,
								accountConfig.accountId,
								options.encryptionKey,
							);
							if (!loaded) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ACCOUNT_NOT_FOUND,
									status: 404,
									message: `Account not found: ${accountConfig.accountId}`,
								});
							}
							return {
								value: loaded,
								outputData: {
									userName: loaded.userName ?? null,
									isActive: loaded.isActive,
									isVerified: loaded.isVerified,
									hasAuthToken: Boolean(loaded.authToken),
								},
							};
						},
					});

					await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "validate_account",
						stepName: "Validate account readiness",
						inputData: {
							accountId: account.id,
							platform: account.platform,
						},
						execute: async () => {
							if (!account.isActive) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ACCOUNT_INACTIVE,
									status: 400,
									message: "Account is inactive",
								});
							}
							if (!account.isVerified) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ACCOUNT_NOT_VERIFIED,
									status: 400,
									message: "Account is not verified",
								});
							}
							if (!account.authToken) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ACCOUNT_TOKEN_MISSING,
									status: 400,
									message: "Account auth token is missing",
								});
							}
							return {
								value: true,
								outputData: {
									isActive: account.isActive,
									isVerified: account.isVerified,
									hasAuthToken: Boolean(account.authToken),
								},
							};
						},
					});

					resolvedService = await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "resolve_service",
						stepName: "Resolve platform service",
						inputData: { platform: account.platform },
						execute: async () => {
							if (!account.authToken) {
								throw new PublishServiceError({
									code: PublishErrorCodes.ACCOUNT_TOKEN_MISSING,
									status: 400,
									message: "Account auth token is missing",
								});
							}
							const service = getAccountService(account.platform, account.authToken);
							if (!service) {
								throw new PublishServiceError({
									code: PublishErrorCodes.UNSUPPORTED_PLATFORM,
									status: 400,
									message: `Unsupported platform: ${account.platform}`,
								});
							}
							if (service.setPublishTraceLogger) {
								service.setPublishTraceLogger(pushAdapterTrace);
							}
							return {
								value: service,
								outputData: {
									serviceClass: service.constructor.name,
									hasTraceLogger: Boolean(service.setPublishTraceLogger),
								},
							};
						},
					});

					const draftOutput = await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "create_draft",
						stepName: "Create platform draft",
						inputData: {
							functionName: "articleDraft",
							draftOnly: accountConfig.draftOnly,
							contentLength: article.content.length,
							hasHtmlContent: Boolean(article.htmlContent?.trim()),
						},
						execute: async () => {
							const draft = await resolvedService!.articleDraft(article);
							if (!draft) {
								throw new Error("Platform draft creation returned empty result");
							}
							return {
								value: {
									draftId: draft.id,
									draftUrl: draft.url ?? undefined,
									htmlContent: draft.htmlContent ?? undefined,
								},
								outputData: {
									functionName: "articleDraft",
									draftId: draft.id,
									draftUrl: draft.url,
									createdAt: draft.createdAt,
									hasPreparedHtmlContent: Boolean(draft.htmlContent?.trim()),
									htmlContentLength: draft.htmlContent?.length ?? null,
								},
							};
						},
					});
					draftId = draftOutput.draftId;
					draftUrl = draftOutput.draftUrl;
					draftHtmlContent = draftOutput.htmlContent;

					// For WeChat accounts that cannot call formal publish API,
					// keep draft URL as the frontend jump link for manual publish.
					if (accountConfig.platform === "wechat" && draftUrl) {
						publishedUrl = draftUrl;
					}

					if (accountConfig.draftOnly) {
						await markStepSkipped(db, task, progressState, {
							ctx: stepCtx,
							stepType: "publish_article",
							stepName: "Publish article",
							reason: "draftOnly mode enabled",
						});
						currentStatus = "draft_created";
					} else {
						const publishOutput = await runTrackedStep(db, task, progressState, {
							ctx: stepCtx,
							stepType: "publish_article",
							stepName: "Publish article",
							inputData: {
								functionName: "articlePublish",
								draftId,
								usingDraftHtmlContent: Boolean(draftHtmlContent?.trim()),
							},
							execute: async () => {
								if (!draftId) {
									throw new PublishServiceError({
										code: PublishErrorCodes.INVALID_REQUEST,
										status: 400,
										message: "Missing draftId for publish",
									});
								}

								await randomDelay(3000, 5000);
								const publishPayload = draftHtmlContent?.trim()
									? { ...article, htmlContent: draftHtmlContent, draftId }
									: { ...article, draftId };
								const publishResult = await resolvedService!.articlePublish(publishPayload);
								if (!publishResult.success) {
									throw new PublishServiceError({
										code: PublishErrorCodes.PUBLISH_EXECUTION_FAILED,
										status: 500,
										message: publishResult.message || "Platform publish failed",
									});
								}

								return {
									value: {
										publishId: publishResult.articleId || null,
										publishedUrl: publishResult.url || null,
									},
									outputData: {
										functionName: "articlePublish",
										draftId,
										publishId: publishResult.articleId || null,
										publishedUrl: publishResult.url || null,
										usingDraftHtmlContent: Boolean(draftHtmlContent?.trim()),
										message: publishResult.message,
									},
								};
							},
						});

						publishId = publishOutput.publishId || undefined;
						publishedUrl = publishOutput.publishedUrl || undefined;

						await runTrackedStep(db, task, progressState, {
							ctx: stepCtx,
							stepType: "verify_result",
							stepName: "Verify publish result",
							inputData: {
								publishId: publishId ?? null,
								publishedUrl: publishedUrl ?? null,
							},
							execute: async () => ({
								value: true,
								outputData: {
									verified: Boolean(publishId || publishedUrl),
									publishId: publishId ?? null,
									publishedUrl: publishedUrl ?? null,
								},
							}),
						});

						currentStatus = "published";
					}
				} catch (error) {
					const publishError = toPublishServiceError(
						error,
						mapPublishErrorCodeFromMessage(errorMessageOf(error)),
					);
					errorMessage = publishError.message;
					errorCode = publishError.code;
					currentStatus = "failed";
					logger.error({
						module: "publish.service",
						event: "publication.execute_failed",
						requestId,
						taskId,
						articleId,
						accountId: accountConfig.accountId,
						platform: accountConfig.platform,
						errorCode,
						message: errorMessage,
					});
				} finally {
					resolvedService?.clearPublishTraceLogger?.();
					await traceChain;
				}

				const duration = Date.now() - publishStartAt;

				try {
					await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "persist_publication",
						stepName: "Persist publication result",
						inputData: {
							publicationId: publication.id,
							status: currentStatus,
						},
						execute: async () => {
							await updateArticlePublication(db, publication.id, {
								status: currentStatus,
								draftId: draftId ?? null,
								publishId: publishId ?? null,
								publishedUrl: publishedUrl ?? null,
								errorMessage: errorMessage ?? null,
								completedAt: Date.now(),
							});
							return {
								value: true,
								outputData: {
									status: currentStatus,
									draftId: draftId ?? null,
									publishId: publishId ?? null,
									publishedUrl: publishedUrl ?? null,
									errorMessage: errorMessage ?? null,
									errorCode: errorCode ?? null,
									duration,
								},
							};
						},
					});
				} catch (persistError) {
					const persistMessage = errorMessageOf(persistError);
					logger.error({
						module: "publish.service",
						event: "publication.persist_failed",
						requestId,
						taskId,
						publicationId: publication.id,
						message: persistMessage,
					});
					if (!errorMessage) {
						errorMessage = persistMessage;
						errorCode = PublishErrorCodes.PUBLISH_EXECUTION_FAILED;
						currentStatus = "failed";
					}
				}

				try {
					await runTrackedStep(db, task, progressState, {
						ctx: stepCtx,
						stepType: "update_statistics",
						stepName: "Update account statistics",
						inputData: {
							accountId: accountConfig.accountId,
							platform: accountConfig.platform,
							status: currentStatus,
						},
						execute: async () => {
							await createOrUpdateAccountStatistics(db, accountConfig.accountId, accountConfig.platform, {
								incrementPublished: currentStatus === "published",
								incrementDrafts: currentStatus === "draft_created",
								incrementFailed: currentStatus === "failed",
								lastPublishedAt: Date.now(),
								lastPublishedArticleId: articleId,
								newHistoryItem: {
									articleId,
									articleTitle: (await getArticle(db, articleId))?.title || articleId,
									status: currentStatus,
									publishType: accountConfig.draftOnly ? "draft_only" : "full_publish",
									publishedAt: Date.now(),
									publishedUrl: publishedUrl ?? null,
								},
							});
							return {
								value: true,
								outputData: {
									status: currentStatus,
									publishType: accountConfig.draftOnly ? "draft_only" : "full_publish",
								},
							};
						},
					});
				} catch (statisticsError) {
					logger.warn({
						module: "publish.service",
						event: "statistics.update_failed",
						requestId,
						taskId,
						accountId: accountConfig.accountId,
						error: errorMessageOf(statisticsError),
					});
				}

				details.push({
					articleId,
					accountId: accountConfig.accountId,
					platform: accountConfig.platform,
					success: currentStatus === "published" || currentStatus === "draft_created",
					status: currentStatus,
					errorCode: errorCode ?? null,
					draftId: draftId ?? null,
					publishId: publishId ?? null,
					publishedUrl: publishedUrl ?? null,
					errorMessage: errorMessage ?? null,
					duration,
				});
			}
		}

		const successfulPublications = details.filter((detail) => detail.success).length;
		const failedPublications = details.filter((detail) => !detail.success).length;
		const draftOnlyPublications = details.filter((detail) => detail.status === "draft_created").length;

		const result: PublishResult = {
			success: failedPublications === 0,
			totalArticles: task.articleIds.length,
			successfulPublications,
			failedPublications,
			draftOnlyPublications,
			details,
		};

		progressState.currentStep = "Task completed";
		await updatePublishTask(db, taskId, {
			status: failedPublications === 0 ? "completed" : "failed",
			completedAt: Date.now(),
			currentStep: progressState.progressStepNumber,
			resultData: result,
			progressData: {
				currentArticleIndex: task.articleIds.length > 0 ? task.articleIds.length - 1 : 0,
				totalArticles: task.articleIds.length,
				currentAccountIndex: task.accountConfigs.length > 0 ? task.accountConfigs.length - 1 : 0,
				totalAccounts: task.accountConfigs.length,
				currentStep: progressState.currentStep,
				completedSteps: progressState.completedSteps,
				failedSteps: progressState.failedSteps,
				skippedSteps: progressState.skippedSteps,
			},
		});

		return result;
	} catch (error) {
		const publishError = toPublishServiceError(error, PublishErrorCodes.PUBLISH_EXECUTION_FAILED);
		const message = publishError.message;
		await updatePublishTask(db, taskId, {
			status: "failed",
			completedAt: Date.now(),
			currentStep: progressState.progressStepNumber,
			errorData: {
				code: publishError.code,
				message,
				details: {
					stepNumber: progressState.progressStepNumber,
					currentStep: progressState.currentStep,
				},
			},
			progressData: {
				currentArticleIndex: progressState.currentArticleIndex,
				totalArticles: task.articleIds.length,
				currentAccountIndex: progressState.currentAccountIndex,
				totalAccounts: task.accountConfigs.length,
				currentStep: `${progressState.currentStep} failed`,
				completedSteps: progressState.completedSteps,
				failedSteps: progressState.failedSteps + 1,
				skippedSteps: progressState.skippedSteps,
			},
		});
		logger.error({
			module: "publish.service",
			event: "task.failed",
			requestId,
			taskId,
			errorCode: publishError.code,
			message,
		});

		return {
			success: false,
			totalArticles: task.articleIds.length,
			successfulPublications: details.filter((detail) => detail.success).length,
			failedPublications: details.filter((detail) => !detail.success).length + 1,
			draftOnlyPublications: details.filter((detail) => detail.status === "draft_created").length,
			details,
		};
	}
}

// Cancel publish task
export async function cancelPublishTask(
	db: D1Database,
	taskId: string,
): Promise<{ success: boolean; message: string }> {
	const task = await getPublishTask(db, taskId);
	if (!task) {
		return { success: false, message: "Task not found" };
	}

	if (task.status === "completed" || task.status === "failed") {
		return { success: false, message: "Task is already finished" };
	}

	if (task.status === "cancelled") {
		return { success: false, message: "Task is already cancelled" };
	}

	await updatePublishTask(db, taskId, {
		status: "cancelled",
		completedAt: Date.now(),
	});

	return { success: true, message: "Task cancelled" };
}

// Get publish task status
export async function getPublishTaskStatus(db: D1Database, taskId: string) {
	const task = await getPublishTask(db, taskId);
	if (!task) {
		throw new PublishServiceError({
			code: PublishErrorCodes.TASK_NOT_FOUND,
			status: 404,
			message: "Task not found",
			details: { taskId },
		});
	}

	const steps = await listPublishTaskSteps(db, taskId);
	return { task, steps };
}

// Quick publish one article to one account
export async function quickPublish(
	db: D1Database,
	articleId: string,
	accountId: string,
	draftOnly = false,
	ctx?: ExecutionContext,
	options: TaskExecutionOptions = {},
): Promise<{ success: boolean; message: string; publicationId?: string }> {
	const account = await getPlatformAccount(db, accountId, options.encryptionKey);
	if (!account) {
		throw new PublishServiceError({
			code: PublishErrorCodes.ACCOUNT_NOT_FOUND,
			status: 404,
			message: "Account not found",
			details: { accountId },
		});
	}

	const task = await createPublishTaskService(
		db,
		{
			articleIds: [articleId],
			accountConfigs: [{
				accountId,
				platform: account.platform,
				draftOnly,
			}],
		},
		ctx,
		options,
	);

	return {
		success: true,
		message: "Quick publish task created",
		publicationId: task.task.id,
	};
}

// Process scheduled tasks (triggered by cron)
export async function processScheduledTasks(
	db: D1Database,
	options: TaskExecutionOptions = {},
): Promise<void> {
	const tasks = await getPendingScheduledTasks(db);
	for (const task of tasks) {
		logger.info({
			module: "publish.scheduler",
			event: "task.execute",
			taskId: task.id,
		});
		executePublishTask(db, task.id, options).catch((error) => {
			const publishError = toPublishServiceError(error, PublishErrorCodes.PUBLISH_EXECUTION_FAILED);
			logger.error({
				module: "publish.scheduler",
				event: "task.failed",
				taskId: task.id,
				errorCode: publishError.code,
				message: publishError.message,
			});
		});
	}
}
