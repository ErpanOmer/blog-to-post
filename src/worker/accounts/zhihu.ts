import { AbstractAccountService } from "@/worker/accounts/abstract";
import { registerAccountService } from "@/worker/accounts/index";
import type {
	VerifyResult,
	AccountStatus,
	AccountInfo,
	ArticleDraft,
	Article,
	ArticlePublishResult,
	ImageUploadResult,
} from "@/worker/accounts/types";
import type { Article as SharedArticle } from "@/shared/types";
import type { ZhihuUserInfo } from "@/worker/accounts/abstract";
import { marked } from "marked";
import { randomDelay } from "@/worker/utils/helpers";
import { applyMarkdownContentSlots } from "@/worker/utils/content-slots";
import {
	FRONTEND_AUTO_DETECT_LANGUAGES,
	highlightHtmlPreCodeBlocksWithHighlightJs,
} from "@/worker/utils/html-code-highlight";
import md5Lib from "js-md5";

interface ZhihuConvertResponse {
	code: number;
	message: string;
	data?: {
		html_content?: string;
	};
}

interface ZhihuUploadedImageByUrlResponse {
	src?: string;
	hash?: string;
	message?: string;
}

interface ZhihuImageTokenResponse {
	upload_file?: {
		state?: number;
		image_id?: string;
		object_key?: string;
		publish_state?: number;
	};
	upload_token?: {
		access_id?: string;
		access_key?: string;
		access_token?: string;
	};
}

interface ZhihuImageDetailResponse {
	status?: string;
	original_hash?: string;
}

interface ZhihuPublishResponse {
	code?: number;
	message?: string;
	toast_message?: string;
	data?: {
		publish_type?: string;
		publish?: {
			id?: string;
		};
		result?: string | { publish?: { id?: string } };
	};
	publish?: {
		id?: string;
	};
}

const ZHIHU_URL_IMAGE_UPLOAD_ENDPOINT = "https://zhuanlan.zhihu.com/api/uploaded_images";
const ZHIHU_IMAGE_TOKEN_ENDPOINT = "https://api.zhihu.com/images";
const ZHIHU_IMAGE_DETAIL_ENDPOINT = "https://api.zhihu.com/images";
const ZHIHU_OSS_UPLOAD_ENDPOINT = "https://zhihu-pics-upload.zhimg.com";
const ZHIHU_OSS_BUCKET = "zhihu-pics";
const ZHIHU_OSS_USER_AGENT = "aliyun-sdk-js/6.8.0";
const md5 = md5Lib as unknown as (message: string | ArrayBuffer | Uint8Array) => string;

export default class ZhihuAccountService extends AbstractAccountService {
	private imageUrlCache = new Map<string, string>();
	private draftHtmlContentCache = new Map<string, string>();

	constructor(authToken: string) {
		super("zhihu", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
		};
	}

