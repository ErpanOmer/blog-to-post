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
import hljs from "highlight.js/lib/core";
import bashLanguage from "highlight.js/lib/languages/bash";
import cssLanguage from "highlight.js/lib/languages/css";
import javascriptLanguage from "highlight.js/lib/languages/javascript";
import jsonLanguage from "highlight.js/lib/languages/json";
import lessLanguage from "highlight.js/lib/languages/less";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import plaintextLanguage from "highlight.js/lib/languages/plaintext";
import scssLanguage from "highlight.js/lib/languages/scss";
import shellLanguage from "highlight.js/lib/languages/shell";
import sqlLanguage from "highlight.js/lib/languages/sql";
import typescriptLanguage from "highlight.js/lib/languages/typescript";
import handlebarsLanguage from "highlight.js/lib/languages/handlebars";
import xmlLanguage from "highlight.js/lib/languages/xml";
import yamlLanguage from "highlight.js/lib/languages/yaml";

interface WechatApiCredential {
	appId: string;
	appSecret: string;
}

interface WechatTokenResponse {
	access_token?: string;
	expires_in?: number;
	errcode?: number;
	errmsg?: string;
}

interface WechatThumbMedia {
	mediaId: string;
	url?: string;
}

interface PublishStatusSnapshot {
	state: "success" | "processing" | "failed" | "unknown";
	statusCode: number | null;
	statusLabel: string;
	payload: Record<string, unknown>;
}

const WECHAT_API_BASE_URL = "https://api.weixin.qq.com";
const WECHAT_MP_HOME_URL = "https://mp.weixin.qq.com/";
const WECHAT_DEFAULT_USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const WECHAT_PUBLISH_STATUS_LABEL: Record<number, string> = {
	0: "publish_success",
	1: "publishing",
	2: "publish_failed_original_check",
	3: "publish_failed_normal",
	4: "publish_success_after_platform_review",
	5: "publish_failed_after_platform_review",
	6: "platform_reviewing",
	7: "draft_deleted",
	8: "system_error",
};

const WECHAT_ERROR_MESSAGE_MAP: Record<number, string> = {
	40001: "access_token 无效，请检查 appId/appSecret",
	40013: "无效的 appId",
	40014: "access_token 失效，请重新获取",
	40125: "无效的 appSecret",
	41001: "缺少必填参数",
	42001: "access_token 已过期",
	45009: "调用频率超限，请稍后重试",
	48001: "接口未授权，请确认公众号权限",
};

const WECHAT_ARTICLE_INLINE_STYLE_MAP: ReadonlyArray<{
	tagName: string;
	style: string;
}> = [
  {
    tagName: "p",
    style: "font-size:16px;line-height:1.625;color:#000; padding:8px 0;"
  },
  {
    tagName: "h1",
    style: "font-size:24px;font-weight:700;margin:1.2em 0 1em;color:#35b378;"
  },
  {
    tagName: "h2",
    style: "font-size:23px;font-weight:700;margin:1em 0 0.5em;color:#35b378;padding:0.5em 0;border-bottom:1px solid #35b378;display:inline-block;"
  },
  {
    tagName: "h3",
    style: "font-size:20px;font-weight:700;margin:1.2em 0 0.6em;color:#35b378;"
  },
  {
    tagName: "ul",
    style: "margin:8px 0;padding-left:25px;list-style-type:disc;color:#000;"
  },
  {
    tagName: "ol",
    style: "margin:8px 0;padding-left:25px;list-style-type:decimal;color:#000;"
  },
  {
    tagName: "li",
    style: "margin:10px 0;line-height:26px;color:rgb(1,1,1);font-weight:500;"
  },
  {
    tagName: "blockquote",
    style: "margin:10px 5px;padding:10px 10px 10px 20px;border-left:3px solid #35b378;background:#FBF9FD;color:#616161;font-size:0.9em;"
  },
  {
    tagName: "code",
    style: "font-size:14px;padding:2px 4px;border-radius:4px;background:rgba(27,31,35,.05);font-family:monospace;color:#35b378;"
  },
  {
    tagName: "pre",
    style: "margin:10px 0;border-radius:5px;background:#fafafa;overflow-x:auto;padding:16px;font-size:12px;"
  },
  {
    tagName: "a",
    style: "color:#35b378;font-weight:700;text-decoration:none;border-bottom:1px solid #35b378;"
  },
  {
    tagName: "strong",
    style: "font-weight:700;color:#35b378;"
  },
  {
    tagName: "em",
    style: "font-style:italic;color:#000;"
  },
  {
    tagName: "hr",
    style: "margin:0.5em auto;border:1px solid #35b378;height:1px;"
  },
  {
    tagName: "table",
    style: "border-collapse:collapse;width:100%;"
  },
  {
    tagName: "th",
    style: "font-size:16px;padding:5px 10px;border:1px solid #ccc;background:#f0f0f0;font-weight:700;"
  },
  {
    tagName: "td",
    style: "font-size:16px;padding:5px 10px;border:1px solid #ccc;"
  },
  {
    tagName: "img",
    style: "display:block;margin:0 auto;max-width:100%;"
  },
  {
    tagName: "figure",
    style: "margin:10px 0;display:flex;flex-direction:column;align-items:center;justify-content:center;"
  },
  {
    tagName: "figcaption",
    style: "margin-top:5px;text-align:center;color:#888;font-size:14px;"
  }
];

const WECHAT_CODE_BLOCK_REGEX = /<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const WECHAT_CLASS_ATTR_REGEX = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const WECHAT_STYLE_ATTR_REGEX = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const WECHAT_DATA_LANG_ATTR_REGEX = /\bdata-(?:lang|language)\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const WECHAT_LANG_ATTR_REGEX = /\blang(?:uage)?\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const WECHAT_LANGUAGE_CLASS_REGEX = /^(?:language|lang)-(.+)$/i;

const WECHAT_CODE_WRAPPER_STYLE =
	"margin:16px 0;border:1px solid #30363d;border-radius:10px;background:#0d1117;overflow:hidden;";
const WECHAT_CODE_HEADER_STYLE =
	"display:flex;align-items:center;justify-content:space-between;padding:7px 12px;background:#161b22 !important;border-bottom:1px solid #30363d;";
const WECHAT_CODE_LANGUAGE_LABEL_STYLE =
	"font-size:12px;line-height:1;color:#8b949e;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;";
