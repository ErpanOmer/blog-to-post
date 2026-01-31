import { AbstractAccountService } from "./abstract";
import { registerAccountService } from "./index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult, ZhihuUserInfo } from "./index";

export default class ZhihuAccountService extends AbstractAccountService {
	constructor(authToken: string) {
		super("zhihu", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Cookie": this.authToken
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const data = await this.request<ZhihuUserInfo>(
				"https://www.zhihu.com/api/v4/me?include=is_realname",
			);

			return {
				valid: true,
				message: "验证成功",
				accountInfo: {
					id: data.uid,
					name: data.name,
					avatar: data.avatar_url,
					isLogin: true,
					isRealname: data.is_realname,
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
		const data = await this.request<ZhihuUserInfo>(
			"https://www.zhihu.com/api/v4/me?include=is_realname",
		);

		return {
			id: data.uid,
			name: data.name,
			avatar: data.avatar_url,
			isLogin: true,
			isRealname: data.is_realname,
		};
	}

	async articleDraft(): Promise<ArticleDraft | null> {
		return null;
	}

	async articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult> {
		try {
			const data = await this.request<{ id: string }>(
				"https://www.zhihu.com/api/v4/articles",
				{
					method: "POST",
					body: JSON.stringify({
						title,
						content,
						cover_image: coverImage,
					}),
				},
			);

			return {
				success: true,
				articleId: data.id,
				message: "发布成功",
				url: `https://zhuanlan.zhihu.com/p/${data.id}`,
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : "发布失败",
			};
		}
	}

	async articleDelete(_articleId: string): Promise<{ success: boolean; message: string }> {
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

	async articleTags(_articleId: string): Promise<string[]> {
		return [];
	}

	async imageUpload(_imageData: string, _filename?: string): Promise<ImageUploadResult> {
		return { success: false, message: "暂不支持图片上传" };
	}
}

registerAccountService("zhihu", ZhihuAccountService);
