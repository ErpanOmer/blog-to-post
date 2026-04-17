type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEYS = new Set([
	"authToken",
	"authorization",
	"cookie",
	"token",
	"accessToken",
	"access_token",
	"refreshToken",
	"refresh_token",
	"secret",
	"password",
]);

function redactValue(value: unknown, depth = 0): unknown {
	if (depth > 4) return "[MaxDepth]";
	if (value === null || value === undefined) return value;
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, depth + 1));
	}
	if (typeof value === "object") {
		const record = value as Record<string, unknown>;
		const output: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(record)) {
			if (SENSITIVE_KEYS.has(key)) {
				output[key] = "***";
				continue;
			}
			output[key] = redactValue(item, depth + 1);
		}
		return output;
	}
	return value;
}

export interface LogFields {
	module: string;
	event: string;
	requestId?: string;
	taskId?: string;
	errorCode?: string;
	message?: string;
	[key: string]: unknown;
}

function writeLog(level: LogLevel, fields: LogFields): void {
	const redacted = redactValue(fields);
	const redactedFields =
		redacted && typeof redacted === "object"
			? (redacted as Record<string, unknown>)
			: {};
	const payload = {
		ts: new Date().toISOString(),
		level,
		...redactedFields,
	};
	const line = JSON.stringify(payload);
	if (level === "error") {
		console.error(line);
		return;
	}
	if (level === "warn") {
		console.warn(line);
		return;
	}
	console.info(line);
}

export const logger = {
	info(fields: LogFields): void {
		writeLog("info", fields);
	},
	warn(fields: LogFields): void {
		writeLog("warn", fields);
	},
	error(fields: LogFields): void {
		writeLog("error", fields);
	},
};

export function createRequestId(): string {
	return crypto.randomUUID();
}