const WECHAT_CODE_PRE_STYLE =
	"margin:0;padding:14px 16px;background:#0d1117 !important;color:#c9d1d9;overflow-x:auto;white-space:pre;word-break:normal;line-height:1.6;font-size:13px;border-radius:5px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,\"Liberation Mono\",\"Courier New\",monospace;";
const WECHAT_CODE_TAG_STYLE =
	"display:block;margin:0;padding:0;background:transparent;color:inherit;white-space:inherit;word-break:normal;line-height:inherit;font-size:inherit;font-family:inherit;";

const WECHAT_CODE_LANGUAGE_ALIAS_MAP: Record<string, string> = {
	js: "javascript",
	javascript: "javascript",
	node: "javascript",
	nodejs: "javascript",
	cjs: "javascript",
	mjs: "javascript",
	jsx: "javascript",
	ts: "typescript",
	typescript: "typescript",
	tsx: "typescript",
	html: "xml",
	htm: "xml",
	xml: "xml",
	svg: "xml",
	vue: "xml",
	css: "css",
	scss: "scss",
	less: "less",
	shell: "shell",
	sh: "shell",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	sql: "sql",
	mysql: "sql",
	postgresql: "sql",
	pgsql: "sql",
	postgres: "sql",
	liquid: "handlebars",
	hbs: "handlebars",
	handlebars: "handlebars",
	md: "markdown",
	markdown: "markdown",
	text: "plaintext",
	txt: "plaintext",
	plain: "plaintext",
	plaintext: "plaintext",
};

const WECHAT_CODE_LANGUAGE_DISPLAY_MAP: Record<string, string> = {
	javascript: "JavaScript",
	typescript: "TypeScript",
	xml: "HTML/XML",
	css: "CSS",
	scss: "SCSS",
	less: "Less",
	shell: "Shell",
	bash: "Bash",
	json: "JSON",
	yaml: "YAML",
	sql: "SQL",
	handlebars: "Liquid/Handlebars",
	markdown: "Markdown",
	plaintext: "Plain Text",
};

const WECHAT_CODE_AUTO_DETECT_LANGUAGES = [
	"javascript",
	"typescript",
	"xml",
	"css",
	"scss",
	"less",
	"shell",
	"bash",
	"sql",
	"handlebars",
	"json",
	"yaml",
	"markdown",
	"plaintext",
];

const WECHAT_GITHUB_DARK_TOKEN_STYLE_MAP: Record<string, string> = {
	comment: "color:#8b949e;font-style:italic;",
	quote: "color:#8b949e;font-style:italic;",
	doctag: "color:#8b949e;font-style:italic;",
	keyword: "color:#ff7b72;",
	"selector-tag": "color:#7ee787;",
	"selector-id": "color:#d2a8ff;",
	"selector-class": "color:#d2a8ff;",
	"selector-attr": "color:#79c0ff;",
	"selector-pseudo": "color:#d2a8ff;",
	attr: "color:#79c0ff;",
	name: "color:#79c0ff;",
	tag: "color:#7ee787;",
	type: "color:#ff7b72;",
	title: "color:#d2a8ff;",
	function: "color:#d2a8ff;",
	"function_": "color:#d2a8ff;",
	class_: "color:#ffa657;",
	params: "color:#c9d1d9;",
	built_in: "color:#79c0ff;",
	literal: "color:#79c0ff;",
	number: "color:#79c0ff;",
	symbol: "color:#79c0ff;",
	variable: "color:#ffa657;",
	"template-variable": "color:#ffa657;",
	string: "color:#a5d6ff;",
	regexp: "color:#a5d6ff;",
	subst: "color:#c9d1d9;",
	meta: "color:#8b949e;",
	"meta-keyword": "color:#ff7b72;",
	"meta-string": "color:#a5d6ff;",
	section: "color:#d2a8ff;font-weight:700;",
	bullet: "color:#f2cc60;",
	emphasis: "font-style:italic;",
	strong: "font-weight:700;",
	addition: "color:#3fb950;",
	deletion: "color:#f85149;",
	link: "color:#79c0ff;text-decoration:underline;",
};

let wechatCodeHighlightRegistered = false;

const ensureWechatHighlightLanguagesRegistered = (): void => {
	if (wechatCodeHighlightRegistered) return;
	hljs.registerLanguage("bash", bashLanguage);
	hljs.registerLanguage("css", cssLanguage);
	hljs.registerLanguage("javascript", javascriptLanguage);
	hljs.registerLanguage("json", jsonLanguage);
	hljs.registerLanguage("less", lessLanguage);
	hljs.registerLanguage("markdown", markdownLanguage);
	hljs.registerLanguage("plaintext", plaintextLanguage);
	hljs.registerLanguage("scss", scssLanguage);
	hljs.registerLanguage("shell", shellLanguage);
	hljs.registerLanguage("sql", sqlLanguage);
	hljs.registerLanguage("typescript", typescriptLanguage);
	hljs.registerLanguage("handlebars", handlebarsLanguage);
	hljs.registerLanguage("xml", xmlLanguage);
	hljs.registerLanguage("yaml", yamlLanguage);
	wechatCodeHighlightRegistered = true;
};

// 640x360 white JPEG generated by ffmpeg, validated against WeChat `material/add_material?type=thumb`.
const WECHAT_FALLBACK_THUMB_DATA_URI =
	"data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYwLjMxLjEwMgD/2wBDAAgGBgcGBwgICAgICAkJCQoKCgkJCQkKCgoKCgoMDAwKCgoKCgoKDAwMDA0ODQ0NDA0ODg8PDxISEREVFRUZGR//xABLAAEBAAAAAAAAAAAAAAAAAAAABwEBAAAAAAAAAAAAAAAAAAAAABABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIAWgCgAMBIgACEQADEQD/2gAMAwEAAhEDEQA/AL+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/2Q==";

export default class WechatAccountService extends AbstractAccountService {
	private credential: WechatApiCredential | null;
	private accessTokenCache: { token: string; expiresAt: number } | null = null;
	private imageUrlCache = new Map<string, string>();
	private thumbMediaCache = new Map<string, WechatThumbMedia>();
	private draftHtmlContentCache = new Map<string, string>();

