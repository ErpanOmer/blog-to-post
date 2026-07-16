import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/worker/utils/helpers", () => ({
	randomDelay: vi.fn(async () => undefined),
}));

import {
	ImagePipelineError,
	ImagePipelineErrorCodes,
	PublishImageRuntime,
	sanitizeImageUrl,
} from "./runtime";

const PNG_BYTES = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
	0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

function imageResponse(): Response {
	return new Response(PNG_BYTES, {
		status: 200,
		headers: { "content-type": "image/png" },
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("PublishImageRuntime", () => {
	it("redacts provider signing and authentication query parameters", () => {
		const sanitized = sanitizeImageUrl(
			"https://images.example.com/file.png?policy=secret&x-orig-authkey=private&auth_key=signed&x-orig-sign=value&width=1200",
		);

		expect(sanitized).toContain("policy=***");
		expect(sanitized).toContain("x-orig-authkey=***");
		expect(sanitized).toContain("auth_key=***");
		expect(sanitized).toContain("x-orig-sign=***");
		expect(sanitized).toContain("width=1200");
		expect(sanitized).not.toContain("private");
		expect(sanitized).not.toContain("signed");
	});

	it("retries four failures and succeeds on the fifth attempt", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(imageResponse());
		vi.stubGlobal("fetch", fetchMock);

		const result = await new PublishImageRuntime().resolve("https://example.com/image.png");

		expect(fetchMock).toHaveBeenCalledTimes(5);
		expect(result.image.downloadAttempts).toBe(5);
		expect(result.image.mimeType).toBe("image/png");
		expect(result.image.size).toBe(PNG_BYTES.byteLength);
	});

	it("returns a stable typed error after five failed downloads", async () => {
		const fetchMock = vi.fn(async () => new Response("busy", { status: 503 }));
		vi.stubGlobal("fetch", fetchMock);

		await expect(new PublishImageRuntime().resolve("https://example.com/image.png"))
			.rejects.toMatchObject({
				code: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
				attempts: 5,
			});
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});

	it("shares both completed and in-flight downloads", async () => {
		let release: ((response: Response) => void) | undefined;
		const pending = new Promise<Response>((resolve) => { release = resolve; });
		const fetchMock = vi.fn(() => pending);
		vi.stubGlobal("fetch", fetchMock);
		const runtime = new PublishImageRuntime();

		const requests = Array.from({ length: 7 }, () => runtime.resolve("https://example.com/shared.png"));
		release?.(imageResponse());
		const [firstResult, ...sharedResults] = await Promise.all(requests);
		const thirdResult = await runtime.resolve("https://example.com/shared.png");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(firstResult.cacheHit).toBe(false);
		expect(sharedResults.every((result) => result.cacheHit)).toBe(true);
		expect(thirdResult.cacheHit).toBe(true);
		expect(sharedResults.every((result) => result.image.sha256 === firstResult.image.sha256)).toBe(true);
	});

	it("evicts failed promises so a later platform can retry", async () => {
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(new Response("busy", { status: 503 }))
			.mockResolvedValueOnce(imageResponse());
		vi.stubGlobal("fetch", fetchMock);
		const runtime = new PublishImageRuntime();

		await expect(runtime.resolve("https://example.com/retry.png")).rejects.toBeInstanceOf(ImagePipelineError);
		const recovered = await runtime.resolve("https://example.com/retry.png");

		expect(fetchMock).toHaveBeenCalledTimes(6);
		expect(recovered.image.downloadAttempts).toBe(1);
	});

	it("rotates immutable GitHub jsDelivr candidates", async () => {
		const urls: string[] = [];
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			urls.push(String(input));
			return urls.length < 3 ? new Response("busy", { status: 503 }) : imageResponse();
		});
		vi.stubGlobal("fetch", fetchMock);

		await new PublishImageRuntime().resolve(
			"https://cdn.jsdelivr.net/gh/owner/repo@commit/path/image.png",
		);

		expect(urls.map((url) => new URL(url).hostname)).toEqual([
			"cdn.jsdelivr.net",
			"gcore.jsdelivr.net",
			"fastly.jsdelivr.net",
		]);
	});

	it("rejects HTML pretending to be an image", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>no image</html>", {
			status: 200,
			headers: { "content-type": "text/html" },
		})));

		await expect(new PublishImageRuntime().resolve("https://example.com/not-image.png"))
			.rejects.toMatchObject({
				code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
			});
	});

	it.each([
		{
			name: "HTTP 429",
			response: () => new Response("rate limited", { status: 429 }),
			code: ImagePipelineErrorCodes.SOURCE_DOWNLOAD_FAILED,
		},
		{
			name: "an empty image response",
			response: () => new Response(new Uint8Array(), { status: 200, headers: { "content-type": "image/png" } }),
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
		},
		{
			name: "a MIME/header conflict",
			response: () => new Response(PNG_BYTES, { status: 200, headers: { "content-type": "image/jpeg" } }),
			code: ImagePipelineErrorCodes.SOURCE_CONTENT_INVALID,
		},
	])("retries and rejects $name", async ({ response, code }) => {
		const fetchMock = vi.fn(async () => response());
		vi.stubGlobal("fetch", fetchMock);

		await expect(new PublishImageRuntime().resolve("https://example.com/invalid.png"))
			.rejects.toMatchObject({ code, attempts: 5 });
		expect(fetchMock).toHaveBeenCalledTimes(5);
	});

	it("decodes and validates data URIs without network access", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const encoded = btoa(String.fromCharCode(...PNG_BYTES));

		const result = await new PublishImageRuntime().resolve(`data:image/png;base64,${encoded}`);

		expect(result.image.mimeType).toBe("image/png");
		expect(result.image.downloadAttempts).toBe(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
