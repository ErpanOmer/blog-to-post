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
const IMAGE_SRC_REGEX = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const md5 = md5Lib as unknown as (message: string | ArrayBuffer | Uint8Array) => string;

export default class ZhihuAccountService extends AbstractAccountService {
	private imageUrlCache = new Map<string, string>();

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

			const response = await fetch("https://www.zhihu.com/api/v4/document/convert", {
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

	private extractImageUrlsFromHtml(htmlContent: string): string[] {
		const urls = new Set<string>();
		let match: RegExpExecArray | null;
		while ((match = IMAGE_SRC_REGEX.exec(htmlContent)) !== null) {
			if (match[1]) {
				urls.add(match[1]);
			}
		}
		return [...urls];
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

	private async downloadImageFromUrl(imageUrl: string): Promise<{ blob: Blob; filename: string }> {
		const normalized = this.normalizeImageUrl(imageUrl);
		if (!normalized || normalized.startsWith("data:")) {
			throw new Error(`Unsupported image URL: ${imageUrl}`);
		}

		const response = await fetch(normalized, {
			method: "GET",
			headers: {
				accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
				referer: "https://zhuanlan.zhihu.com/",
				"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			},
		});

		if (!response.ok) {
			throw new Error(`Image download failed (${response.status}): ${normalized}`);
		}

		const contentTypeHeader = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
		if (!contentTypeHeader.startsWith("image/") && contentTypeHeader !== "application/octet-stream") {
			throw new Error(`Resource is not an image: ${normalized} (${contentTypeHeader})`);
		}

		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer], {
			type: contentTypeHeader === "application/octet-stream" ? "image/jpeg" : contentTypeHeader,
		});
		const filename = this.guessFileName(normalized, blob.type || contentTypeHeader);

		return { blob, filename };
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

		const response = await fetch(ZHIHU_URL_IMAGE_UPLOAD_ENDPOINT, {
			method: "POST",
			headers: this.buildZhihuBrowserHeaders({
				"x-requested-with": "fetch",
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
			}),
			body: body.toString(),
		});

		const text = await response.text();
		if (!response.ok) {
			throw new Error(`Zhihu URL image upload failed (${response.status}): ${text.slice(0, 200)}`);
		}

		const payload = this.tryParseJson(text) as ZhihuUploadedImageByUrlResponse | null;
		const uploaded = this.normalizeImageUrl(payload?.src ?? "");
		if (!uploaded) {
			throw new Error(`Zhihu URL image upload returned unexpected payload: ${text.slice(0, 200)}`);
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
		const response = await fetch(ZHIHU_IMAGE_TOKEN_ENDPOINT, {
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
			throw new Error(`Zhihu image token request failed (${response.status}): ${text.slice(0, 200)}`);
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
			throw new Error(`Zhihu image token payload is invalid: ${text.slice(0, 200)}`);
		}

		return payload;
	}

	private async waitForImageReady(imageId: string): Promise<ZhihuImageDetailResponse> {
		for (let attempt = 0; attempt < 20; attempt++) {
			const response = await fetch(`${ZHIHU_IMAGE_DETAIL_ENDPOINT}/${imageId}`, {
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

		const response = await fetch(`${ZHIHU_OSS_UPLOAD_ENDPOINT}/${objectKey}`, {
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

	private async uploadImageBlobToZhihu(blob: Blob, _filename: string): Promise<string> {
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

	private async replaceHtmlImageUrls(htmlContent: string): Promise<string> {
		const imageSources = this.extractImageUrlsFromHtml(htmlContent);
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
			if (!normalized) {
				continue;
			}
			if (!normalized.startsWith("data:") && this.isZhihuHostedImage(normalized)) {
				continue;
			}
			if (this.imageUrlCache.has(normalized)) {
				continue;
			}

			try {
				let uploadedUrl: string;

				if (normalized.startsWith("data:")) {
					const blob = this.dataUriToBlob(normalized);
					const generatedName = this.guessFileName("inline-image", blob.type || "image/jpeg");
					uploadedUrl = await this.uploadImageBlobToZhihu(blob, generatedName);
				} else {
					try {
						uploadedUrl = await this.uploadImageBySourceUrlToZhihu(normalized);
					} catch (urlUploadError) {
						console.warn(`Zhihu URL image upload failed, fallback to binary upload: ${normalized}`, urlUploadError);
						const { blob, filename } = await this.downloadImageFromUrl(normalized);
						uploadedUrl = await this.uploadImageBlobToZhihu(blob, filename);
					}
				}

				this.imageUrlCache.set(normalized, uploadedUrl);
				await this.tracePublish({
					stage: "zhihu_replace_single_image_done",
					message: "Replace one image URL",
					metadata: {
						source: normalized,
						uploadedUrl,
					},
				});
				await randomDelay(200, 500);
			} catch (error) {
				console.warn(`Zhihu image upload failed, keep original image: ${originalSrc}`, error);
				await this.tracePublish({
					stage: "zhihu_replace_single_image_failed",
					level: "warn",
					message: "Replace one image URL failed, keep original",
					metadata: {
						source: originalSrc,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
			}
		}

		const replaced = htmlContent.replace(
			/(<img\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
			(fullMatch, prefix: string, src: string, suffix: string) => {
				const normalized = this.normalizeImageUrl(src);
				if (!normalized) return fullMatch;
				const replacement = this.imageUrlCache.get(normalized);
				if (!replacement) return fullMatch;
				return `${prefix}${replacement}${suffix}`;
			},
		);

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

		const htmlContent = await this.convertMarkdownToHtmlViaAPI(article.content);

		if (!htmlContent) {
			throw new Error("无法生成知乎发布 HTML 内容");
		}

		const finalHtml = await this.replaceHtmlImageUrls(htmlContent);
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
			await this.tracePublish({
				stage: "zhihu_title_image_invalid",
				level: "warn",
				message: "Article cover image URL is invalid, skip titleImage",
				metadata: {
					coverImage,
				},
			});
			return undefined;
		}

		if (!normalized.startsWith("data:") && this.isZhihuHostedImage(normalized)) {
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

		try {
			let uploadedUrl: string;

			if (normalized.startsWith("data:")) {
				const blob = this.dataUriToBlob(normalized);
				const generatedName = this.guessFileName("article-cover", blob.type || "image/jpeg");
				uploadedUrl = await this.uploadImageBlobToZhihu(blob, generatedName);
			} else {
				try {
					uploadedUrl = await this.uploadImageBySourceUrlToZhihu(normalized);
				} catch (urlUploadError) {
					console.warn(`Zhihu title image URL upload failed, fallback to binary upload: ${normalized}`, urlUploadError);
					const { blob, filename } = await this.downloadImageFromUrl(normalized);
					uploadedUrl = await this.uploadImageBlobToZhihu(blob, filename);
				}
			}

			this.imageUrlCache.set(normalized, uploadedUrl);
			await this.tracePublish({
				stage: "zhihu_title_image_done",
				message: "Article cover image uploaded for titleImage",
				metadata: {
					source: normalized,
					titleImage: uploadedUrl,
				},
			});
			return uploadedUrl;
		} catch (error) {
			await this.tracePublish({
				stage: "zhihu_title_image_failed",
				level: "warn",
				message: "Article cover image upload failed, continue without titleImage",
				metadata: {
					source: normalized,
					error: error instanceof Error ? error.message : "unknown",
				},
			});
			return undefined;
		}
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
				url: data.url,
				createdAt: data.created,
			};
			await this.tracePublish({
				stage: "zhihu_article_draft_done",
				message: "Zhihu draft created",
				metadata: { draftId: draft.id, draftUrl: draft.url, titleImage: titleImage ?? null },
			});
			return draft;
		} catch (error) {
			console.error("Zhihu draft creation failed:", error);
			await this.tracePublish({
				stage: "zhihu_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "Zhihu draft creation failed",
			});
			return null;
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		try {
			await this.tracePublish({
				stage: "zhihu_article_publish_start",
				message: "Start publishing Zhihu article",
				metadata: {
					draftId: article.draftId ?? null,
					titleLength: article.title.length,
				},
			});

			if (!article.draftId) {
				return {
					success: false,
					message: "发布失败：缺少 draftId",
				};
			}

			const htmlContent = await this.resolveArticleHtml(article);

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
								id: article.draftId,
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

	private dataUriToBlob(dataUri: string): Blob {
		const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
		if (!match) {
			throw new Error("Invalid data URI image payload");
		}

		const mimeType = match[1] || "image/jpeg";
		const binary = atob(match[2]);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}

		return new Blob([bytes], { type: mimeType });
	}

	async imageUpload(imageData: string, filename = "image.jpg"): Promise<ImageUploadResult> {
		try {
			if (!imageData?.trim()) {
				return { success: false, message: "图片数据为空" };
			}

			const normalizedInput = this.normalizeImageUrl(imageData);
			if (normalizedInput && !normalizedInput.startsWith("data:")) {
				if (this.isZhihuHostedImage(normalizedInput)) {
					return { success: true, url: normalizedInput, message: "上传成功" };
				}
				try {
					const uploadedByUrl = await this.uploadImageBySourceUrlToZhihu(normalizedInput);
					return { success: true, url: uploadedByUrl, message: "上传成功" };
				} catch (urlUploadError) {
					console.warn(`Zhihu URL image upload failed, fallback to binary upload: ${normalizedInput}`, urlUploadError);
					const downloaded = await this.downloadImageFromUrl(normalizedInput);
					const uploadedUrl = await this.uploadImageBlobToZhihu(downloaded.blob, downloaded.filename);
					return { success: true, url: uploadedUrl, message: "上传成功" };
				}
			}

			let blob: Blob;
			let finalFilename = filename;

			if (normalizedInput?.startsWith("data:")) {
				blob = this.dataUriToBlob(normalizedInput);
				finalFilename = this.guessFileName(finalFilename, blob.type || "image/jpeg");
			} else {
				const binary = atob(imageData);
				const bytes = new Uint8Array(binary.length);
				for (let i = 0; i < binary.length; i++) {
					bytes[i] = binary.charCodeAt(i);
				}
				blob = new Blob([bytes], { type: "image/jpeg" });
				finalFilename = this.guessFileName(finalFilename, "image/jpeg");
			}

			const uploadedUrl = await this.uploadImageBlobToZhihu(blob, finalFilename);
			return { success: true, url: uploadedUrl, message: "上传成功" };
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "上传失败",
			};
		}
	}
}

registerAccountService("zhihu", ZhihuAccountService);