	private buildZhihuBrowserHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
		return {
			cookie: this.authToken,
			referer: "https://zhuanlan.zhihu.com/",
			origin: "https://www.zhihu.com",
			accept: "application/json, text/plain, */*",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			"x-requested-with": "XMLHttpRequest",
			...extraHeaders,
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();

			return {
				valid: true,
				message: "验证成功",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "验证失败",
			};
		}
	}

	async status(): Promise<AccountStatus> {
		const result = await this.verify();
		return {
			isActive: result.valid,
			isVerified: result.valid,
			lastVerifiedAt: Date.now(),
			message: result.message,
		};
	}

	async info(): Promise<AccountInfo> {
		const data = await this.request<ZhihuUserInfo>(
			"https://www.zhihu.com/api/v4/me?include=is_realname",
			{
				headers: {
					cookie: this.authToken,
					"Content-Type": "application/json",
				},
			},
		);

		return {
			id: data.uid,
			name: data.name,
			avatar: data.avatar_url,
			isLogin: true,
			isRealname: data.is_realname,
		};
	}

	private convertMarkdownToHtml(content: string): string {
		try {
			const renderer = new marked.Renderer();

			renderer.heading = ({ tokens, depth }) => {
				const text = tokens
					.map((token) => ("text" in token ? token.text : ""))
					.join("");

				const id = text
					.toLowerCase()
					.replace(/[：，。！？、]/g, "-")
					.replace(/\s+/g, "-")
					.replace(/[^\w\u4e00-\u9fa5-]/g, "");

				return `<h${depth} id="${id}">${text}</h${depth}>\n`;
			};

			marked.setOptions({
				renderer,
				gfm: true,
				breaks: false,
				pedantic: false,
			});

			return marked.parse(content, {
				async: false,
				gfm: true,
				breaks: false,
			}) as string;
		} catch (error) {
			console.error("Markdown to HTML conversion failed:", error);
			return content;
		}
	}

	private async convertMarkdownToHtmlViaAPI(content: string): Promise<string> {
		try {
			const fileBlob = new Blob([content], { type: "text/markdown;charset=utf-8" });

			const formdata = new FormData();
			formdata.append("document", fileBlob, "content.md");
			formdata.append("task_id", crypto.randomUUID());
			formdata.append("content_token", "undefined");
			formdata.append("scene", "article");

			console.log("Sending content to Zhihu convert API, content length:", content);

			const response = await this.fetchPlatform("https://www.zhihu.com/api/v4/document/convert", {
				method: "POST",
				body: formdata,
				headers: this.buildZhihuBrowserHeaders({
					"x-requested-with": "fetch",
				}),
				redirect: "follow",
			});

			await randomDelay(1000, 2000);

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`Zhihu Markdown convert API failed: HTTP ${response.status}`, errorText);
				throw new Error(`HTTP ${response.status}`);
			}

			const result = (await response.json()) as ZhihuConvertResponse;
			if (result.code !== 0) {
				throw new Error(result.message || "Zhihu convert API returned error");
			}
			if (!result.data?.html_content) {
				throw new Error("Zhihu convert API did not return html_content");
			}

			console.log("Zhihu convert API succeeded, html content length:", result);

			return result.data.html_content;
		} catch (error) {
			console.error("Zhihu API Markdown conversion failed, fallback to local conversion:", error);
			return this.convertMarkdownToHtml(content);
		}
	}

	private normalizeImageUrl(rawUrl: string): string | null {
		if (!rawUrl) return null;

		const cleaned = rawUrl.trim().replace(/&amp;/g, "&");
		if (!cleaned) return null;
		if (cleaned.startsWith("data:")) return cleaned;

		let candidate = cleaned;
		if (candidate.startsWith("//")) {
			candidate = `https:${candidate}`;
		}

		try {
			const url = new URL(candidate, "https://zhuanlan.zhihu.com");
			if (url.hostname === "link.zhihu.com") {
				const target = url.searchParams.get("target");
				if (target) {
					const decodedTarget = decodeURIComponent(target);
					return this.normalizeImageUrl(decodedTarget);
				}
			}

			if (url.protocol !== "http:" && url.protocol !== "https:") {
				return null;
			}
			if (url.protocol === "http:") {
				url.protocol = "https:";
			}
			return url.toString();
		} catch {
			return null;
		}
	}

	private isZhihuHostedImage(url: string): boolean {
		try {
			const parsed = new URL(url);
			return /(^|\.)zhimg\.com$/i.test(parsed.hostname) || /(^|\.)zhihu\.com$/i.test(parsed.hostname);
		} catch {
			return false;
		}
	}

	private guessFileName(imageUrl: string, contentType: string): string {
		const extMap: Record<string, string> = {
			"image/jpeg": "jpg",
			"image/jpg": "jpg",
			"image/png": "png",
			"image/webp": "webp",
			"image/gif": "gif",
			"image/bmp": "bmp",
			"image/svg+xml": "svg",
		};

		const ext = extMap[contentType.toLowerCase()] ?? "jpg";
		let baseName = "image";

		try {
			const parsed = new URL(imageUrl);
			const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
			if (lastSegment) {
				const safeName = lastSegment.replace(/[^a-zA-Z0-9._-]/g, "_");
				const hasExt = /\.[a-zA-Z0-9]+$/.test(safeName);
				if (hasExt) {
					return safeName;
				}
				baseName = safeName;
			}
		} catch {
			// keep fallback
		}

		return `${baseName}.${ext}`;
	}

	private tryParseJson(rawText: string): unknown | null {
		if (!rawText) return null;
		try {
			return JSON.parse(rawText) as unknown;
		} catch {
			return null;
		}
	}

	private toRecord(value: unknown): Record<string, unknown> | null {
		if (!value || typeof value !== "object") {
			return null;
		}
		return value as Record<string, unknown>;
	}

	private pickPublishId(record: Record<string, unknown> | null): string | undefined {
		const publishRecord = this.toRecord(record?.publish);
		const publishId = publishRecord?.id;
		if (typeof publishId !== "string") {
			return undefined;
		}
		const trimmed = publishId.trim();
		return trimmed ? trimmed : undefined;
	}

	private extractPublishIdFromResponse(payload: unknown): {
		publishId?: string;
		source: "publish.id" | "data.publish.id" | "data.result.publish.id" | "not_found";
	} {
		const root = this.toRecord(payload);
		const directPublishId = this.pickPublishId(root);
		if (directPublishId) {
			return { publishId: directPublishId, source: "publish.id" };
		}

		const dataRecord = this.toRecord(root?.data);
		const dataPublishId = this.pickPublishId(dataRecord);
		if (dataPublishId) {
			return { publishId: dataPublishId, source: "data.publish.id" };
		}

		const rawResult = dataRecord?.result;
		const parsedResult =
			typeof rawResult === "string"
				? this.tryParseJson(rawResult)
				: rawResult;
		const resultRecord = this.toRecord(parsedResult);
		const resultPublishId = this.pickPublishId(resultRecord);
		if (resultPublishId) {
			return { publishId: resultPublishId, source: "data.result.publish.id" };
		}

		return { source: "not_found" };
	}

	private async uploadImageBySourceUrlToZhihu(imageUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(imageUrl);
		if (!normalized || normalized.startsWith("data:")) {
			throw new Error(`Unsupported image URL for Zhihu upload: ${imageUrl}`);
		}

		await this.tracePublish({
			stage: "zhihu_upload_by_url_start",
			message: "Start Zhihu URL image upload",
			metadata: {
				endpoint: ZHIHU_URL_IMAGE_UPLOAD_ENDPOINT,
				imageUrl: normalized,
			},
		});

		const body = new URLSearchParams({
			url: normalized,
			source: "article",
		});

		const response = await this.fetchPlatform(ZHIHU_URL_IMAGE_UPLOAD_ENDPOINT, {
			method: "POST",
			headers: this.buildZhihuBrowserHeaders({
				"x-requested-with": "fetch",
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			}),
			body: body.toString(),
		});

		const text = await response.text();
		if (!response.ok) {
			throw new Error(`Zhihu URL image upload failed with HTTP ${response.status}`);
		}

		const payload = this.tryParseJson(text) as ZhihuUploadedImageByUrlResponse | null;
		const uploaded = this.normalizeImageUrl(payload?.src ?? "");
		if (!uploaded) {
			throw new Error("Zhihu URL image upload returned an invalid payload");
		}

		await this.tracePublish({
			stage: "zhihu_upload_by_url_done",
			message: "Zhihu URL image upload done",
			metadata: {
				source: normalized,
				uploadedUrl: uploaded,
			},
		});

		return uploaded;
	}

	private async calculateImageMd5(blob: Blob): Promise<string> {
		const buffer = await blob.arrayBuffer();
		return md5(buffer);
	}

	private async requestImageUploadToken(imageHash: string): Promise<ZhihuImageTokenResponse> {
		const response = await this.fetchPlatform(ZHIHU_IMAGE_TOKEN_ENDPOINT, {
			method: "POST",
			headers: this.buildZhihuBrowserHeaders({
				"Content-Type": "application/json",
			}),
			body: JSON.stringify({
				image_hash: imageHash,
				source: "article",
			}),
		});

		const text = await response.text();
		if (!response.ok) {
			throw new Error(`Zhihu image token request failed with HTTP ${response.status}`);
		}

		const payload = this.tryParseJson(text) as ZhihuImageTokenResponse | null;
		const uploadFile = payload?.upload_file;
		const hasReusableImage = Boolean(uploadFile?.state === 1 && uploadFile?.image_id);
		const hasUploadCredentials = Boolean(
			uploadFile?.object_key &&
			payload?.upload_token?.access_id &&
			payload?.upload_token?.access_key &&
			payload?.upload_token?.access_token,
		);
		if (!uploadFile || (!hasReusableImage && !hasUploadCredentials)) {
			throw new Error("Zhihu image token response is incomplete");
		}

		return payload;
	}

	private async waitForImageReady(imageId: string): Promise<ZhihuImageDetailResponse> {
		for (let attempt = 0; attempt < 20; attempt++) {
			const response = await this.fetchPlatform(`${ZHIHU_IMAGE_DETAIL_ENDPOINT}/${imageId}`, {
				method: "GET",
				headers: this.buildZhihuBrowserHeaders(),
			});

			if (response.ok) {
				const payload = (await response.json()) as ZhihuImageDetailResponse;
				if (payload.original_hash) {
					return payload;
				}
			}

			await randomDelay(900, 1300);
		}

		throw new Error(`Zhihu image processing timeout for image_id=${imageId}`);
	}

	private buildZhihuImageUrl(objectKey: string, mimeType?: string): string {
		let finalKey = objectKey;
		if (mimeType === "image/gif" && !/\.gif$/i.test(finalKey)) {
			finalKey += ".gif";
		} else if (!/\.(?:jpe?g|png|webp|gif)$/i.test(finalKey) && !/_[a-z]\.jpg$/i.test(finalKey)) {
			finalKey += "_r.jpg";
		}
		return `https://pic4.zhimg.com/${finalKey}`;
	}

	private async hmacSha1Base64(key: string, message: string): Promise<string> {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(key);
		const messageData = encoder.encode(message);
		const cryptoKey = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
		const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
		return btoa(String.fromCharCode(...new Uint8Array(signature)));
	}

	private async uploadBlobToZhihuOss(
		objectKey: string,
		blob: Blob,
		token: { access_id: string; access_key: string; access_token: string },
	): Promise<void> {
		const contentType = blob.type || "application/octet-stream";
		const ossDate = new Date().toUTCString();
		const canonicalHeaders: Record<string, string> = {
			"x-oss-date": ossDate,
			"x-oss-security-token": token.access_token,
			"x-oss-user-agent": ZHIHU_OSS_USER_AGENT,
		};
		const canonicalizedHeaderString = Object.keys(canonicalHeaders)
			.sort()
			.map((key) => `${key}:${canonicalHeaders[key]}`)
			.join("\n");
		const stringToSign = `PUT\n\n${contentType}\n${ossDate}\n${canonicalizedHeaderString}\n/${ZHIHU_OSS_BUCKET}/${objectKey}`;
		const signature = await this.hmacSha1Base64(token.access_key, stringToSign);
		const authorization = `OSS ${token.access_id}:${signature}`;

		const response = await this.fetchPlatform(`${ZHIHU_OSS_UPLOAD_ENDPOINT}/${objectKey}`, {
			method: "PUT",
			headers: {
				"Content-Type": contentType,
				Authorization: authorization,
				"x-oss-date": ossDate,
				"x-oss-security-token": token.access_token,
				"x-oss-user-agent": ZHIHU_OSS_USER_AGENT,
				origin: "https://zhuanlan.zhihu.com",
				referer: "https://zhuanlan.zhihu.com/",
			},
			body: blob,
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Zhihu OSS upload failed (${response.status}): ${text.slice(0, 200)}`);
		}
	}

	private async uploadImageBlobToZhihu(blob: Blob, filename: string): Promise<string> {
		void filename;
		await this.tracePublish({
			stage: "zhihu_upload_blob_start",
			message: "Start Zhihu binary image upload",
			metadata: {
				size: blob.size,
				mimeType: blob.type || "application/octet-stream",
			},
		});

		const imageHash = await this.calculateImageMd5(blob);
		const tokenData = await this.requestImageUploadToken(imageHash);
		const uploadFile = tokenData.upload_file;
		if (!uploadFile) {
			throw new Error("Zhihu image token response missing upload_file");
		}

		if (uploadFile.state === 1 && uploadFile.image_id) {
			try {
				const readyImage = await this.waitForImageReady(uploadFile.image_id);
				if (readyImage.original_hash) {
					const reusedUrl = this.buildZhihuImageUrl(readyImage.original_hash, blob.type);
					await this.tracePublish({
						stage: "zhihu_upload_blob_reused",
						message: "Zhihu image hash already exists",
						metadata: {
							imageId: uploadFile.image_id,
							uploadedUrl: reusedUrl,
						},
					});
					return reusedUrl;
				}
			} catch {
				if (uploadFile.object_key) {
					const fallbackUrl = this.buildZhihuImageUrl(uploadFile.object_key, blob.type);
					await this.tracePublish({
						stage: "zhihu_upload_blob_reused_fallback",
						level: "warn",
						message: "Reuse check failed, use object key fallback",
						metadata: {
							objectKey: uploadFile.object_key,
							uploadedUrl: fallbackUrl,
						},
					});
					return fallbackUrl;
				}
				throw new Error(`Zhihu image reuse check failed and object_key is missing: image_id=${uploadFile.image_id}`);
			}
		}

		const uploadToken = tokenData.upload_token;
		if (
			!uploadFile.object_key ||
			!uploadToken?.access_id ||
			!uploadToken?.access_key ||
			!uploadToken?.access_token
		) {
			throw new Error("Zhihu image token response missing upload credentials");
		}
		const objectKey = uploadFile.object_key;

		await this.uploadBlobToZhihuOss(objectKey, blob, {
			access_id: uploadToken.access_id,
			access_key: uploadToken.access_key,
			access_token: uploadToken.access_token,
		});

		if (uploadFile.image_id) {
			try {
				const readyImage = await this.waitForImageReady(uploadFile.image_id);
				if (readyImage.original_hash) {
					const uploadedUrl = this.buildZhihuImageUrl(readyImage.original_hash, blob.type);
					await this.tracePublish({
						stage: "zhihu_upload_blob_done",
						message: "Zhihu binary upload completed",
						metadata: {
							imageId: uploadFile.image_id,
							uploadedUrl,
						},
					});
					return uploadedUrl;
				}
			} catch {
				// keep fallback below
			}
		}

		const fallbackUrl = this.buildZhihuImageUrl(objectKey, blob.type);
		await this.tracePublish({
			stage: "zhihu_upload_blob_fallback",
			level: "warn",
			message: "Zhihu binary upload finished with object key fallback",
			metadata: {
				objectKey,
				uploadedUrl: fallbackUrl,
			},
		});
		return fallbackUrl;
	}

	private async uploadImageSourceToZhihu(source: string): Promise<string> {
		const normalized = this.normalizeImageUrl(source);
		if (!normalized) throw this.invalidImageSource(source, "Zhihu image upload");
		if (!normalized.startsWith("data:") && this.isZhihuHostedImage(normalized)) {
			await this.verifyExistingPlatformImage(normalized, {
				referer: "https://zhuanlan.zhihu.com/",
			});
			return normalized;
		}
		const cached = this.imageUrlCache.get(normalized);
		if (cached) return cached;

		const image = await this.resolveSourceImage(normalized, {
			referer: "https://zhuanlan.zhihu.com/",
		});
		const filename = this.guessFileName(normalized.startsWith("data:") ? "inline-image" : normalized, image.mimeType);
		const uploadedUrl = await this.withPlatformImageUploadRetry({
			source: normalized,
			upload: async (attempt) => {
				if (!normalized.startsWith("data:") && attempt <= 2) {
					return await this.uploadImageBySourceUrlToZhihu(image.effectiveUrl);
				}
				return await this.uploadImageBlobToZhihu(image.blob, filename);
			},
			getUploadedUrl: (url) => url,
			isExpectedPlatformUrl: (url) => this.isZhihuHostedImage(url),
			verificationHeaders: {
				accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
				cookie: this.authToken,
				referer: "https://zhuanlan.zhihu.com/",
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
				"sec-fetch-dest": "image",
				"sec-fetch-mode": "no-cors",
				"sec-fetch-site": "cross-site",
			},
		});
		this.imageUrlCache.set(normalized, uploadedUrl);
		return uploadedUrl;
	}

	private async replaceHtmlImageUrls(htmlContent: string): Promise<string> {
		const imageSources = this.extractImageUrlsFromHtmlContent(htmlContent);
		if (imageSources.length === 0) {
			return htmlContent;
		}

		await this.tracePublish({
			stage: "zhihu_replace_images_start",
			message: "Start replacing HTML image URLs",
			metadata: { imageCount: imageSources.length },
		});

		for (const originalSrc of imageSources) {
			const normalized = this.normalizeImageUrl(originalSrc);
			if (!normalized) throw this.invalidImageSource(originalSrc, "Zhihu article content");
			if (!normalized.startsWith("data:") && this.isZhihuHostedImage(normalized)) {
				await this.verifyExistingPlatformImage(normalized, { referer: "https://zhuanlan.zhihu.com/" });
				continue;
			}
			if (this.imageUrlCache.has(normalized)) {
				continue;
			}

			const uploadedUrl = await this.uploadImageSourceToZhihu(normalized);
			await this.tracePublish({
				stage: "zhihu_replace_single_image_done",
				message: "Replace one image URL",
				metadata: { source: normalized, uploadedUrl },
			});
			await randomDelay(200, 500);
		}
		this.assertImageSourcesResolved({
			sources: imageSources,
			normalize: (source) => this.normalizeImageUrl(source),
			isPlatformHosted: (source) => this.isZhihuHostedImage(source),
			resolved: this.imageUrlCache,
			context: "Zhihu article content",
		});

		const replaced = this.replaceHtmlImageUrlsByMap(
			htmlContent,
			(rawUrl) => this.normalizeImageUrl(rawUrl),
			this.imageUrlCache,
		);
		this.assertFinalImageSources({
			sources: this.extractImageUrlsFromHtmlContent(replaced),
			normalize: (source) => this.normalizeImageUrl(source),
			isPlatformHosted: (source) => this.isZhihuHostedImage(source),
			context: "Zhihu final HTML",
		});

		await this.tracePublish({
			stage: "zhihu_replace_images_done",
			message: "Finish replacing HTML image URLs",
			metadata: {
				replacedCount: this.imageUrlCache.size,
				htmlLength: replaced.length,
			},
		});

		return replaced;
	}

	private highlightHtmlCodeBlocks(htmlContent: string): string {
		return highlightHtmlPreCodeBlocksWithHighlightJs(htmlContent, {
			addHljsClass: true,
			preserveExistingCodeClasses: true,
			inlineTokenStyles: false,
			autoDetectLanguages: FRONTEND_AUTO_DETECT_LANGUAGES,
		});
	}

	private async resolveArticleHtml(article: SharedArticle): Promise<string> {
		await this.tracePublish({
			stage: "zhihu_resolve_html_start",
			message: "Start resolving article HTML",
			metadata: {
				hasExistingHtml: Boolean(article.htmlContent?.trim()),
				contentLength: article.content?.length ?? 0,
				mode: "zhihu_document_convert_forced",
			},
		});

		const markdownContent = applyMarkdownContentSlots(article.content ?? "", article);
		const htmlContent = await this.convertMarkdownToHtmlViaAPI(markdownContent);

		if (!htmlContent) {
			throw new Error("无法生成知乎发布 HTML 内容");
		}

		const highlightedHtml = this.highlightHtmlCodeBlocks(htmlContent);
		const finalHtml = await this.replaceHtmlImageUrls(highlightedHtml);
		await this.tracePublish({
			stage: "zhihu_resolve_html_done",
			message: "Article HTML resolved",
			metadata: {
				htmlLength: finalHtml.length,
				cachedImageCount: this.imageUrlCache.size,
			},
		});
		return finalHtml;
	}

	private async resolveTitleImage(article: SharedArticle): Promise<string | undefined> {
		const coverImage = article.coverImage?.trim();
		if (!coverImage) {
			return undefined;
		}

		const normalized = this.normalizeImageUrl(coverImage);
		if (!normalized) {
			throw this.invalidImageSource(coverImage, "Zhihu title image");
		}

		if (!normalized.startsWith("data:") && this.isZhihuHostedImage(normalized)) {
			await this.verifyExistingPlatformImage(normalized, { referer: "https://zhuanlan.zhihu.com/" });
			await this.tracePublish({
				stage: "zhihu_title_image_reused",
				message: "Article cover image is already hosted on Zhihu",
				metadata: {
					titleImage: normalized,
				},
			});
			return normalized;
		}

		await this.tracePublish({
			stage: "zhihu_title_image_start",
			message: "Start uploading article cover image for titleImage",
			metadata: {
				source: normalized,
			},
		});

		const uploadedUrl = await this.uploadImageSourceToZhihu(normalized);
		await this.tracePublish({
			stage: "zhihu_title_image_done",
			message: "Article cover image uploaded for titleImage",
			metadata: { source: normalized, titleImage: uploadedUrl },
		});
		return uploadedUrl;
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "zhihu_article_draft_start",
				message: "Start creating Zhihu draft",
				metadata: {
					titleLength: article.title.length,
					contentLength: article.content.length,
					hasCoverImage: Boolean(article.coverImage?.trim()),
				},
			});

			const htmlContent = await this.resolveArticleHtml(article);
			const titleImage = await this.resolveTitleImage(article);

			const data = await this.request<{ id: string; title: string; content: string; url: string; created: number }>(
				"https://zhuanlan.zhihu.com/api/articles/drafts",
				{
					method: "POST",
					headers: {
						cookie: this.authToken,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						content: htmlContent,
						title: article.title,
						table_of_contents: false,
						delta_time: 0,
						can_reward: true,
						titleImage,
					}),
				},
			);

			console.log("Zhihu draft creation response:", data);

			const draft = {
				id: data.id,
				title: data.title,
				content: data.content,
				htmlContent,
				url: data.url,
				createdAt: data.created,
			};
			this.draftHtmlContentCache.set(draft.id, htmlContent);
			await this.tracePublish({
				stage: "zhihu_article_draft_done",
				message: "Zhihu draft created",
				metadata: { draftId: draft.id, draftUrl: draft.url, titleImage: titleImage ?? null },
			});
			return draft;
		} catch (error) {
			await this.tracePublish({
				stage: "zhihu_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Zhihu draft creation failed",
			});
			throw (error instanceof Error ? error : new Error(String(error)));
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId;
		try {
			await this.tracePublish({
				stage: "zhihu_article_publish_start",
				message: "Start publishing Zhihu article",
				metadata: {
					draftId: draftId ?? null,
					titleLength: article.title.length,
					hasPayloadHtmlContent: Boolean(article.htmlContent?.trim()),
				},
			});

			if (!draftId) {
				return {
					success: false,
					message: "发布失败：缺少 draftId",
				};
			}

			let htmlContent = article.htmlContent?.trim();
			if (!htmlContent) {
				htmlContent = this.draftHtmlContentCache.get(draftId);
			}

			if (htmlContent) {
				await this.tracePublish({
					stage: "zhihu_resolve_html_reused",
					message: "Reuse prepared HTML content",
					metadata: {
						draftId,
						htmlLength: htmlContent.length,
					},
				});
			} else {
				htmlContent = await this.resolveArticleHtml(article);
			}

			const pcBusinessParams = {
				commentPermission: "anyone",
				disclaimer_type: "none",
				disclaimer_status: "close",
				table_of_contents_enabled: false,
				content: htmlContent,
				title: article.title,
				commercial_report_info: {
					commercial_types: [],
				},
				commercial_zhitask_bind_info: null,
				canReward: true,
			};

			const data = await this.request<ZhihuPublishResponse>(
				"https://www.zhihu.com/api/v4/content/publish",
				{
					method: "POST",
					headers: {
						cookie: this.authToken,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						action: "article",
						data: {
							publish: {
								traceId: `${Date.now()},${crypto.randomUUID()}`,
							},
							extra_info: {
								publisher: "pc",
								pc_business_params: JSON.stringify(pcBusinessParams),
							},
							draft: {
								disabled: 1,
								id: draftId,
								isPublished: false,
							},
							commentsPermission: {
								comment_permission: "anyone",
							},
							creationStatement: {
								disclaimer_type: "none",
								disclaimer_status: "close",
							},
							contentsTables: {
								table_of_contents_enabled: false,
							},
							commercialReportInfo: {
								isReport: 0,
							},
							appreciate: {
								can_reward: true,
								tagline: "Thanks for your support",
							},
							hybridInfo: {},
							hybrid: {
								html: htmlContent,
								textLength: htmlContent.length,
							},
							title: {
								title: article.title,
							},
						},
					}),
				},
			);

			const publishIdResult = this.extractPublishIdFromResponse(data);
			const publishId = publishIdResult.publishId;

			if (!publishId) {
				console.error("Zhihu publish response missing publish.id:", data);
				const rootRecord = this.toRecord(data);
				const dataRecord = this.toRecord(rootRecord?.data);
				const resultPreview =
					typeof dataRecord?.result === "string"
						? dataRecord.result.slice(0, 220)
						: undefined;
				await this.tracePublish({
					stage: "zhihu_article_publish_unexpected_response",
					level: "warn",
					message: "Zhihu publish response missing article id",
					metadata: {
						responseKeys: rootRecord ? Object.keys(rootRecord) : [],
						dataKeys: dataRecord ? Object.keys(dataRecord) : [],
						resultType: typeof dataRecord?.result,
						resultPreview,
					},
				});
				return {
					success: false,
					message: "发布请求已发送，但知乎返回了非预期响应（缺少文章 ID）。请在知乎后台确认是否发布成功。",
				};
			}

			await this.tracePublish({
				stage: "zhihu_article_publish_done",
				message: "Zhihu article published",
				metadata: {
					publishId,
					publishIdSource: publishIdResult.source,
					url: `https://zhuanlan.zhihu.com/p/${publishId}`,
				},
			});

			return {
				success: true,
				articleId: publishId,
				message: "发布成功",
				url: `https://zhuanlan.zhihu.com/p/${publishId}`,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "zhihu_article_publish_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Zhihu publish failed",
			});
			return {
				success: false,
				message: error instanceof Error ? error.message : "发布失败",
			};
		} finally {
			if (draftId) {
				this.draftHtmlContentCache.delete(draftId);
			}
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return { success: false, message: "暂不支持删除文章" };
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		try {
			const data = await this.request<{ data: Array<{ id: string; title: string; content: string; created: number }> }>(
				`https://www.zhihu.com/api/v4/articles?page=${page}&per_page=${pageSize}`,
			);

			return data.data.map((item) => ({
				id: item.id,
				title: item.title,
				content: item.content,
				publishedAt: item.created,
				status: "published" as const,
			}));
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const data = await this.request<{ id: string; title: string; content: string; created: number }>(
				`https://www.zhihu.com/api/v4/articles/${articleId}`,
			);

			return {
				id: data.id,
				title: data.title,
				content: data.content,
				publishedAt: data.created,
				status: "published",
			};
		} catch {
			return null;
		}
	}

	async articleTags(articleId: string): Promise<string[]> {
		void articleId;
		return [];
	}

	async imageUpload(imageData: string, filename = "image.jpg"): Promise<ImageUploadResult> {
		try {
			if (!imageData?.trim()) return { success: false, message: "Image data is empty" };
			const normalized = this.normalizeImageUrl(imageData);
			if (normalized) {
				const url = await this.uploadImageSourceToZhihu(normalized);
				return { success: true, url, message: "Zhihu image uploaded" };
			}
			const bytes = Uint8Array.from(atob(imageData), (character) => character.charCodeAt(0));
			const blob = new Blob([bytes], { type: "image/jpeg" });
			const url = await this.withPlatformImageUploadRetry({
				source: "data:image/jpeg;base64",
				upload: async () => await this.uploadImageBlobToZhihu(blob, filename),
				getUploadedUrl: (uploadedUrl) => uploadedUrl,
				isExpectedPlatformUrl: (uploadedUrl) => this.isZhihuHostedImage(uploadedUrl),
			});
			return { success: true, url, message: "Zhihu image uploaded" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "Zhihu image upload failed" };
		}
	}

}

registerAccountService("zhihu", ZhihuAccountService);

