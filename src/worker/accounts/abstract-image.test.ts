import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/worker/utils/helpers", () => ({
	sleep: vi.fn(async () => undefined),
	randomDelay: vi.fn(async () => undefined),
}));

import { AbstractAccountService } from "./abstract";
import type {
	AccountInfo,
	AccountStatus,
	Article,
	ArticleDraft,
	ArticlePublishResult,
	ImageUploadResult,
	VerifyResult,
} from "./types";
import type { Article as SharedArticle } from "@/shared/types";
import { ImagePipelineErrorCodes } from "@/worker/utils/media";

const PNG_BYTES = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

class TestAccountService extends AbstractAccountService {
	constructor() {
		super("juejin", "test-token");
	}

	protected buildHeaders(): Record<string, string> { return {}; }

	async runUpload(upload: (attempt: number) => Promise<string>): Promise<string> {
		return await this.withPlatformImageUploadRetry({
			source: "https://source.example.com/image.png",
			upload,
			getUploadedUrl: (url) => url,
			isExpectedPlatformUrl: (url) => new URL(url).hostname === "images.example.com",
		});
	}

	assertResolved(sources: string[], resolved: Map<string, string>): void {
		this.assertImageSourcesResolved({
			sources,
			normalize: (source) => source.trim() || null,
			isPlatformHosted: (source) => new URL(source).hostname === "images.example.com",
			resolved,
			context: "test content",
		});
	}

	async verify(): Promise<VerifyResult> { return { valid: true, message: "ok" }; }
	async status(): Promise<AccountStatus> {
		return { isActive: true, isVerified: true, lastVerifiedAt: 0, message: "ok" };
	}
	async info(): Promise<AccountInfo> { return { id: "1", name: "test", isLogin: true }; }
	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> { void article; return null; }
	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		void article;
		return { success: true, message: "ok" };
	}
	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: true, message: "ok" };
	}
	async articleList(page?: number, pageSize?: number): Promise<Article[]> { void page; void pageSize; return []; }
	async articleDetail(articleId: string): Promise<Article | null> { void articleId; return null; }
	async articleTags(articleId: string): Promise<string[]> { void articleId; return []; }
	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		void imageData;
		void filename;
		return { success: false, message: "unused" };
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("AbstractAccountService image upload gate", () => {
	it("retries the complete platform upload and verifies the fifth result", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response(PNG_BYTES, {
			status: 200,
			headers: { "content-type": "image/png" },
		})));
		const upload = vi.fn(async (attempt: number) => {
			if (attempt < 5) throw new Error("temporary upload failure");
			return "https://images.example.com/image.png";
		});
		const service = new TestAccountService();

		await expect(service.runUpload(upload)).resolves.toBe("https://images.example.com/image.png");
		expect(upload).toHaveBeenCalledTimes(5);
		expect(service.getLastImageOperationStats()).toMatchObject({
			uploadAttempts: 5,
			verificationAttempts: 1,
		});
	});

	it("fails closed when all five uploaded URLs fail verification", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("missing", { status: 404 })));
		const upload = vi.fn(async () => "https://images.example.com/image.png");

		await expect(new TestAccountService().runUpload(upload)).rejects.toMatchObject({
			code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
			attempts: 5,
		});
		expect(upload).toHaveBeenCalledTimes(5);
	});

	it("fails closed after five platform upload errors", async () => {
		const upload = vi.fn(async () => {
			throw new Error("upload gateway unavailable");
		});

		await expect(new TestAccountService().runUpload(upload)).rejects.toMatchObject({
			code: ImagePipelineErrorCodes.PLATFORM_UPLOAD_FAILED,
			attempts: 5,
		});
		expect(upload).toHaveBeenCalledTimes(5);
	});

	it("rejects an upload result that omits its URL", async () => {
		const upload = vi.fn(async () => "");

		await expect(new TestAccountService().runUpload(upload)).rejects.toMatchObject({
			code: ImagePipelineErrorCodes.PLATFORM_RESULT_INVALID,
			attempts: 5,
		});
		expect(upload).toHaveBeenCalledTimes(5);
	});

	it("rejects incomplete source-to-platform mappings before draft creation", () => {
		const service = new TestAccountService();

		expect(() => service.assertResolved(
			["https://source.example.com/one.png", "https://source.example.com/two.png"],
			new Map([["https://source.example.com/one.png", "https://images.example.com/one.png"]]),
		)).toThrowError(expect.objectContaining({
			code: ImagePipelineErrorCodes.REPLACEMENT_INCOMPLETE,
		}));
	});
});
