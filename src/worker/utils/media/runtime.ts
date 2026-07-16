import type { PlatformType } from "@/worker/types";
import type { PublishTraceEvent } from "@/worker/accounts/types";
import { randomDelay } from "@/worker/utils/helpers";
import {
	COMMON_IMAGE_MIME_TO_EXTENSION,
	resolveImageMimeTypeFromBlob,
} from "./image";

export const IMAGE_MAX_ATTEMPTS = 5;
export const IMAGE_DOWNLOAD_TIMEOUT_MS = 20_000;
export const IMAGE_UPLOAD_ATTEMPT_TIMEOUT_MS = 90_000;

export const ImagePipelineErrorCodes = {
	SOURCE_INVALID: "IMAGE_SOURCE_INVALID",
	SOURCE_DOWNLOAD_FAILED: "IMAGE_SOURCE_DOWNLOAD_FAILED",
	SOURCE_CONTENT_INVALID: "IMAGE_SOURCE_CONTENT_INVALID",
	PLATFORM_UPLOAD_FAILED: "IMAGE_PLATFORM_UPLOAD_FAILED",
	PLATFORM_RESULT_INVALID: "IMAGE_PLATFORM_RESULT_INVALID",
	REPLACEMENT_INCOMPLETE: "IMAGE_REPLACEMENT_INCOMPLETE",
} as const;

export type ImagePipelineErrorCode =
	(typeof ImagePipelineErrorCodes)[keyof typeof ImagePipelineErrorCodes];

export type ImagePipelineStage =
	| "source"
	| "download"
	| "upload"
	| "verification"
	| "replacement";

export class ImagePipelineError extends Error {
	readonly code: ImagePipelineErrorCode;
	readonly stage: ImagePipelineStage;
	readonly source?: string;
	readonly attempts?: number;
	readonly httpStatus?: number;

	constructor(params: {
		code: ImagePipelineErrorCode;
		stage: ImagePipelineStage;
		message: string;
		source?: string;
		attempts?: number;
		httpStatus?: number;
		cause?: unknown;
	}) {
		super(params.message, params.cause ? { cause: params.cause } : undefined);
		this.name = "ImagePipelineError";
		this.code = params.code;
		this.stage = params.stage;
		this.source = params.source;
		this.attempts = params.attempts;
		this.httpStatus = params.httpStatus;
	}
}

export interface ResolvedPublishImage {
	cacheKey: string;
	sourceUrl: string;
	effectiveUrl: string;
	blob: Blob;
	mimeType: string;
	size: number;
	sha256: string;
	downloadAttempts: number;
}

export interface ResolvePublishImageResult {
	image: ResolvedPublishImage;
	cacheHit: boolean;
}

export interface ImageOperationStats {
	source?: string;
	downloadAttempts: number;
	uploadAttempts: number;
	verificationAttempts: number;
	cacheHit: boolean;
}

type TraceLogger = (event: PublishTraceEvent) => void | Promise<void>;

interface ResolveOptions {
	platform?: PlatformType;
	trace?: TraceLogger;
	headers?: HeadersInit;
}

const SENSITIVE_QUERY_KEYS = new Set([
	"access_token",
	"token",
	"auth",
	"authorization",
	"cookie",
	"key",
	"secret",
	"signature",
	"sign",
	"policy",
]);

export function sanitizeImageUrl(rawUrl: string): string {
	if (rawUrl.startsWith("data:")) return "data-uri";
	try {
		const parsed = new URL(rawUrl);
		parsed.username = "";
		parsed.password = "";
		parsed.searchParams.forEach((_value, key) => {
			const normalizedKey = key.toLowerCase();
			if (
				SENSITIVE_QUERY_KEYS.has(normalizedKey)
				|| normalizedKey.includes("token")
				|| normalizedKey.includes("secret")
				|| normalizedKey.includes("auth")
				|| normalizedKey.includes("key")
				|| normalizedKey.includes("signature")
				|| normalizedKey.endsWith("sign")
				|| normalizedKey.startsWith("x-sign")
			) {
				parsed.searchParams.set(key, "***");
			}
		});
		return parsed.toString();
	} catch {
		return "invalid-image-url";
	}
}

export function sanitizeImageErrorMessage(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error ?? "Unknown image error");
	const withoutSecrets = raw
		.replace(/\b(authorization|cookie|access[_-]?token|app[_-]?secret|signature|policy)\s*[:=]\s*[^\s,;]+/gi, "$1=***")
		.replace(/https?:\/\/[^\s"'<>]+/gi, (url) => sanitizeImageUrl(url));
	return withoutSecrets.slice(0, 500);
}

export function normalizePublishImageSource(rawSource: string): string {
	const cleaned = rawSource.trim().replace(/&amp;/g, "&");
	if (!cleaned) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: "Image source is empty",
		});
	}
	if (cleaned.startsWith("data:")) return cleaned;

	const candidate = cleaned.startsWith("//") ? `https:${cleaned}` : cleaned;
	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch (error) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: `Invalid image URL: ${sanitizeImageUrl(candidate)}`,
			source: sanitizeImageUrl(candidate),
			cause: error,
		});
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: `Unsupported image URL protocol: ${parsed.protocol}`,
			source: sanitizeImageUrl(parsed.toString()),
		});
	}
	if (parsed.protocol === "http:") parsed.protocol = "https:";
	return parsed.toString();
}

