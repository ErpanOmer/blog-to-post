export const PublishErrorCodes = {
	INVALID_REQUEST: "INVALID_REQUEST",
	ARTICLE_NOT_FOUND: "ARTICLE_NOT_FOUND",
	ACCOUNT_NOT_FOUND: "ACCOUNT_NOT_FOUND",
	ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
	ACCOUNT_NOT_VERIFIED: "ACCOUNT_NOT_VERIFIED",
	ACCOUNT_TOKEN_MISSING: "ACCOUNT_TOKEN_MISSING",
	UNSUPPORTED_PLATFORM: "UNSUPPORTED_PLATFORM",
	TASK_NOT_FOUND: "TASK_NOT_FOUND",
	TASK_ALREADY_PROCESSING: "TASK_ALREADY_PROCESSING",
	TASK_ALREADY_FINISHED: "TASK_ALREADY_FINISHED",
	TASK_ALREADY_CANCELLED: "TASK_ALREADY_CANCELLED",
	PUBLISH_EXECUTION_FAILED: "PUBLISH_EXECUTION_FAILED",
	IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
	INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type PublishErrorCode = (typeof PublishErrorCodes)[keyof typeof PublishErrorCodes];

export class PublishServiceError extends Error {
	code: PublishErrorCode;
	status: number;
	details?: Record<string, unknown>;

	constructor(params: {
		code: PublishErrorCode;
		message: string;
		status?: number;
		details?: Record<string, unknown>;
		cause?: unknown;
	}) {
		super(params.message, params.cause ? { cause: params.cause } : undefined);
		this.name = "PublishServiceError";
		this.code = params.code;
		this.status = params.status ?? 400;
		this.details = params.details;
	}
}

export function toPublishServiceError(
	error: unknown,
	fallbackCode: PublishErrorCode = PublishErrorCodes.INTERNAL_ERROR,
): PublishServiceError {
	if (error instanceof PublishServiceError) {
		return error;
	}
	const message = error instanceof Error ? error.message : "Unknown publish error";
	return new PublishServiceError({
		code: fallbackCode,
		message,
		status: fallbackCode === PublishErrorCodes.INTERNAL_ERROR ? 500 : 400,
		details: error instanceof Error ? { stack: error.stack } : undefined,
		cause: error,
	});
}

