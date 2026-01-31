import { AbstractAccountService } from "./abstract";
import { registerAccountService } from "./index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult } from "./index";

export default class WechatAccountService extends AbstractAccountService {
	private accessToken: string;

	constructor(authToken: string) {
		super("wechat", authToken);
		this.accessToken = authToken;
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const data = await this.request<{ errcode: number; errmsg: string; openid: string; nickname: string; headimgurl: string }>(
				`https://api.weixin.qq.com/cgi-bin/user/info?access_token=${this.accessToken}&openid=OPENID`,
			);

			if (data.errcode !== 0) {
				return { valid: false, message: data.errmsg };
			}

			return {
				valid: true,
				message: "验证成功",
				accountInfo: {
					id: data.openid,
					name: data.nickname,
					avatar: data.headimgurl,
					isLogin: true,
				},
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
		const data = await this.request<{ errcode: number; openid: string; nickname: string; headimgurl: string }>(
			`https://api.weixin.qq.com/cgi-bin/user/info?access_token=${this.accessToken}&openid=OPENID`,
		);

		return {
			id: data.openid,
			name: data.nickname,
			avatar: data.headimgurl,
			isLogin: data.errcode === 0,
		};
	}

	async articleDraft(): Promise<ArticleDraft | null> {
		return null;
	}

	async articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult> {
		try {
			const data = await this.request<{ errcode: number; errmsg: string; media_id: string }>(
				`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${this.accessToken}`,
				{
					method: "POST",
					body: JSON.stringify({
						title,
						content,
						thumb_media_id: coverImage,
					}),
				},
			);

			if (data.errcode !== 0) {
				return { success: false, message: data.errmsg };
			}

			return {
				success: true,
				articleId: data.media_id,
				message: "发布成功",
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "发布失败",
			};
		}
	}

	async articleDelete(articleId: string): Promise<{ success: boolean; message: string }> {
		try {
			const data = await this.request<{ errcode: number; errmsg: string }>(
				`https://api.weixin.qq.com/cgi-bin/draft/delete?access_token=${this.accessToken}`,
				{
					method: "POST",
					body: JSON.stringify({ media_id: articleId }),
				},
			);

			if (data.errcode !== 0) {
				return { success: false, message: data.errmsg };
			}

			return { success: true, message: "删除成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "删除失败" };
		}
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		try {
			const data = await this.request<{ errcode: number; item: Array<{ media_id: string; content: { news_item: Array<{ title: string; digest: string; update_time: number }> } }> }>(
				`https://api.weixin.qq.com/cgi-bin/draft/list?access_token=${this.accessToken}&offset=${(page - 1) * pageSize}&count=${pageSize}`,
			);

			if (data.errcode !== 0) return [];

			const articles: Article[] = [];
			for (const item of data.item || []) {
				for (const news of item.content.news_item || []) {
					articles.push({
						id: item.media_id,
						title: news.title,
						content: news.digest,
						publishedAt: news.update_time,
						status: "draft" as const,
					});
				}
			}

			return articles;
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const data = await this.request<{ errcode: number; content: { news_item: Array<{ title: string; content: string; update_time: number }> } }>(
				`https://api.weixin.qq.com/cgi-bin/draft/get?access_token=${this.accessToken}&media_id=${articleId}`,
			);

			if (data.errcode !== 0 || !data.content.news_item?.[0]) {
				return null;
			}

			const news = data.content.news_item[0];
			return {
				id: articleId,
				title: news.title,
				content: news.content,
				publishedAt: news.update_time,
				status: "draft",
			};
		} catch {
			return null;
		}
	}

	async articleTags(_articleId: string): Promise<string[]> {
		return [];
	}

	async imageUpload(imageData: string, _filename?: string): Promise<ImageUploadResult> {
		try {
			const formData = new FormData();
			formData.append("media", imageData);
			formData.append("type", "image");

			const data = await this.request<{ errcode: number; errmsg: string; url: string }>(
				`https://api.weixin.qq.com/cgi-bin/media/upload?access_token=${this.accessToken}&type=image`,
				{
					method: "POST",
					body: formData,
				},
			);

			if (data.errcode !== 0) {
				return { success: false, message: data.errmsg };
			}

			return { success: true, url: data.url, message: "上传成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "上传失败" };
		}
	}
}

registerAccountService("wechat", WechatAccountService);
