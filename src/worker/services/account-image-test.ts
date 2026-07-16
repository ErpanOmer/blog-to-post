import type { Env, PlatformType } from "@/worker/types";
import { getPlatformAccount } from "@/worker/db/platform-accounts";
import { getAccountService } from "@/worker/accounts";
import {
	ImagePipelineError,
	ImagePipelineErrorCodes,
	PublishImageRuntime,
	normalizePublishImageSource,
	sanitizeImageErrorMessage,
	sanitizeImageUrl,
} from "@/worker/utils/media";

export class AccountImageTestError extends Error {
	constructor(
		readonly code: string,
		message: string,
		readonly status: 400 | 404 | 409 | 502,
		readonly platform?: PlatformType,
	) {
		super(message);
		this.name = "AccountImageTestError";
	}
}

export async function testAccountImageUpload(env: Env, accountId: string, rawSourceUrl: string) {
	const sourceUrl = normalizePublishImageSource(rawSourceUrl);
	const account = await getPlatformAccount(env.DB, accountId, env.ENCRYPTION_KEY);
	if (!account) throw new AccountImageTestError("ACCOUNT_NOT_FOUND", "Account not found", 404);
	if (account.platform === "website") {
		throw new AccountImageTestError(
			"IMAGE_TEST_UNSUPPORTED",
			"Website adapter keeps original image URLs and is excluded from image-host testing",
			400,
			account.platform,
		);
	}
	if (!account.isActive || !account.isVerified) {
		throw new AccountImageTestError(
			"ACCOUNT_NOT_READY",
			"Account must be active and verified before testing image upload",
			409,
			account.platform,
		);
	}
	if (!account.authToken) {
		throw new AccountImageTestError(
			"ACCOUNT_TOKEN_MISSING",
			"Account authentication is missing",
			409,
			account.platform,
		);
	}

	const service = getAccountService(account.platform, account.authToken, env);
	if (!service) {
		throw new AccountImageTestError(
			"UNSUPPORTED_PLATFORM",
			`Unsupported platform: ${account.platform}`,
			400,
			account.platform,
		);
	}

	const runtime = new PublishImageRuntime();
	service.setPublishImageRuntime?.(runtime);
	try {
		const source = await runtime.resolve(sourceUrl, { platform: account.platform });
		const upload = await service.imageUpload(sourceUrl);
		if (!upload.success || !upload.url) {
			const stats = service.getLastImageOperationStats?.();
			const message = sanitizeImageErrorMessage(upload.message || "Platform image upload failed");
			const resultInvalid = Boolean(stats?.verificationAttempts)
				|| /(?:verification|invalid (?:payload|url)|did not return|missing .*url|outside the expected)/i.test(message);
			throw new ImagePipelineError({
				code: resultInvalid
					? ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID
					: ImagePipelineErrorCodes.PLATFORM_UPLOAD_FAILED,
				stage: resultInvalid ? "verification" : "upload",
				message,
				source: sanitizeImageUrl(sourceUrl),
				attempts: stats?.uploadAttempts,
			});
		}

		let uploadedHost: string | null = null;
		try {
			uploadedHost = new URL(upload.url).hostname;
		} catch {
			// The adapter-level result validator already rejects invalid URLs.
		}

		return {
			success: true as const,
			platform: account.platform,
			message: "Image upload test succeeded; the platform may retain this test image resource",
			source: {
				mimeType: source.image.mimeType,
				size: source.image.size,
				sha256: source.image.sha256,
				downloadAttempts: source.image.downloadAttempts,
			},
			upload: {
				url: sanitizeImageUrl(upload.url),
				host: uploadedHost,
				...service.getLastImageOperationStats?.(),
			},
		};
	} finally {
		service.clearPublishImageRuntime?.();
	}
}
