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
} from "@/worker/accounts/index";
import type { Article as SharedArticle } from "@/shared/types";
import { marked } from "marked";
import { randomDelay } from "@/worker/utils/helpers";

interface WechatSessionMeta {
	token: string;
	userName: string;
	nickName: string;
	ticket: string;
	svrTime: number;
	avatar?: string;
}

interface WechatDraftRequest {
	title: string;
	htmlContent: string;
	digest: string;
	appMsgId?: string;
	cover?: WechatCoverAsset | null;
}

interface WechatUploadedImage {
	url: string;
	fileId: string | null;
	cdnUrl235: string | null;
	cdnUrl11: string | null;
	cdnUrlBack: string | null;
}

interface WechatCoverAsset {
	fileId: string | null;
	cdnUrl: string;
	cdnUrl235: string;
	cdnUrl11: string;
	cdnUrlBack: string;
}

const WECHAT_MP_BASE_URL = "https://mp.weixin.qq.com";
const WECHAT_MP_HOME_URL = `${WECHAT_MP_BASE_URL}/`;
const WECHAT_MP_OPERATE_APPMSG_URL = `${WECHAT_MP_BASE_URL}/cgi-bin/operate_appmsg`;
const WECHAT_MP_FILETRANSFER_URL = `${WECHAT_MP_BASE_URL}/cgi-bin/filetransfer`;
const WECHAT_REFERER = `${WECHAT_MP_BASE_URL}/`;
const WECHAT_INLINE_CSS: Record<string, string> = {
	p: "color:rgb(51,51,51);font-size:15px;line-height:1.75em;margin:0 0 1em 0;",
	h1: "font-size:1.25em;line-height:1.4em;font-weight:700;margin:1em 0 0.5em 0;",
	h2: "font-size:1.125em;font-weight:700;margin:2em 0 0.5em 0;",
	h3: "font-size:1.05em;font-weight:700;margin:1.8em 0 0.4em 0;",
	h4: "font-size:1em;font-weight:700;margin:0.8em 0 0.4em 0;",
	h5: "font-size:1em;font-weight:700;margin:0.8em 0 0.4em 0;",
	h6: "font-size:1em;font-weight:700;margin:0.8em 0 0.4em 0;",
	ul: "margin:1em 0;padding-left:2em;",
	ol: "margin:1em 0;padding-left:2em;",
	li: "margin-bottom:0.4em;",
	pre: "font-family:monospace;white-space:pre;line-height:1.6em;margin:1em 0;padding:12px;border-radius:6px;background:#f5f7fa;overflow:auto;",
	code: "font-family:monospace;background:#f5f7fa;padding:0.12em 0.32em;border-radius:4px;",
	tt: "font-family:monospace;",
	kbd: "font-family:monospace;",
	samp: "font-family:monospace;",
	blockquote: "border-left:4px solid #ddd;padding-left:1em;margin:1em 0;color:#666;",
	hr: "border:none;border-top:1px solid #ddd;margin:1.5em 0;",
	img: "max-width:100%;height:auto;vertical-align:middle;",
	table: "border-collapse:collapse;width:100%;font-size:14px;margin:1em 0;",
	th: "border:1px solid #e5e7eb;padding:8px;background:#f8fafc;text-align:left;",
	td: "border:1px solid #e5e7eb;padding:8px;",
	a: "color:#576b95;text-decoration:none;",
	strong: "font-weight:bolder;",
	b: "font-weight:bolder;",
	em: "font-style:italic;",
	i: "font-style:italic;",
	cite: "font-style:italic;",
	var: "font-style:italic;",
	address: "font-style:italic;",
};

export default class WechatAccountService extends AbstractAccountService {
	private sessionMetaCache: WechatSessionMeta | null = null;
	private imageUrlCache = new Map<string, string>();
	private uploadedImageCache = new Map<string, WechatUploadedImage>();
	private draftHtmlContentCache = new Map<string, string>();
	private cookieHeader: string;

	constructor(authToken: string) {
		super("wechat", authToken);
		this.cookieHeader = this.normalizeCookieHeader(authToken);
	}

	protected buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			origin: WECHAT_MP_BASE_URL,
			referer: WECHAT_REFERER,
			accept: "*/*",
			"user-agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		};

		if (this.cookieHeader) {
			headers.cookie = this.cookieHeader;
		}