	constructor(authToken: string) {
		super("wechat", authToken);
		this.credential = this.parseCredential(authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			accept: "application/json, text/plain, */*",
			"user-agent": WECHAT_DEFAULT_USER_AGENT,
		};
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

	private pickString(record: Record<string, unknown> | null, key: string): string | null {
		const value = record?.[key];
		if (typeof value !== "string") return null;
		const trimmed = value.trim();
		return trimmed || null;
	}

	private pickCredentialFromRecord(record: Record<string, unknown> | null): WechatApiCredential | null {
		if (!record) return null;

		const appId = this.pickString(record, "appId")
			?? this.pickString(record, "appid")
			?? this.pickString(record, "app_id")
			?? this.pickString(record, "wxAppId");
		const appSecret = this.pickString(record, "appSecret")
			?? this.pickString(record, "appsecret")
			?? this.pickString(record, "app_secret")
			?? this.pickString(record, "secret")
			?? this.pickString(record, "wxAppSecret");

		if (!appId || !appSecret) return null;
		return { appId, appSecret };
	}

	private parseLooseKeyValueCredential(rawToken: string): Record<string, unknown> | null {
		if (!/[=:]/.test(rawToken)) return null;

		const record: Record<string, unknown> = {};
		const pairs = rawToken
			.split(/[&\n;,]+/)
			.map((item) => item.trim())
			.filter(Boolean);

		for (const pair of pairs) {
			const equalIndex = pair.indexOf("=");
			const colonIndex = pair.indexOf(":");
			const splitIndex = equalIndex >= 0 ? equalIndex : colonIndex;
			if (splitIndex <= 0) continue;
			const key = pair.slice(0, splitIndex).trim();
			const value = pair.slice(splitIndex + 1).trim();
			if (!key || !value) continue;
			record[key] = value;
		}

		return Object.keys(record).length > 0 ? record : null;
	}

	private parseCredential(rawToken: string): WechatApiCredential | null {
		const trimmed = rawToken.trim();
		if (!trimmed) return null;

		const fromJson = this.pickCredentialFromRecord(this.toRecord(this.tryParseJson(trimmed)));
		if (fromJson) return fromJson;

		const looseRecord = this.parseLooseKeyValueCredential(trimmed);
		const fromLooseRecord = this.pickCredentialFromRecord(looseRecord);
		if (fromLooseRecord) return fromLooseRecord;

		const lines = trimmed
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean);
		if (lines.length >= 2 && /^wx[a-zA-Z0-9_-]{8,}$/.test(lines[0])) {
			return {
				appId: lines[0],
				appSecret: lines[1],
			};
		}

		return null;
	}

