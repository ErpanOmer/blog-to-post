import type { Env } from "@/worker/types";
import WechatAccountService from "@/worker/accounts/wechat";
import { registerAccountService } from "@/worker/accounts/registry";

// Same origin as the private constant inside wechat.ts; v2 rewrites this prefix only.
const WECHAT_API_ORIGIN = "https://api.weixin.qq.com";
const DEFAULT_WECHAT_RELAY_BASE_URL = "http://192.9.132.160";

/**
 * wechat_v2 reuses the entire WeChat adapter (article processing, image pipeline,
 * token refresh, retries, tracing) and only redirects api.weixin.qq.com traffic
 * through a self-hosted relay so WeChat always sees the relay's fixed egress IP.
 */
export default class WechatV2AccountService extends WechatAccountService {
	constructor(authToken: string, env?: Env) {
		super(authToken);
		this.platform = "wechat_v2";
		this.env = env;
	}

	protected override async request<T>(url: string, options: RequestInit = {}): Promise<T> {
		const relayUrl = this.rewriteWechatApiUrlToRelay(url);
		return await super.request<T>(relayUrl, this.withRelayAuth(options));
	}

	private rewriteWechatApiUrlToRelay(url: string): string {
		if (!url.startsWith(WECHAT_API_ORIGIN)) return url;
		const configured = (this.env?.WECHAT_RELAY_BASE_URL ?? "").trim();
		const relayBase = (configured || DEFAULT_WECHAT_RELAY_BASE_URL).replace(/\/+$/, "");
		return `${relayBase}${url.slice(WECHAT_API_ORIGIN.length)}`;
	}

	private relayToken(): string {
		const token = (this.env?.WECHAT_RELAY_API_KEY ?? "").trim();
		if (!token) {
			throw new Error("公众号V2缺少 WECHAT_RELAY_API_KEY 环境变量，无法通过固定出口转发服务器调用微信接口");
		}
		return token;
	}

	// The base class merges headers with object spread, which would drop a
	// Headers instance, so normalize to a plain record before injecting auth.
	private withRelayAuth(options: RequestInit): RequestInit {
		const source = options.headers;
		const headers: Record<string, string> = {};
		if (source instanceof Headers) {
			source.forEach((value, key) => {
				headers[key] = value;
			});
		} else if (Array.isArray(source)) {
			for (const [key, value] of source) {
				headers[key] = value;
			}
		} else if (source) {
			Object.assign(headers, source);
		}
		headers["x-relay-token"] = this.relayToken();
		return { ...options, headers };
	}
}

registerAccountService("wechat_v2", WechatV2AccountService);
