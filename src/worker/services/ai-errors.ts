export type AIErrorCode =
	| "AI_PROVIDER_NOT_CONFIGURED"
	| "AI_AUTH_FAILED"
	| "AI_MODEL_NOT_FOUND"
	| "AI_RATE_LIMITED"
	| "AI_TIMEOUT"
	| "AI_INVALID_RESPONSE"
	| "AI_PROVIDER_UNAVAILABLE"
	| "AI_INVALID_CONFIGURATION";

export class AIServiceError extends Error {
	constructor(
		public readonly code: AIErrorCode,
		message: string,
		public readonly status: 400 | 401 | 404 | 409 | 429 | 500 | 502 | 503 | 504 = 500,
	) {
		super(message);
		this.name = code;
	}
}

export function sanitizeAIErrorMessage(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error ?? "");
	return raw
		.replace(/Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi, "Bearer [REDACTED]")
		.replace(/(api[-_]?key|x-api-key)(?:\s*[:=]\s*|%3D)[^\s&,]+/gi, "$1=[REDACTED]")
		.replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
		.slice(0, 300);
}