function buildJsdelivrCandidates(sourceUrl: string): string[] {
	let parsed: URL;
	try {
		parsed = new URL(sourceUrl);
	} catch {
		return [sourceUrl];
	}
	if (parsed.hostname.toLowerCase() !== "cdn.jsdelivr.net" || !parsed.pathname.startsWith("/gh/")) {
		return [sourceUrl];
	}

	const candidates = [sourceUrl];
	for (const hostname of ["gcore.jsdelivr.net", "fastly.jsdelivr.net"]) {
		const candidate = new URL(parsed.toString());
		candidate.hostname = hostname;
		candidates.push(candidate.toString());
	}
	return candidates;
}

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	return {
		signal: controller.signal,
		clear: () => clearTimeout(timeoutId),
	};
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", buffer);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function mimeEquivalent(left: string, right: string): boolean {
	const normalize = (value: string) => value.toLowerCase() === "image/jpg" ? "image/jpeg" : value.toLowerCase();
	return normalize(left) === normalize(right);
}

async function inspectImageBuffer(buffer: ArrayBuffer, reportedMime: string): Promise<{ blob: Blob; mimeType: string }> {
	if (buffer.byteLength === 0) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
			stage: "download",
			message: "Image response body is empty",
		});
	}

	const normalizedReported = reportedMime.split(";")[0]?.trim().toLowerCase() ?? "";
	const sniffBlob = new Blob([buffer], { type: "application/octet-stream" });
	let detectedMime = await resolveImageMimeTypeFromBlob(sniffBlob);

	if (detectedMime === "application/octet-stream" && normalizedReported === "image/svg+xml") {
		const prefix = new TextDecoder().decode(buffer.slice(0, Math.min(buffer.byteLength, 1024))).trimStart();
		if (/^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(prefix)) detectedMime = "image/svg+xml";
	}

	if (!(detectedMime in COMMON_IMAGE_MIME_TO_EXTENSION)) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
			stage: "download",
			message: `Resource is not a supported image (reported=${normalizedReported || "unknown"})`,
		});
	}
	if (
		normalizedReported
		&& normalizedReported !== "application/octet-stream"
		&& normalizedReported.startsWith("image/")
		&& !mimeEquivalent(normalizedReported, detectedMime)
	) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
			stage: "download",
			message: `Image MIME does not match content (reported=${normalizedReported}, detected=${detectedMime})`,
		});
	}
	if (normalizedReported && !normalizedReported.startsWith("image/") && normalizedReported !== "application/octet-stream") {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
			stage: "download",
			message: `Resource content type is not an image (${normalizedReported})`,
		});
	}

	return {
		blob: new Blob([buffer], { type: detectedMime }),
		mimeType: detectedMime,
	};
}

async function parseDataUri(source: string): Promise<ResolvedPublishImage> {
	const match = source.match(/^data:([^;,]+)?(;base64)?,([\s\S]*)$/i);
	if (!match) {
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: "Invalid image data URI",
			source: "data-uri",
		});
	}

	try {
		const bytes = match[2]
			? Uint8Array.from(atob(match[3] || ""), (character) => character.charCodeAt(0))
			: new TextEncoder().encode(decodeURIComponent(match[3] || ""));
		const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
		const inspected = await inspectImageBuffer(buffer, match[1] || "application/octet-stream");
		return {
			cacheKey: source,
			sourceUrl: "data-uri",
			effectiveUrl: "data-uri",
			blob: inspected.blob,
			mimeType: inspected.mimeType,
			size: inspected.blob.size,
			sha256: await sha256Hex(buffer),
			downloadAttempts: 0,
		};
	} catch (error) {
		if (error instanceof ImagePipelineError) throw error;
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_INVALID,
			stage: "source",
			message: "Unable to decode image data URI",
			source: "data-uri",
			cause: error,
		});
	}
}

export class PublishImageRuntime {
	private readonly cache = new Map<string, Promise<ResolvedPublishImage>>();

	async resolve(rawSource: string, options: ResolveOptions = {}): Promise<ResolvePublishImageResult> {
		const normalized = normalizePublishImageSource(rawSource);
		const existing = this.cache.get(normalized);
		if (existing) {
			const image = await existing;
			await options.trace?.({
				stage: "image_source_cache_hit",
				message: "Reuse image bytes from publish task cache",
				metadata: {
					platform: options.platform,
					source: sanitizeImageUrl(normalized),
					mimeType: image.mimeType,
					size: image.size,
					sha256: image.sha256,
				},
			});
			return { image, cacheHit: true };
		}

		const pending = normalized.startsWith("data:")
			? parseDataUri(normalized)
			: this.download(normalized, options);
		this.cache.set(normalized, pending);
		try {
			return { image: await pending, cacheHit: false };
		} catch (error) {
			this.cache.delete(normalized);
			throw error;
		}
	}