		return headers;
	}

	private normalizeCookieHeader(rawToken: string): string {
		if (!rawToken) return "";
		let token = rawToken.trim();
		token = token.replace(/^cookie\s*:/i, "").trim();
		token = token.replace(/\r?\n/g, ";");
		token = token.replace(/\s*;\s*/g, "; ");
		token = token.replace(/;{2,}/g, ";");
		return token.trim();
	}

	private tryParseJson(raw: string): unknown | null {
		if (!raw) return null;
		try {
			return JSON.parse(raw) as unknown;
		} catch {
			return null;
		}
	}

	private toRecord(value: unknown): Record<string, unknown> | null {
		if (!value || typeof value !== "object" || Array.isArray(value)) return null;
		return value as Record<string, unknown>;
	}

	private toNumber(value: unknown): number | null {
		if (typeof value === "number" && Number.isFinite(value)) return value;
		if (typeof value === "string" && value.trim()) {
			const parsed = Number.parseInt(value, 10);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	private toStringId(value: unknown): string | null {
		if (typeof value === "string" && value.trim()) return value.trim();
		const numeric = this.toNumber(value);
		if (numeric !== null) return String(numeric);
		return null;
	}

	private pickString(record: Record<string, unknown> | null, key: string): string | null {
		const value = record?.[key];
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed || null;
	}

	private pickId(record: Record<string, unknown> | null, key: string): string | null {
		return this.toStringId(record?.[key]);
	}

	private mergeCssStyle(existing: string, append: string): string {
		const normalizedExisting = existing.trim().replace(/;+\s*$/g, "");
		const normalizedAppend = append.trim().replace(/;+\s*$/g, "");
		if (!normalizedExisting) return `${normalizedAppend};`;
		if (!normalizedAppend) return `${normalizedExisting};`;
		return `${normalizedExisting};${normalizedAppend};`;
	}

	private injectStyleForTag(html: string, tagName: string, style: string): string {
		const regex = new RegExp(`<${tagName}(\\s[^>]*)?>`, "gi");
		return html.replace(regex, (_match, attrs: string | undefined) => {
			const attrText = attrs ?? "";
			const styleRegex = /style\s*=\s*(['"])(.*?)\1/i;
			if (styleRegex.test(attrText)) {
				const nextAttrs = attrText.replace(styleRegex, (_full, quote: string, existing: string) => {
					return `style=${quote}${this.mergeCssStyle(existing, style)}${quote}`;
				});
				return `<${tagName}${nextAttrs}>`;
			}
			return `<${tagName}${attrText} style="${style}">`;
		});
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
			const parsed = new URL(candidate);
			if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
				return null;
			}
			if (parsed.protocol === "http:") parsed.protocol = "https:";
			return parsed.toString();
		} catch {
			return null;
		}
	}

	private normalizeAvatarUrl(rawUrl: string | undefined): string | undefined {
		if (!rawUrl) return undefined;
		const normalized = this.normalizeImageUrl(rawUrl);
		return normalized ?? rawUrl;
	}

	private isWechatHostedImage(url: string): boolean {
		try {
			const hostname = new URL(url).hostname.toLowerCase();
			return hostname.includes("mmbiz.qpic.cn")
				|| hostname.includes("mmbiz.qlogo.cn")
				|| hostname.includes("mp.weixin.qq.com")
				|| hostname.includes("weixin.qq.com");
		} catch {
			return false;
		}
	}

	private dataUriToBlob(dataUri: string): Blob {
		const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUri);
		if (!match) {
			throw new Error("Invalid data URI payload");
		}
		const mimeType = match[1] || "image/jpeg";
		const binary = atob(match[2]);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return new Blob([bytes], { type: mimeType });
	}

	private async downloadImageFromUrl(url: string): Promise<Blob> {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
				referer: WECHAT_REFERER,
				"user-agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			},
		});
		if (!response.ok) {
			throw new Error(`Image download failed (${response.status}): ${url}`);
		}
		const blob = await response.blob();
		if (!blob.type.startsWith("image/") && blob.type !== "application/octet-stream") {
			throw new Error(`Resource is not an image: ${url}`);
		}
		return blob;
	}

	private guessImageSuffix(sourceUrl: string, mimeType: string): string {
		const typeMap: Record<string, string> = {
			"image/jpeg": "jpg",
			"image/jpg": "jpg",
			"image/png": "png",
			"image/gif": "gif",
			"image/webp": "webp",
			"image/bmp": "bmp",
			"image/svg+xml": "svg",
		};

		const normalizedMime = mimeType.toLowerCase();
		if (typeMap[normalizedMime]) return typeMap[normalizedMime];

		try {
			const parsed = new URL(sourceUrl);
			const suffix = parsed.pathname.split(".").pop()?.toLowerCase();
			if (suffix && ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(suffix)) {
				return suffix === "jpeg" ? "jpg" : suffix;
			}
		} catch {
			// ignore
		}

		return "jpg";
	}

	private isRetryableNetworkError(error: unknown): boolean {
		const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
		return (
			message.includes("network connection lost")
			|| message.includes("fetch failed")
			|| message.includes("request timeout")
			|| message.includes("timeout")
			|| message.includes("econnreset")
			|| message.includes("etimedout")
		);
	}

	private async withNetworkRetry<T>(
		stage: string,
		execute: () => Promise<T>,
		maxRetries = 2,
	): Promise<T> {
		let lastError: unknown;
		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				return await execute();
			} catch (error) {
				lastError = error;
				const shouldRetry = this.isRetryableNetworkError(error);
				const hasNext = attempt < maxRetries;
				if (!shouldRetry || !hasNext) break;

				await this.tracePublish({
					stage,
					level: "warn",
					message: "Transient network error detected, retrying request",
					metadata: {
						attempt: attempt + 1,
						nextAttempt: attempt + 2,
						error: error instanceof Error ? error.message : "unknown",
					},
				});

				await randomDelay(400 * (attempt + 1), 900 * (attempt + 1));
			}
		}

		throw (lastError instanceof Error ? lastError : new Error(String(lastError)));
	}

	private parseSessionMetaFromHomeHtml(html: string): WechatSessionMeta | null {
		if (!html) return null;

		const tokenMatch = html.match(/[?&]token=(\d{5,})/i)
			?? html.match(/data:\s*\{[\s\S]*?t:\s*["']([^"']+)["']/i)
			?? html.match(/["']token["']\s*:\s*["']?(\d{5,})["']?/i)
			?? html.match(/token:\s*["']?(\d{5,})["']?/i);
		const token = tokenMatch?.[1]?.trim();
		if (!token) {
			return null;
		}

		const ticket = html.match(/ticket:\s*["']([^"']+)["']/i)?.[1]?.trim() ?? "";
		const userName = html.match(/user_name:\s*["']([^"']+)["']/i)?.[1]?.trim() ?? "";
		const nickName = html.match(/nick_name:\s*["']([^"']+)["']/i)?.[1]?.trim() ?? "";
		const svrTime = Number.parseInt(
			html.match(/(?:svr_time|time):\s*["']?(\d{10})["']?/i)?.[1] ?? "",
			10,
		);

		const avatarRaw = html.match(/class="weui-desktop-account__thumb"[^>]*src="([^"]+)"/i)?.[1]
			?? html.match(/head_img:\s*['"]([^'"]+)['"]/i)?.[1]
			?? "";

		return {
			token,
			ticket,
			userName,
			nickName,
			svrTime: Number.isFinite(svrTime) && svrTime > 0 ? svrTime : Math.floor(Date.now() / 1000),
			avatar: this.normalizeAvatarUrl(avatarRaw),
		};
	}

	private async resolveSessionMeta(): Promise<WechatSessionMeta | null> {
		if (!this.cookieHeader) return null;

		const html = await this.withNetworkRetry(
			"wechat_fetch_home_retry",
			async () => await this.request<string>(WECHAT_MP_HOME_URL, {
				method: "GET",
				headers: {
					cookie: this.cookieHeader,
					accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				},
			}),
			2,
		);
		if (typeof html !== "string") return null;

		return this.parseSessionMetaFromHomeHtml(html);
	}

	private async ensureSessionMeta(): Promise<WechatSessionMeta> {
		if (this.sessionMetaCache) return this.sessionMetaCache;

		const meta = await this.resolveSessionMeta();
		if (!meta) {
			throw new Error(
				"微信公众号登录态无效，请提供 mp.weixin.qq.com 的完整 Cookie（包含 token 对应会话）。",
			);
		}

		this.sessionMetaCache = meta;
		return meta;
	}

	private toPlainTextFromHtml(html: string): string {
		return html
			.replace(/<style[\s\S]*?<\/style>/gi, " ")
			.replace(/<script[\s\S]*?<\/script>/gi, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	private resolveDigest(article: SharedArticle, htmlContent: string): string {
		const summary = article.summary?.trim();
		if (summary) return summary.slice(0, 120);

		const plain = this.toPlainTextFromHtml(htmlContent);
		if (!plain) return "";
		return plain.slice(0, 120);
	}

	private isLatexFormula(text: string): boolean {
		if (/[\\^_{}]/.test(text)) return true;
		if (/[α-ωΑ-Ω]/.test(text)) return true;
		if (/[∑∏∫∂∇∞≠≤≥±×÷√]/.test(text)) return true;
		return false;
	}

	private processLatex(content: string): string {
		const latexApi = "https://latex.codecogs.com/png.latex";

		let next = content.replace(/\$\$([^$]+)\$\$/g, (match, latex) => {
			if (!this.isLatexFormula(latex)) return match;
			const encoded = encodeURIComponent(latex.trim());
			return `<p style="text-align:center;"><img src="${latexApi}?\\dpi{150}${encoded}" alt="formula" style="vertical-align:middle;max-width:100%;"></p>`;
		});

		next = next.replace(/\$([^$]+)\$/g, (match, latex) => {
			if (!this.isLatexFormula(latex)) return match;
			const encoded = encodeURIComponent(latex.trim());
			return `<img src="${latexApi}?\\dpi{120}${encoded}" alt="formula" style="vertical-align:middle;">`;
		});

		return next;
	}

	private stripExternalLinks(content: string): string {
		return content.replace(
			/<a\s+[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
			(match, href: string, text: string) => {
				if (
					href
					&& (
						href.includes("mp.weixin.qq.com")
						|| href.includes("weixin.qq.com")
						|| href.startsWith("#")
						|| href.startsWith("javascript:")
					)
				) {
					return match;
				}
				return text;
			},
		);
	}

	private processHtmlForWechat(content: string): string {
		let html = `<section style="margin-left:6px;margin-right:6px;line-height:1.75em;">${content}</section>`;
		for (const [tagName, style] of Object.entries(WECHAT_INLINE_CSS)) {
			html = this.injectStyleForTag(html, tagName, style);
		}
		return html.replace(/>\s+</g, "><").trim();
	}

	private async resolveArticleHtml(article: SharedArticle): Promise<string> {
		let htmlContent = article.htmlContent?.trim() ?? "";
		if (!htmlContent) {
			const parsed = marked.parse(article.content ?? "");
			htmlContent = typeof parsed === "string" ? parsed : await parsed;
		}

		htmlContent = htmlContent.trim();
		if (!htmlContent) {
			throw new Error("Article content is empty, cannot publish to WeChat");
		}

		let processedHtml = this.processLatex(htmlContent);
		processedHtml = this.stripExternalLinks(processedHtml);

		const imageSources = this.collectImageUrlsFromMarkdownAndHtml(
			article.content ?? "",
			processedHtml,
		);
		await this.tracePublish({
			stage: "wechat_content_images_scan",
			message: "Scan content images for WeChat hosting",
			metadata: {
				totalImages: imageSources.length,
				hasHtmlContent: Boolean(article.htmlContent?.trim()),
			},
		});

		let uploadedCount = 0;
		for (const source of imageSources) {
			const normalized = this.normalizeImageUrl(source);
			if (!normalized) continue;
			if (!normalized.startsWith("data:") && this.isWechatHostedImage(normalized)) continue;
			if (this.imageUrlCache.has(normalized)) continue;

			try {
				const uploaded = await this.uploadImageBySourceUrlDetailed(normalized);
				this.imageUrlCache.set(normalized, uploaded.url);
				this.uploadedImageCache.set(normalized, uploaded);
				uploadedCount += 1;
				await randomDelay(120, 300);
			} catch (error) {
				await this.tracePublish({
					stage: "wechat_resolve_single_image_failed",
					level: "warn",
					message: "Image upload failed, keep original source",
					metadata: {
						source: normalized,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
			}
		}

		const replacedHtml = this.replaceHtmlImageUrlsByMap(
			processedHtml,
			(rawUrl) => this.normalizeImageUrl(rawUrl),
			this.imageUrlCache,
		);

		const finalHtml = this.processHtmlForWechat(replacedHtml);
		await this.tracePublish({
			stage: "wechat_content_css_inlined",
			message: "Apply WeChat inline styles",
			metadata: {
				imageCandidates: imageSources.length,
				uploadedImages: uploadedCount,
				finalHtmlLength: finalHtml.length,
			},
		});
		return finalHtml;
	}

	private buildCoverAsset(uploaded: WechatUploadedImage): WechatCoverAsset {
		return {
			fileId: uploaded.fileId,
			cdnUrl: uploaded.url,
			cdnUrl235: uploaded.cdnUrl235 ?? uploaded.url,
			cdnUrl11: uploaded.cdnUrl11 ?? uploaded.url,
			cdnUrlBack: uploaded.cdnUrlBack ?? uploaded.url,
		};
	}

	private extractUploadContentRecord(record: Record<string, unknown> | null): Record<string, unknown> | null {
		if (!record) return null;
		const contentValue = record.content;
		if (typeof contentValue === "string") {
			return this.toRecord(this.tryParseJson(contentValue));
		}
		return this.toRecord(contentValue);
	}

	private extractUploadFileId(record: Record<string, unknown> | null): string | null {
		const direct = this.pickId(record, "fileid")
			?? this.pickId(record, "file_id")
			?? this.pickId(record, "fileId");
		if (direct) return direct;

		const contentRecord = this.extractUploadContentRecord(record);
		const fileInfoRecord = this.toRecord(contentRecord?.file_info);
		const dataRecord = this.toRecord(contentRecord?.data);
		return this.pickId(contentRecord, "fileid")
			?? this.pickId(contentRecord, "file_id")
			?? this.pickId(contentRecord, "fileId")
			?? this.pickId(fileInfoRecord, "fileid")
			?? this.pickId(fileInfoRecord, "file_id")
			?? this.pickId(fileInfoRecord, "fileId")
			?? this.pickId(dataRecord, "fileid")
			?? this.pickId(dataRecord, "file_id")
			?? this.pickId(dataRecord, "fileId")
			?? null;

	}

	private pickUploadedImageField(
		record: Record<string, unknown> | null,
		contentRecord: Record<string, unknown> | null,
		key: string,
	): string | null {
		return this.normalizeImageUrl(
			this.pickString(record, key)
			?? this.pickString(contentRecord, key)
			?? "",
		);
	}

	private async resolveCoverImage(article: SharedArticle): Promise<WechatCoverAsset | null> {
		const rawCover = article.coverImage?.trim();
		if (!rawCover) {
			await this.tracePublish({
				stage: "wechat_cover_missing",
				message: "No cover image configured, skip cover setup",
			});
			return null;
		}

		const normalized = this.normalizeImageUrl(rawCover);
		if (!normalized) {
			throw new Error("Invalid cover image URL for WeChat");
		}

		await this.tracePublish({
			stage: "wechat_cover_resolve_start",
			message: "Start resolving WeChat cover image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const cached = this.uploadedImageCache.get(normalized);
		if (cached) {
			const cover = this.buildCoverAsset(cached);
			await this.tracePublish({
				stage: "wechat_cover_resolve_reused",
				message: "Reuse uploaded image as WeChat cover",
				metadata: {
					cdnUrl: cover.cdnUrl,
					fileId: cover.fileId,
				},
			});
			return cover;
		}

		const uploaded = await this.uploadImageBySourceUrlDetailed(normalized);
		this.uploadedImageCache.set(normalized, uploaded);
		this.imageUrlCache.set(normalized, uploaded.url);
		const cover = this.buildCoverAsset(uploaded);
		await this.tracePublish({
			stage: "wechat_cover_resolve_done",
			message: "WeChat cover image resolved",
			metadata: {
				cdnUrl: cover.cdnUrl,
				fileId: cover.fileId,
			},
		});
		return cover;
	}

	private buildDraftFormData(payload: WechatDraftRequest, token: string): URLSearchParams {
		const hasDigest = payload.digest.trim().length > 0;
		const cover = payload.cover ?? null;
		const hasCover = Boolean(cover?.cdnUrl);
		return new URLSearchParams({
			token,
			lang: "zh_CN",
			f: "json",
			ajax: "1",
			random: String(Math.random()),
			AppMsgId: payload.appMsgId ?? "",
			count: "1",
			data_seq: "0",
			operate_from: "Chrome",
			isnew: "0",
			ad_video_transition0: "",
			can_reward0: "0",
			related_video0: "",
			is_video_recommend0: "-1",
			title0: payload.title,
			author0: "ErpanOmer",
			writerid0: "0",
			fileid0: cover?.fileId ?? "",
			digest0: hasDigest ? payload.digest : "",
			auto_gen_digest0: hasDigest ? "0" : "1",
			content0: payload.htmlContent,
			sourceurl0: "",
			need_open_comment0: "1",
			only_fans_can_comment0: "0",
			cdn_url0: cover?.cdnUrl ?? "",
			cdn_235_1_url0: cover?.cdnUrl235 ?? "",
			cdn_1_1_url0: cover?.cdnUrl11 ?? "",
			cdn_url_back0: cover?.cdnUrlBack ?? "",
			crop_list0: hasCover ? "[]" : "",
			music_id0: "",
			video_id0: "",
			voteid0: "",
			voteismlt0: "0",
			supervoteid0: "",
			cardid0: "",
			cardquantity0: "",
			cardlimit0: "",
			vid_type0: "",
			show_cover_pic0: hasCover ? "1" : "0",
			shortvideofileid0: "",
			copyright_type0: "0",
			releasefirst0: "",
			platform0: "",
			reprint_permit_type0: "",
			allow_reprint0: "",
			allow_reprint_modify0: "",
			original_article_type0: "",
			ori_white_list0: "",
			free_content0: "",
			fee0: "0",
			ad_id0: "",
			guide_words0: "",
			is_share_copyright0: "0",
			share_copyright_url0: "",
			source_article_type0: "",
			reprint_recommend_title0: "",
			reprint_recommend_content0: "",
			share_page_type0: "0",
			share_imageinfo0: "{\"list\":[]}",
			share_video_id0: "",
			dot0: "{}",
			share_voice_id0: "",
			insert_ad_mode0: "",
			categories_list0: "[]",
		});
	}

	private extractDraftIdFromResponse(payload: unknown): string | null {
		const record = this.toRecord(payload);
		return this.toStringId(record?.appMsgId)
			?? this.toStringId(record?.app_msgid)
			?? this.toStringId(record?.AppMsgId)
			?? null;
	}

	private formatError(payload: unknown): string {
		const record = this.toRecord(payload);
		const baseResp = this.toRecord(record?.base_resp);
		const ret = this.toNumber(record?.ret) ?? this.toNumber(baseResp?.ret) ?? -1;
		const errMsg = this.pickString(baseResp, "err_msg")
			?? this.pickString(record, "errmsg")
			?? this.pickString(record, "msg")
			?? "";

		const errorMap: Record<number, string> = {
			[-6]: "请输入验证码",
			[-8]: "请输入验证码",
			[-1]: "系统错误，请稍后重试",
			[-2]: "参数错误，请检查内容后重试",
			[-5]: "服务错误，请稍后重试",
			[-99]: "内容超出字数，请调整",
			[-206]: "服务负荷过大，请稍后重试",
			[200002]: "参数错误，请检查内容后重试",
			[200003]: "登录态超时，请重新获取 Cookie",
			[412]: "图文中含非法外链",
			[62752]: "可能含有具备安全风险的链接，请检查",
			[64506]: "保存失败，链接不合法",
			[64507]: "内容不能包含外部链接",
			[64562]: "请勿插入非微信域名的链接",
			[64509]: "正文中不能包含超过 3 个视频",
			[64702]: "标题超出 64 字长度限制",
			[64703]: "摘要超出 120 字长度限制",
			[64705]: "内容超出字数，请调整",
			[10806]: "正文包含违规内容，请重新编辑",
			[10807]: "内容不能违反公众平台协议",
			[220001]: "素材管理中的存储数量已达上限",
			[220002]: "图片库已达到存储上限",
		};

		if (errorMap[ret]) return errorMap[ret];
		if (errMsg) return `${errMsg} (错误码: ${ret})`;
		return `同步失败 (错误码: ${ret})`;
	}

	private buildDraftUrl(draftId: string, token: string): string {
		return `${WECHAT_MP_BASE_URL}/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=77&appmsgid=${encodeURIComponent(draftId)}&token=${encodeURIComponent(token)}&lang=zh_CN`;
	}

	private async requestDraftSave(requestPayload: WechatDraftRequest): Promise<{ draftId: string; token: string }> {
		const meta = await this.ensureSessionMeta();
		const formData = this.buildDraftFormData(requestPayload, meta.token);
		const cover = requestPayload.cover ?? null;
		await this.tracePublish({
			stage: "wechat_draft_payload_ready",
			message: "Prepared WeChat draft payload",
			metadata: {
				hasCover: Boolean(cover?.cdnUrl),
				hasCoverFileId: Boolean(cover?.fileId),
				showCoverPic: cover?.cdnUrl ? "1" : "0",
				coverCdnUrl: cover?.cdnUrl ?? null,
			},
		});

		const raw = await this.withNetworkRetry(
			"wechat_save_draft_retry",
			async () => await this.request<unknown>(
				`${WECHAT_MP_OPERATE_APPMSG_URL}?t=ajax-response&sub=create&type=77&token=${encodeURIComponent(meta.token)}&lang=zh_CN`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
						cookie: this.cookieHeader,
						origin: WECHAT_MP_BASE_URL,
						referer: WECHAT_REFERER,
					},
					body: formData.toString(),
				},
			),
			2,
		);

		const draftId = this.extractDraftIdFromResponse(raw);
		if (!draftId) {
			throw new Error(this.formatError(raw));
		}
		return { draftId, token: meta.token };
	}

	private async uploadImageBySourceUrlDetailed(sourceUrl: string): Promise<WechatUploadedImage> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isWechatHostedImage(normalized)) {
			return {
				url: normalized,
				fileId: null,
				cdnUrl235: normalized,
				cdnUrl11: normalized,
				cdnUrlBack: normalized,
			};
		}

		const meta = await this.ensureSessionMeta();

		await this.tracePublish({
			stage: "wechat_image_upload_start",
			message: "Start uploading WeChat image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const blob = normalized.startsWith("data:")
			? this.dataUriToBlob(normalized)
			: await this.downloadImageFromUrl(normalized);
		const suffix = this.guessImageSuffix(normalized, blob.type || "image/jpeg");

		const timestamp = Date.now();
		const fileName = `${timestamp}.${suffix}`;
		const formData = new FormData();
		formData.append("type", blob.type || "image/jpeg");
		formData.append("id", String(timestamp));
		formData.append("name", fileName);
		formData.append("lastModifiedDate", new Date().toString());
		formData.append("size", String(blob.size));
		formData.append("file", blob, fileName);

		const seq = Date.now();
		const raw = await this.withNetworkRetry(
			"wechat_image_upload_retry",
			async () => await this.request<unknown>(
				`${WECHAT_MP_FILETRANSFER_URL}?action=upload_material&f=json&scene=8&writetype=doublewrite&groupid=1&ticket_id=${encodeURIComponent(meta.userName)}&ticket=${encodeURIComponent(meta.ticket)}&svr_time=${encodeURIComponent(String(meta.svrTime))}&token=${encodeURIComponent(meta.token)}&lang=zh_CN&seq=${seq}&t=${Math.random()}`,
				{
					method: "POST",
					headers: {
						cookie: this.cookieHeader,
						origin: WECHAT_MP_BASE_URL,
						referer: WECHAT_REFERER,
					},
					body: formData,
				},
			),
			2,
		);

		const record = this.toRecord(raw);
		const contentRecord = this.extractUploadContentRecord(record);
		const baseResp = this.toRecord(record?.base_resp) ?? this.toRecord(contentRecord?.base_resp);
		const errMsg = this.pickString(baseResp, "err_msg")
			?? this.pickString(record, "errmsg")
			?? this.pickString(contentRecord, "errmsg");
		const ret = this.toNumber(baseResp?.ret)
			?? this.toNumber(record?.ret)
			?? this.toNumber(contentRecord?.ret)
			?? 0;
		const uploadedUrl = this.pickUploadedImageField(record, contentRecord, "cdn_url");
		const cdnUrl235 = this.pickUploadedImageField(record, contentRecord, "cdn_235_1_url");
		const cdnUrl11 = this.pickUploadedImageField(record, contentRecord, "cdn_1_1_url");
		const cdnUrlBack = this.pickUploadedImageField(record, contentRecord, "cdn_url_back");
		const fileId = this.extractUploadFileId(record);

		if (!fileId) {
			await this.tracePublish({
				stage: "wechat_image_upload_fileid_missing",
				level: "warn",
				message: "WeChat upload response has no fileId, fallback to cdn_url cover fields",
			});
		}

		if (!uploadedUrl || ((errMsg && errMsg !== "ok") || ret !== 0)) {
			throw new Error(`微信公众号图片上传失败: ${this.formatError(raw)}`);
		}

		await this.tracePublish({
				stage: "wechat_image_upload_done",
				message: "WeChat image uploaded",
				metadata: {
					source: normalized.startsWith("data:") ? "data-uri" : normalized,
					uploadedUrl,
					fileId: fileId ?? null,
				},
			});

		return {
			url: uploadedUrl,
			fileId,
			cdnUrl235: cdnUrl235 ?? uploadedUrl,
			cdnUrl11: cdnUrl11 ?? uploadedUrl,
			cdnUrlBack: cdnUrlBack ?? uploadedUrl,
		};
	}

	private async uploadImageBySourceUrl(sourceUrl: string): Promise<string> {
		const uploaded = await this.uploadImageBySourceUrlDetailed(sourceUrl);
		return uploaded.url;
	}

	async verify(): Promise<VerifyResult> {
		try {
			const accountInfo = await this.info();
			return {
				valid: true,
				message: "微信公众号账号验证成功",
				accountInfo,
			};
		} catch (error) {
			return {
				valid: false,
				message: error instanceof Error ? error.message : "微信公众号账号验证失败",
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
		const meta = await this.ensureSessionMeta();
		if (!meta.userName && !meta.nickName) {
			throw new Error("无法解析公众号身份信息，请检查 Cookie 是否完整。");
		}
		return {
			id: meta.userName || meta.nickName,
			name: meta.nickName || meta.userName,
			avatar: meta.avatar,
			isLogin: true,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "wechat_article_draft_start",
				message: "Start creating WeChat draft",
				metadata: {
					titleLength: article.title.length,
					hasHtmlContent: Boolean(article.htmlContent?.trim()),
				},
			});

			const htmlContent = await this.resolveArticleHtml(article);
			const digest = this.resolveDigest(article, htmlContent);
			const cover = await this.resolveCoverImage(article);
			const { draftId, token } = await this.requestDraftSave({
				title: article.title,
				htmlContent,
				digest,
				cover,
			});
			const draftUrl = this.buildDraftUrl(draftId, token);
			this.draftHtmlContentCache.set(draftId, htmlContent);

			await this.tracePublish({
				stage: "wechat_article_draft_done",
				message: "WeChat draft created",
				metadata: {
					draftId,
					draftUrl,
					hasCover: Boolean(cover?.cdnUrl),
				},
			});

			return {
				id: draftId,
				title: article.title,
				content: article.content,
				htmlContent,
				createdAt: Date.now(),
				url: draftUrl,
			};
		} catch (error) {
			await this.tracePublish({
				stage: "wechat_article_draft_failed",
				level: "error",
				message: error instanceof Error ? error.message : "WeChat draft creation failed",
			});
			throw (error instanceof Error ? error : new Error(String(error)));
		}
	}

	async articlePublish(article: SharedArticle): Promise<ArticlePublishResult> {
		const draftId = article.draftId?.trim();
		if (!draftId) {
			return {
				success: false,
				message: "Missing draftId for WeChat publish",
			};
		}

		try {
			await this.tracePublish({
				stage: "wechat_article_publish_start",
				message: "Start finalizing WeChat article",
				metadata: {
					draftId,
				},
			});

			const htmlContent = article.htmlContent?.trim()
				|| this.draftHtmlContentCache.get(draftId)
				|| await this.resolveArticleHtml(article);
			const digest = this.resolveDigest(article, htmlContent);
			const cover = await this.resolveCoverImage(article);
			const saveResult = await this.requestDraftSave({
				title: article.title,
				htmlContent,
				digest,
				appMsgId: draftId,
				cover,
			});

			const finalId = saveResult.draftId || draftId;
			const finalUrl = this.buildDraftUrl(finalId, saveResult.token);

			await this.tracePublish({
				stage: "wechat_article_publish_done",
				message: "WeChat draft finalized (manual mass-send required)",
				metadata: {
					draftId,
					finalId,
					finalUrl,
					hasCover: Boolean(cover?.cdnUrl),
				},
			});

			return {
				success: true,
				articleId: finalId,
				url: finalUrl,
				message: "公众号草稿已更新完成，请在公众号后台手动群发。",
			};
		} catch (error) {
			const fallbackToken = this.sessionMetaCache?.token;
			const fallbackUrl = fallbackToken ? this.buildDraftUrl(draftId, fallbackToken) : undefined;

			await this.tracePublish({
				stage: "wechat_article_publish_fallback",
				level: "warn",
				message: error instanceof Error ? error.message : "WeChat publish fallback to draft",
				metadata: {
					draftId,
					fallbackUrl: fallbackUrl ?? null,
				},
			});

			return {
				success: true,
				articleId: draftId,
				url: fallbackUrl,
				message: "公众号自动群发暂不支持，草稿已保留，请在公众号后台手动群发。",
			};
		} finally {
			this.draftHtmlContentCache.delete(draftId);
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		void articleId;
		return {
			success: false,
			message: "微信公众号网页接口删除草稿暂未实现。",
		};
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		void page;
		void pageSize;
		return [];
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		void articleId;
		return null;
	}

	async articleTags(articleId: string): Promise<string[]> {
		void articleId;
		return [];
	}

	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		void filename;
		try {
			if (!imageData?.trim()) {
				return { success: false, message: "Image data is empty" };
			}

			const normalized = this.normalizeImageUrl(imageData);
			if (normalized && !normalized.startsWith("data:")) {
				const uploadedUrl = await this.uploadImageBySourceUrl(normalized);
				return { success: true, url: uploadedUrl, message: "Image uploaded successfully" };
			}

			const source = normalized?.startsWith("data:")
				? normalized
				: `data:image/jpeg;base64,${imageData.trim()}`;
			const uploadedUrl = await this.uploadImageBySourceUrl(source);
			return { success: true, url: uploadedUrl, message: "Image uploaded successfully" };
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "Image upload failed",
			};
		}
	}
}

registerAccountService("wechat", WechatAccountService);