	private getCredentialOrThrow(): WechatApiCredential {
		if (!this.credential) {
			throw new Error(
				"微信公众号认证信息格式无效。请提供 appId + appSecret（可通过 JSON 或两行文本传入）。",
			);
		}
		return this.credential;
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

	private formatWechatApiError(payload: Record<string, unknown>, path: string): string {
		const errCode = this.toNumber(payload.errcode);
		const errMsg = this.pickString(payload, "errmsg") ?? "unknown error";

		if (errCode !== null && WECHAT_ERROR_MESSAGE_MAP[errCode]) {
			return `${WECHAT_ERROR_MESSAGE_MAP[errCode]} (errcode: ${errCode})`;
		}

		if (errCode !== null) {
			return `微信公众号接口调用失败 [${path}]：${errMsg} (errcode: ${errCode})`;
		}
		return `微信公众号接口调用失败 [${path}]：${errMsg}`;
	}

	private isAccessTokenExpiredError(errCode: number): boolean {
		return errCode === 40001 || errCode === 40014 || errCode === 42001;
	}

	private async getAccessToken(forceRefresh = false): Promise<string> {
		const now = Date.now();
		if (!forceRefresh && this.accessTokenCache && now < this.accessTokenCache.expiresAt) {
			return this.accessTokenCache.token;
		}

		const credential = this.getCredentialOrThrow();
		const tokenUrl = new URL(`${WECHAT_API_BASE_URL}/cgi-bin/token`);
		tokenUrl.searchParams.set("grant_type", "client_credential");
		tokenUrl.searchParams.set("appid", credential.appId);
		tokenUrl.searchParams.set("secret", credential.appSecret);

		const payload = await this.withNetworkRetry(
			"wechat_get_access_token_retry",
			async () => await this.request<WechatTokenResponse>(tokenUrl.toString(), {
				method: "GET",
			}),
			2,
		);

		const token = payload.access_token?.trim();
		if (!token) {
			const record = this.toRecord(payload as unknown) ?? {};
			throw new Error(this.formatWechatApiError(record, "/cgi-bin/token"));
		}

		const expiresIn = Math.max(300, this.toNumber(payload.expires_in) ?? 7200);
		const expiresAt = Date.now() + Math.max(300, expiresIn - 120) * 1000;
		this.accessTokenCache = { token, expiresAt };
		return token;
	}

	private buildWechatApiUrl(
		path: string,
		accessToken: string,
		query?: Record<string, string | number | boolean | null | undefined>,
	): string {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(`${WECHAT_API_BASE_URL}${normalizedPath}`);
		url.searchParams.set("access_token", accessToken);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				if (value === undefined || value === null) continue;
				url.searchParams.set(key, String(value));
			}
		}
		return url.toString();
	}

	private async requestWechatApi(
		path: string,
		options: {
			method?: "GET" | "POST";
			query?: Record<string, string | number | boolean | null | undefined>;
			body?: Record<string, unknown> | FormData | null;
			retryOnAuthError?: boolean;
		} = {},
		): Promise<Record<string, unknown>> {
		const method = options.method ?? "GET";
		const retryOnAuthError = options.retryOnAuthError ?? true;

		const accessToken = await this.getAccessToken();
		const url = this.buildWechatApiUrl(path, accessToken, options.query);

		const headers: Record<string, string> = {};
		let body: BodyInit | undefined;
		if (options.body instanceof FormData) {
			body = options.body;
		} else if (options.body !== undefined && options.body !== null) {
			headers["Content-Type"] = "application/json";
			body = JSON.stringify(options.body);
		}

		const rawPayload = await this.withNetworkRetry(
			"wechat_api_request_retry",
			async () => await this.request<unknown>(url, {
				method,
				headers,
				body,
			}),
			2,
		);

		let payload: unknown = rawPayload;
		if (typeof rawPayload === "string") {
			const normalized = rawPayload.replace(/^\uFEFF/, "").trim();
			const parsed = this.tryParseJson(normalized);
			if (parsed !== null) {
				payload = parsed;
			}
		}

		const record = this.toRecord(payload);
		if (!record) {
			const preview = typeof rawPayload === "string"
				? rawPayload.slice(0, 240)
				: JSON.stringify(rawPayload).slice(0, 240);
			await this.tracePublish({
				stage: "wechat_api_invalid_payload",
				level: "error",
				message: "WeChat API returned non-object payload",
				metadata: {
					path,
					payloadType: typeof rawPayload,
					payloadPreview: preview,
				},
			});
			throw new Error(`微信公众号接口返回无效数据: ${path}`);
		}

		const errCode = this.toNumber(record.errcode);
		if (errCode !== null && errCode !== 0) {
			if (retryOnAuthError && this.isAccessTokenExpiredError(errCode)) {
				this.accessTokenCache = null;
				await this.tracePublish({
					stage: "wechat_access_token_refresh",
					level: "warn",
					message: "Access token expired, refreshing and retrying API request",
					metadata: {
						path,
						errCode,
					},
				});
				await this.getAccessToken(true);
				return this.requestWechatApi(path, {
					...options,
					retryOnAuthError: false,
				});
			}

			throw new Error(this.formatWechatApiError(record, path));
		}

		return record;
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
				// Prefer JPEG/PNG for downstream WeChat media endpoints.
				accept: "image/jpeg,image/png,image/*;q=0.9,*/*;q=0.8",
				"user-agent": WECHAT_DEFAULT_USER_AGENT,
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

	private async uploadContentImageBySourceUrl(sourceUrl: string): Promise<string> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid image URL: ${sourceUrl}`);
		}
		if (!normalized.startsWith("data:") && this.isWechatHostedImage(normalized)) {
			return normalized;
		}

		await this.tracePublish({
			stage: "wechat_content_image_upload_start",
			message: "Start uploading WeChat content image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const blob = normalized.startsWith("data:")
			? this.dataUriToBlob(normalized)
			: await this.downloadImageFromUrl(normalized);
		const suffix = this.guessImageSuffix(normalized, blob.type || "image/jpeg");

		const formData = new FormData();
		formData.append("media", blob, `content.${suffix}`);

		const uploadPayload = await this.requestWechatApi("/cgi-bin/media/uploadimg", {
			method: "POST",
			body: formData,
		});
		const uploadedUrl = this.normalizeImageUrl(this.pickString(uploadPayload, "url") ?? "");
		if (!uploadedUrl) {
			throw new Error(`微信公众号正文图片上传失败: ${JSON.stringify(uploadPayload)}`);
		}

		await this.tracePublish({
			stage: "wechat_content_image_upload_done",
			message: "WeChat content image uploaded",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
				uploadedUrl,
			},
		});

		return uploadedUrl;
	}

	private async uploadThumbMediaBySourceUrl(sourceUrl: string): Promise<WechatThumbMedia> {
		const normalized = this.normalizeImageUrl(sourceUrl);
		if (!normalized) {
			throw new Error(`Invalid cover image URL: ${sourceUrl}`);
		}

		await this.tracePublish({
			stage: "wechat_cover_image_upload_start",
			message: "Start uploading WeChat cover image",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
			},
		});

		const blob = normalized.startsWith("data:")
			? this.dataUriToBlob(normalized)
			: await this.downloadImageFromUrl(normalized);
		const suffix = this.guessImageSuffix(normalized, blob.type || "image/jpeg");

		const formData = new FormData();
		formData.append("media", blob, `thumb.${suffix}`);

		const uploadPayload = await this.requestWechatApi("/cgi-bin/material/add_material", {
			method: "POST",
			query: {
				type: "thumb",
			},
			body: formData,
		});

		const mediaId = this.pickString(uploadPayload, "media_id");
		if (!mediaId) {
			throw new Error(`微信公众号封面图上传失败: ${JSON.stringify(uploadPayload)}`);
		}

		const uploadedUrl = this.normalizeImageUrl(this.pickString(uploadPayload, "url") ?? "") ?? undefined;
		await this.tracePublish({
			stage: "wechat_cover_image_upload_done",
			message: "WeChat cover image uploaded",
			metadata: {
				source: normalized.startsWith("data:") ? "data-uri" : normalized,
				mediaId,
				uploadedUrl: uploadedUrl ?? null,
			},
		});

		return {
			mediaId,
			url: uploadedUrl,
		};
	}

	private toPlainTextFromHtml(html: string): string {
		return html
			.replace(/<style[\s\S]*?<\/style>/gi, " ")
			.replace(/<script[\s\S]*?<\/script>/gi, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/\s+/g, " ")
			.trim();
	}

	private parseInlineStyle(styleText: string): Array<{ prop: string; value: string }> {
		const result: Array<{ prop: string; value: string }> = [];
		for (const rawDeclaration of styleText.split(";")) {
			const declaration = rawDeclaration.trim();
			if (!declaration) continue;
			const splitIndex = declaration.indexOf(":");
			if (splitIndex <= 0) continue;
			const prop = declaration.slice(0, splitIndex).trim().toLowerCase();
			const value = declaration.slice(splitIndex + 1).trim();
			if (!prop || !value) continue;
			result.push({ prop, value });
		}
		return result;
	}

	private mergeInlineStyle(existingStyle: string, incomingStyle: string): string {
		const merged = new Map<string, string>();
		const order: string[] = [];

		for (const declaration of this.parseInlineStyle(existingStyle)) {
			merged.set(declaration.prop, declaration.value);
			order.push(declaration.prop);
		}

		for (const declaration of this.parseInlineStyle(incomingStyle)) {
			if (!merged.has(declaration.prop)) {
				merged.set(declaration.prop, declaration.value);
				order.push(declaration.prop);
			}
		}

		return order.map((prop) => `${prop}:${merged.get(prop)}`).join(";");
	}

	private applyInlineStyleToTag(htmlContent: string, tagName: string, inlineStyle: string): string {
		const regex = new RegExp(`<(${tagName})(\\s[^>]*?)?(\\s*\\/?)>`, "gi");
		return htmlContent.replace(regex, (_fullMatch, matchedTagName: string, rawAttrs: string | undefined, tail: string | undefined) => {
			const attrs = rawAttrs ?? "";
			const styleMatch = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
			let nextAttrs = attrs;
			if (styleMatch) {
				const currentStyle = styleMatch[1] ?? styleMatch[2] ?? "";
				const mergedStyle = this.mergeInlineStyle(currentStyle, inlineStyle);
				nextAttrs = attrs.replace(styleMatch[0], ` style="${mergedStyle}"`);
			} else {
				nextAttrs = `${attrs} style="${inlineStyle}"`;
			}

			const closing = tail ?? "";
			return `<${matchedTagName}${nextAttrs}${closing}>`;
		});
	}

	private extractAttributeValue(attrs: string, regex: RegExp): string | null {
		const match = regex.exec(attrs);
		if (!match) return null;
		const raw = match[1] ?? match[2] ?? "";
		const value = raw.trim();
		return value || null;
	}

	private extractClassNames(attrs: string): string[] {
		const classValue = this.extractAttributeValue(attrs, WECHAT_CLASS_ATTR_REGEX);
		if (!classValue) return [];
		return classValue
			.split(/\s+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	private normalizeCodeLanguage(rawLanguage: string | null): string | null {
		if (!rawLanguage) return null;

		let normalized = rawLanguage.trim().toLowerCase();
		normalized = normalized
			.replace(/^language[-:_]/, "")
			.replace(/^lang[-:_]/, "")
			.split(/[\s,;|]+/)[0]
			.trim();
		if (!normalized) return null;

		const aliased = WECHAT_CODE_LANGUAGE_ALIAS_MAP[normalized] ?? normalized;
		if (!hljs.getLanguage(aliased)) return null;
		return aliased;
	}

	private resolveCodeLanguageFromAttributes(preAttrs: string, codeAttrs: string): string | null {
		const attrSources = [codeAttrs, preAttrs];
		for (const attrs of attrSources) {
			const fromDataLang = this.extractAttributeValue(attrs, WECHAT_DATA_LANG_ATTR_REGEX);
			const normalizedFromDataLang = this.normalizeCodeLanguage(fromDataLang);
			if (normalizedFromDataLang) return normalizedFromDataLang;

			const fromLang = this.extractAttributeValue(attrs, WECHAT_LANG_ATTR_REGEX);
			const normalizedFromLang = this.normalizeCodeLanguage(fromLang);
			if (normalizedFromLang) return normalizedFromLang;

			for (const className of this.extractClassNames(attrs)) {
				const languageClassMatch = WECHAT_LANGUAGE_CLASS_REGEX.exec(className);
				const languageCandidate = languageClassMatch ? languageClassMatch[1] : className;
				const normalized = this.normalizeCodeLanguage(languageCandidate);
				if (normalized) return normalized;
			}
		}

		return null;
	}

	private decodeHtmlEntities(value: string): string {
		return value
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, "\"")
			.replace(/&#39;/g, "'")
			.replace(/&amp;/g, "&")
			.replace(/&nbsp;/g, " ")
			.replace(/&#x([0-9a-fA-F]+);/g, (_full, hex: string) => {
				const codePoint = Number.parseInt(hex, 16);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _full;
			})
			.replace(/&#(\d+);/g, (_full, numeric: string) => {
				const codePoint = Number.parseInt(numeric, 10);
				return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _full;
			});
	}

	private stripHtmlTags(value: string): string {
		return value
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?[^>]+>/g, "");
	}

	private escapeHtml(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	private resolveCodeLanguageLabel(language: string): string {
		const normalized = language.trim().toLowerCase();
		if (WECHAT_CODE_LANGUAGE_DISPLAY_MAP[normalized]) {
			return WECHAT_CODE_LANGUAGE_DISPLAY_MAP[normalized];
		}
		if (normalized.length <= 4) return normalized.toUpperCase();
		return normalized.charAt(0).toUpperCase() + normalized.slice(1);
	}

	private inlineHighlightTokenStyles(highlightedHtml: string): string {
		return highlightedHtml.replace(/<span\b([^>]*?)>/gi, (fullMatch, rawAttrs: string) => {
			const classNames = this.extractClassNames(rawAttrs);
			if (classNames.length === 0) return fullMatch;

			let tokenStyle = "";
			for (const className of classNames) {
				const normalizedClass = className.startsWith("hljs-")
					? className.slice(5)
					: className;
				const style = WECHAT_GITHUB_DARK_TOKEN_STYLE_MAP[normalizedClass];
				if (!style) continue;
				tokenStyle = this.mergeInlineStyle(tokenStyle, style);
			}

			if (!tokenStyle) return fullMatch;

			const styleMatch = WECHAT_STYLE_ATTR_REGEX.exec(rawAttrs);
			let nextAttrs = rawAttrs;
			if (styleMatch) {
				const currentStyle = styleMatch[1] ?? styleMatch[2] ?? "";
				const mergedStyle = this.mergeInlineStyle(currentStyle, tokenStyle);
				nextAttrs = rawAttrs.replace(styleMatch[0], ` style="${mergedStyle}"`);
			} else {
				nextAttrs = `${rawAttrs} style="${tokenStyle}"`;
			}

			return `<span${nextAttrs}>`;
		});
	}

	private highlightCodeToGithubHtml(rawCode: string, explicitLanguage: string | null): {
		html: string;
		language: string;
	} {
		try {
			if (explicitLanguage) {
				const highlighted = hljs.highlight(rawCode, {
					language: explicitLanguage,
					ignoreIllegals: true,
				});
				return {
					html: highlighted.value,
					language: explicitLanguage,
				};
			}

			const autoHighlighted = hljs.highlightAuto(rawCode, WECHAT_CODE_AUTO_DETECT_LANGUAGES);
			const normalizedAutoLanguage = this.normalizeCodeLanguage(autoHighlighted.language ?? null) ?? "plaintext";
			return {
				html: autoHighlighted.value,
				language: normalizedAutoLanguage,
			};
		} catch {
			return {
				html: this.escapeHtml(rawCode),
				language: explicitLanguage ?? "plaintext",
			};
		}
	}

	private applyGithubCodeHighlightToHtml(htmlContent: string): string {
		if (!htmlContent.trim()) return htmlContent;
		ensureWechatHighlightLanguagesRegistered();

		return htmlContent.replace(
			WECHAT_CODE_BLOCK_REGEX,
			(_fullMatch, preAttrs: string | undefined, codeAttrs: string | undefined, codeInnerHtml: string | undefined) => {
				const resolvedPreAttrs = preAttrs ?? "";
				const resolvedCodeAttrs = codeAttrs ?? "";
				const resolvedCodeHtml = codeInnerHtml ?? "";

				const explicitLanguage = this.resolveCodeLanguageFromAttributes(resolvedPreAttrs, resolvedCodeAttrs);
				const plainCode = this.decodeHtmlEntities(this.stripHtmlTags(resolvedCodeHtml));
				const highlighted = this.highlightCodeToGithubHtml(plainCode, explicitLanguage);
				const highlightedWithTokenStyle = this.inlineHighlightTokenStyles(highlighted.html);
				const languageLabel = this.resolveCodeLanguageLabel(explicitLanguage ?? highlighted.language);

				return `<div style="${WECHAT_CODE_WRAPPER_STYLE}"><div style="${WECHAT_CODE_HEADER_STYLE}"><span style="${WECHAT_CODE_LANGUAGE_LABEL_STYLE}">${this.escapeHtml(languageLabel)}</span></div><pre style="${WECHAT_CODE_PRE_STYLE}"><code style="${WECHAT_CODE_TAG_STYLE}">${highlightedWithTokenStyle}</code></pre></div>`;
			},
		);
	}

	private resolveDigest(article: SharedArticle, htmlContent: string): string {
		const summary = article.summary?.trim();
		if (summary) return summary.slice(0, 120);
		const plain = this.toPlainTextFromHtml(htmlContent);
		if (!plain) return "";
		return plain.slice(0, 120);
	}

	private injectWechatStyleSheet(htmlContent: string): string {
		if (!htmlContent.trim()) return htmlContent;

		let styledHtml = this.applyGithubCodeHighlightToHtml(htmlContent);
		for (const rule of WECHAT_ARTICLE_INLINE_STYLE_MAP) {
			styledHtml = this.applyInlineStyleToTag(styledHtml, rule.tagName, rule.style);
		}

		return styledHtml;
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

		const imageSources = this.collectImageUrlsFromMarkdownAndHtml(
			article.content ?? "",
			htmlContent,
		);
		await this.tracePublish({
			stage: "wechat_content_images_scan",
			message: "Scan content images for WeChat image host",
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
				const uploadedUrl = await this.uploadContentImageBySourceUrl(normalized);
				this.imageUrlCache.set(normalized, uploadedUrl);
				uploadedCount += 1;
				await randomDelay(120, 320);
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
			htmlContent,
			(rawUrl) => this.normalizeImageUrl(rawUrl),
			this.imageUrlCache,
		);

		await this.tracePublish({
			stage: "wechat_content_images_resolved",
			message: "Resolve WeChat content image URLs",
			metadata: {
				imageCandidates: imageSources.length,
				uploadedImages: uploadedCount,
				finalHtmlLength: replacedHtml.length,
			},
		});

		return replacedHtml;
	}

	private collectCoverCandidates(article: SharedArticle, htmlContent: string): string[] {
		const candidates = new Set<string>();
		if (article.coverImage?.trim()) {
			candidates.add(article.coverImage.trim());
		}

		const htmlForScan = article.htmlContent?.trim() || htmlContent;
		for (const source of this.collectImageUrlsFromMarkdownAndHtml(article.content ?? "", htmlForScan)) {
			candidates.add(source);
		}

		const normalizedCandidates: string[] = [];
		for (const candidate of candidates) {
			const normalized = this.normalizeImageUrl(candidate);
			if (!normalized) continue;
			if (normalizedCandidates.includes(normalized)) continue;
			normalizedCandidates.push(normalized);
		}
		return normalizedCandidates;
	}

	private async resolveThumbMedia(article: SharedArticle, htmlContent: string): Promise<WechatThumbMedia | null> {
		const candidates = this.collectCoverCandidates(article, htmlContent);
		if (candidates.length === 0) {
			await this.tracePublish({
				stage: "wechat_cover_missing",
				level: "warn",
				message: "No cover candidate found in article cover or content images",
			});
			return null;
		}

		for (const candidate of candidates) {
			const cached = this.thumbMediaCache.get(candidate);
			if (cached) {
				return cached;
			}

			try {
				const uploaded = await this.uploadThumbMediaBySourceUrl(candidate);
				this.thumbMediaCache.set(candidate, uploaded);
				return uploaded;
			} catch (error) {
				await this.tracePublish({
					stage: "wechat_cover_upload_candidate_failed",
					level: "warn",
					message: "One cover candidate upload failed, trying next candidate",
					metadata: {
						candidate,
						error: error instanceof Error ? error.message : "unknown",
					},
				});
			}
		}

		await this.tracePublish({
			stage: "wechat_cover_fallback_start",
			level: "warn",
			message: "All cover candidates failed, fallback to built-in JPEG thumb",
		});

		try {
			const fallbackThumb = await this.uploadThumbMediaBySourceUrl(WECHAT_FALLBACK_THUMB_DATA_URI);
			await this.tracePublish({
				stage: "wechat_cover_fallback_done",
				message: "Fallback WeChat thumb uploaded",
				metadata: {
					mediaId: fallbackThumb.mediaId,
				},
			});
			return fallbackThumb;
		} catch (error) {
			await this.tracePublish({
				stage: "wechat_cover_fallback_failed",
				level: "error",
				message: "Fallback WeChat thumb upload failed",
				metadata: {
					error: error instanceof Error ? error.message : "unknown",
				},
			});
			return null;
		}
	}

	private buildDraftArticlePayload(params: {
		article: SharedArticle;
		htmlContent: string;
		digest: string;
		thumbMediaId: string | null;
	}): Record<string, unknown> {
		if (!params.thumbMediaId) {
			throw new Error("微信公众号草稿发布必须提供可用的 thumb_media_id");
		}

		const payload: Record<string, unknown> = {
			title: params.article.title,
			author: "ErpanOmer",
			digest: params.digest,
			content: params.htmlContent,
			content_source_url: "",
			need_open_comment: 1,
			only_fans_can_comment: 0,
			thumb_media_id: params.thumbMediaId,
			show_cover_pic: 1,
		};

		return payload;
	}

	private classifyPublishState(
		statusCode: number | null,
		payload: Record<string, unknown>,
	): PublishStatusSnapshot["state"] {
		if (statusCode === null) {
			return this.extractFirstArticleUrl(payload) ? "success" : "unknown";
		}

		if (statusCode === 0 || statusCode === 4) return "success";
		if (statusCode === 1 || statusCode === 6) {
			return this.extractFirstArticleUrl(payload) ? "success" : "processing";
		}
		if ([2, 3, 5, 7, 8].includes(statusCode)) return "failed";

		if (this.extractFirstArticleUrl(payload)) return "success";
		return "unknown";
	}

	private statusLabelForCode(statusCode: number | null): string {
		if (statusCode === null) return "unknown";
		return WECHAT_PUBLISH_STATUS_LABEL[statusCode] ?? `unknown_${statusCode}`;
	}

	private toPublishStatusSnapshot(payload: Record<string, unknown>): PublishStatusSnapshot {
		const statusCode = this.toNumber(payload.publish_status);
		const state = this.classifyPublishState(statusCode, payload);
		return {
			state,
			statusCode,
			statusLabel: this.statusLabelForCode(statusCode),
			payload,
		};
	}

	private extractFirstArticleDetail(payload: Record<string, unknown>): Record<string, unknown> | null {
		const detailRecord = this.toRecord(payload.article_detail);
		if (!detailRecord) return null;
		const items = detailRecord.item;
		if (!Array.isArray(items) || items.length === 0) return null;
		return this.toRecord(items[0]);
	}

	private extractFirstArticleUrl(payload: Record<string, unknown>): string | null {
		const detailItem = this.extractFirstArticleDetail(payload);
		const url = this.pickString(detailItem, "url");
		if (!url) return null;
		return this.normalizeImageUrl(url) ?? url;
	}

	private buildPublishedFallbackUrl(publishId: string): string {
		return `https://mp.weixin.qq.com/s/${encodeURIComponent(publishId)}`;
	}

	private async getPublishStatus(publishId: string): Promise<PublishStatusSnapshot> {
		const payload = await this.requestWechatApi("/cgi-bin/freepublish/get", {
			method: "POST",
			body: {
				publish_id: publishId,
			},
		});
		return this.toPublishStatusSnapshot(payload);
	}

	private async waitForPublishStatus(
		publishId: string,
		maxAttempts = 8,
	): Promise<PublishStatusSnapshot> {
		let latest: PublishStatusSnapshot | null = null;

		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			latest = await this.getPublishStatus(publishId);
			await this.tracePublish({
				stage: "wechat_publish_status_poll",
				message: "Polled WeChat publish status",
				metadata: {
					publishId,
					attempt,
					statusCode: latest.statusCode,
					statusLabel: latest.statusLabel,
					state: latest.state,
				},
			});

			if (latest.state === "success" || latest.state === "failed") {
				return latest;
			}

			if (attempt < maxAttempts) {
				await randomDelay(1800, 3200);
			}
		}

		if (latest) return latest;
		return {
			state: "unknown",
			statusCode: null,
			statusLabel: "unknown",
			payload: {},
		};
	}

	private async resolveDraftOpenUrl(
		mediaId: string,
		title: string,
	): Promise<{ url: string | null; matchedBy: "media_id" | "title" | "none" }> {
		const normalizedTitle = title.trim();
		const pageSize = 20;
		const maxPages = 5;
		let offset = 0;

		let titleMatchedUrl: string | null = null;
		let titleMatchedUpdateTime = -1;

		for (let page = 0; page < maxPages; page++) {
			const payload = await this.requestWechatApi("/cgi-bin/draft/batchget", {
				method: "POST",
				body: {
					offset,
					count: pageSize,
					no_content: 0,
				},
			});

			const rawItems = payload.item;
			const items = Array.isArray(rawItems) ? rawItems : [];

			for (const rawItem of items) {
				const itemRecord = this.toRecord(rawItem);
				if (!itemRecord) continue;

				const itemMediaId = this.pickString(itemRecord, "media_id");
				const updateTime = this.toNumber(itemRecord.update_time) ?? 0;
				const contentRecord = this.toRecord(itemRecord.content);
				const newsItemList = Array.isArray(contentRecord?.news_item) ? contentRecord.news_item : [];
				const firstNewsItem = this.toRecord(newsItemList[0]);
				const draftTitle = this.pickString(firstNewsItem, "title") ?? "";
				const draftUrlRaw = this.pickString(firstNewsItem, "url");
				const draftUrl = draftUrlRaw ? (this.normalizeImageUrl(draftUrlRaw) ?? draftUrlRaw) : null;

				if (itemMediaId && itemMediaId === mediaId && draftUrl) {
					return { url: draftUrl, matchedBy: "media_id" };
				}

				if (
					draftUrl
					&& normalizedTitle
					&& draftTitle.trim() === normalizedTitle
					&& updateTime >= titleMatchedUpdateTime
				) {
					titleMatchedUpdateTime = updateTime;
					titleMatchedUrl = draftUrl;
				}
			}

			const totalCount = this.toNumber(payload.total_count) ?? items.length;
			offset += pageSize;
			if (items.length === 0 || offset >= totalCount) break;
		}

		if (titleMatchedUrl) {
			return { url: titleMatchedUrl, matchedBy: "title" };
		}

		return { url: null, matchedBy: "none" };
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
		const credential = this.getCredentialOrThrow();
		await this.requestWechatApi("/cgi-bin/getcallbackip", {
			method: "GET",
		});
		return {
			id: credential.appId,
			name: `微信公众号(${credential.appId})`,
			isLogin: true,
		};
	}

	async articleDraft(article: SharedArticle): Promise<ArticleDraft | null> {
		try {
			await this.tracePublish({
				stage: "wechat_article_draft_start",
				message: "Start creating WeChat draft via official API",
				metadata: {
					titleLength: article.title.length,
					hasHtmlContent: Boolean(article.htmlContent?.trim()),
				},
			});

			const resolvedHtml = await this.resolveArticleHtml(article);
			const htmlWithStyle = this.injectWechatStyleSheet(resolvedHtml);
			const digest = this.resolveDigest(article, resolvedHtml);
			const thumbMedia = await this.resolveThumbMedia(article, resolvedHtml);

			const draftPayload = await this.requestWechatApi("/cgi-bin/draft/add", {
				method: "POST",
				body: {
					articles: [
						this.buildDraftArticlePayload({
							article,
							htmlContent: htmlWithStyle,
							digest,
							thumbMediaId: thumbMedia?.mediaId ?? null,
						}),
					],
				},
			});

			const draftId = this.pickString(draftPayload, "media_id");
			if (!draftId) {
				throw new Error(`创建微信公众号草稿失败: ${JSON.stringify(draftPayload)}`);
			}

			let draftUrl = WECHAT_MP_HOME_URL;
			try {
				const resolvedDraft = await this.resolveDraftOpenUrl(draftId, article.title);
				if (resolvedDraft.url) {
					draftUrl = resolvedDraft.url;
				}
				await this.tracePublish({
					stage: "wechat_draft_open_url_resolved",
					message: "Resolved WeChat draft open URL",
					metadata: {
						draftId,
						matchedBy: resolvedDraft.matchedBy,
						draftUrl,
					},
				});
			} catch (error) {
				await this.tracePublish({
					stage: "wechat_draft_open_url_resolve_failed",
					level: "warn",
					message: "Failed to resolve WeChat draft open URL, fallback to MP home",
					metadata: {
						draftId,
						error: error instanceof Error ? error.message : "unknown",
						draftUrl,
					},
				});
			}

			this.draftHtmlContentCache.set(draftId, htmlWithStyle);

			await this.tracePublish({
				stage: "wechat_article_draft_done",
				message: "WeChat draft created",
				metadata: {
					draftId,
					hasCover: Boolean(thumbMedia?.mediaId),
					thumbMediaId: thumbMedia?.mediaId ?? null,
				},
			});

			return {
				id: draftId,
				title: article.title,
				content: article.content,
				htmlContent: htmlWithStyle,
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
				message: "Start publishing WeChat draft",
				metadata: {
					draftId,
					hasDraftCacheHtml: this.draftHtmlContentCache.has(draftId),
					hasPayloadHtmlContent: Boolean(article.htmlContent?.trim()),
				},
			});

			if (this.draftHtmlContentCache.has(draftId)) {
				await this.tracePublish({
					stage: "wechat_article_publish_reuse_draft_cache",
					message: "Reuse draft-stage prepared HTML cache",
					metadata: {
						draftId,
						htmlLength: this.draftHtmlContentCache.get(draftId)?.length ?? null,
					},
				});
			}

			const submitPayload = await this.requestWechatApi("/cgi-bin/freepublish/submit", {
				method: "POST",
				body: {
					media_id: draftId,
				},
			});

			const publishId = this.pickString(submitPayload, "publish_id");
			if (!publishId) {
				throw new Error(`发布请求提交失败: ${JSON.stringify(submitPayload)}`);
			}

			const statusSnapshot = await this.waitForPublishStatus(publishId, 8);
			const articleUrl = this.extractFirstArticleUrl(statusSnapshot.payload)
				?? this.buildPublishedFallbackUrl(publishId);

			if (statusSnapshot.state === "failed") {
				return {
					success: false,
					articleId: publishId,
					url: articleUrl,
					message: `微信公众号发布失败，状态: ${statusSnapshot.statusLabel}`,
				};
			}

			if (statusSnapshot.state === "processing" || statusSnapshot.state === "unknown") {
				return {
					success: true,
					articleId: publishId,
					url: articleUrl,
					message: `微信公众号发布请求已提交，当前状态: ${statusSnapshot.statusLabel}`,
				};
			}

			return {
				success: true,
				articleId: publishId,
				url: articleUrl,
				message: "微信公众号发布成功",
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "微信公众号发布失败",
			};
		} finally {
			this.draftHtmlContentCache.delete(draftId);
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		const draftId = articleId.trim();
		if (!draftId) {
			return {
				success: false,
				message: "Draft id is required",
			};
		}

		try {
			await this.requestWechatApi("/cgi-bin/draft/delete", {
				method: "POST",
				body: {
					media_id: draftId,
				},
			});
			return {
				success: true,
				message: "微信公众号草稿删除成功",
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "微信公众号草稿删除失败",
			};
		}
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		const offset = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize));
		const count = Math.max(1, Math.min(20, pageSize));

		try {
			const payload = await this.requestWechatApi("/cgi-bin/draft/batchget", {
				method: "POST",
				body: {
					offset,
					count,
					no_content: 0,
				},
			});

			const rawItems = payload.item;
			if (!Array.isArray(rawItems)) return [];

			const result: Article[] = [];
			for (const rawItem of rawItems) {
				const itemRecord = this.toRecord(rawItem);
				if (!itemRecord) continue;
				const mediaId = this.pickString(itemRecord, "media_id");
				if (!mediaId) continue;

				const contentRecord = this.toRecord(itemRecord.content);
				const newsItemList = contentRecord?.news_item;
				if (!Array.isArray(newsItemList) || newsItemList.length === 0) continue;
				const firstNewsItem = this.toRecord(newsItemList[0]);
				if (!firstNewsItem) continue;

				const updateTime = this.toNumber(itemRecord.update_time);
				result.push({
					id: mediaId,
					title: this.pickString(firstNewsItem, "title") ?? mediaId,
					content: this.pickString(firstNewsItem, "content") ?? "",
					status: "draft",
					publishedAt: updateTime ? updateTime * 1000 : undefined,
				});
			}

			return result;
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		const publishId = articleId.trim();
		if (!publishId) return null;

		try {
			const statusSnapshot = await this.getPublishStatus(publishId);
			const detail = this.extractFirstArticleDetail(statusSnapshot.payload);
			if (!detail) return null;

			const publishTimeSeconds = this.toNumber(detail.publish_time);
			return {
				id: publishId,
				title: this.pickString(detail, "title") ?? publishId,
				content: this.pickString(detail, "content") ?? "",
				status: statusSnapshot.state === "success" ? "published" : "draft",
				publishedAt: publishTimeSeconds ? publishTimeSeconds * 1000 : undefined,
			};
		} catch {
			return null;
		}
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
				const uploadedUrl = await this.uploadContentImageBySourceUrl(normalized);
				return { success: true, url: uploadedUrl, message: "Image uploaded successfully" };
			}

			const source = normalized?.startsWith("data:")
				? normalized
				: `data:image/jpeg;base64,${imageData.trim()}`;
			const uploadedUrl = await this.uploadContentImageBySourceUrl(source);
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
