import {
	ImagePipelineError,
	ImagePipelineErrorCodes,
} from "@/worker/utils/media";

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
	IMAGE_SOURCE_INVALID: ImagePipelineErrorCodes.SOURCE_INVALID,
	IMAGE_SOURCE_DOWNLOAD_FAILED: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
	IMAGE_SOURCE_CONTENT_INVALID: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
	IMAGE_PLATFORM_UPLOAD_FAILED: ImagePipelineErrorCodes.PLATFORM_UPLOAD_FAILED,
	IMAGE_PLATFORM_RESULT_INVALID: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
	IMAGE_REPLACEMENT_INCOMPLETE: ImagePipelineErrorCodes.REPLACEMENT_INCOMPLETE,
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
	if (error instanceof ImagePipelineError) {
		return new PublishServiceError({
			code: error.code,
			status: error.code === ImagePipelineErrorCodes.SOURCE_INVALID ? 400 : 502,
			message: error.message,
			details: {
				stage: error.stage,
				source: error.source,
				attempts: error.attempts,
				httpStatus: error.httpStatus,
			},
			cause: error,
		});
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