	private async download(sourceUrl: string, options: ResolveOptions): Promise<ResolvedPublishImage> {
		const candidates = buildJsdelivrCandidates(sourceUrl);
		let lastError: unknown;

		for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
			const effectiveUrl = candidates[(attempt - 1) % candidates.length] ?? sourceUrl;
			const safeEffectiveUrl = sanitizeImageUrl(effectiveUrl);
			await options.trace?.({
				stage: "image_source_download_start",
				message: "Download source image",
				metadata: {
					platform: options.platform,
					source: sanitizeImageUrl(sourceUrl),
					effectiveUrl: safeEffectiveUrl,
					attempt,
					maxAttempts: IMAGE_MAX_ATTEMPTS,
				},
			});

			const timeout = timeoutSignal(IMAGE_DOWNLOAD_TIMEOUT_MS);
			try {
				const response = await fetch(effectiveUrl, {
					method: "GET",
					headers: {
						accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
						"user-agent": "Mozilla/5.0 (compatible; Blog-to-Post-Image-Pipeline/1.0)",
						...options.headers,
					},
					signal: timeout.signal,
				});
				if (!response.ok) {
					throw new ImagePipelineError({
						code: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
						stage: "download",
						message: `Image download failed with HTTP ${response.status}`,
						source: safeEffectiveUrl,
						attempts: attempt,
						httpStatus: response.status,
					});
				}

				const buffer = await response.arrayBuffer();
				const inspected = await inspectImageBuffer(
					buffer,
					response.headers.get("content-type") || "application/octet-stream",
				);
				const image: ResolvedPublishImage = {
					cacheKey: sourceUrl,
					sourceUrl,
					effectiveUrl,
					blob: inspected.blob,
					mimeType: inspected.mimeType,
					size: inspected.blob.size,
					sha256: await sha256Hex(buffer),
					downloadAttempts: attempt,
				};
				await options.trace?.({
					stage: "image_source_download_done",
					message: "Source image downloaded and validated",
					metadata: {
						platform: options.platform,
						source: sanitizeImageUrl(sourceUrl),
						effectiveUrl: safeEffectiveUrl,
						attempt,
						mimeType: image.mimeType,
						size: image.size,
						sha256: image.sha256,
					},
				});
				return image;
			} catch (error) {
				lastError = error;
				const message = error instanceof Error && error.name === "AbortError"
					? `Image download timed out after ${IMAGE_DOWNLOAD_TIMEOUT_MS}ms`
					: sanitizeImageErrorMessage(error);
				await options.trace?.({
					stage: attempt < IMAGE_MAX_ATTEMPTS ? "image_source_download_retry" : "image_source_download_failed",
					level: attempt < IMAGE_MAX_ATTEMPTS ? "warn" : "error",
					message,
					metadata: {
						platform: options.platform,
						source: sanitizeImageUrl(sourceUrl),
						effectiveUrl: safeEffectiveUrl,
						attempt,
						maxAttempts: IMAGE_MAX_ATTEMPTS,
					},
				});
				if (attempt < IMAGE_MAX_ATTEMPTS) {
					const baseDelay = 500 * (2 ** (attempt - 1));
					await randomDelay(baseDelay, Math.min(baseDelay * 2, 8_000));
				}
			} finally {
				timeout.clear();
			}
		}

		if (lastError instanceof ImagePipelineError) {
			throw new ImagePipelineError({
				code: lastError.code === ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID
					? ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID
					: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
				stage: "download",
				message: `Source image failed after ${IMAGE_MAX_ATTEMPTS} attempts: ${sanitizeImageErrorMessage(lastError)}`,
				source: sanitizeImageUrl(sourceUrl),
				attempts: IMAGE_MAX_ATTEMPTS,
				httpStatus: lastError.httpStatus,
				cause: lastError,
			});
		}
		throw new ImagePipelineError({
			code: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
			stage: "download",
			message: `Source image failed after ${IMAGE_MAX_ATTEMPTS} attempts`,
			source: sanitizeImageUrl(sourceUrl),
			attempts: IMAGE_MAX_ATTEMPTS,
			cause: lastError,
		});
	}
}

export async function withImageAttemptTimeout<T>(execute: () => Promise<T>): Promise<T> {
	const timeout = timeoutSignal(IMAGE_UPLOAD_ATTEMPT_TIMEOUT_MS);
	try {
		return await Promise.race([
			execute(),
			new Promise<T>((_, reject) => {
				timeout.signal.addEventListener("abort", () => reject(new Error(
					`Image upload attempt timed out after ${IMAGE_UPLOAD_ATTEMPT_TIMEOUT_MS}ms`,
				)), { once: true });
			}),
		]);
	} finally {
		timeout.clear();
	}
}
