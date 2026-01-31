import { AbstractAccountService } from "./abstract";
import { registerAccountService } from "./index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult, JuejinUserInfo } from "./index";

export default class JuejinAccountService extends AbstractAccountService {
	constructor(authToken: string) {
		super("juejin", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Authorization": `Bearer ${this.authToken}`,
			"Content-Type": "application/json",
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const data = await this.request<{ data: JuejinUserInfo }>(
				"https://api.juejin.cn/user_api/v1/user/me",
			);

			return {
				valid: true,
				message: "验证成功",
				accountInfo: {
					id: data.data.user_id,
					name: data.data.user_name,
					avatar: data.data.avatar,
					isLogin: true,
					isRealname: data.data.is_realname === 1,
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
		const data = await this.request<{ data: JuejinUserInfo }>(
			"https://api.juejin.cn/user_api/v1/user/me",
		);

		return {
			id: data.data.user_id,
			name: data.data.user_name,
			avatar: data.data.avatar,
			isLogin: true,
			isRealname: data.data.is_realname === 1,
		};
	}

	async articleDraft(): Promise<ArticleDraft | null> {
		try {
			const data = await this.request<{ data: { article_id: string; title: string; content: string; ctime: number } }>(
				"https://api.juejin.cn/user_api/v1/draft/list?size=1",
			);

			if (!data.data) return null;

			return {
				id: data.data.article_id,
				title: data.data.title,
				content: data.data.content,
				createdAt: data.data.ctime,
			};
		} catch {
			return null;
		}
	}

	async articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult> {
		try {
			const data = await this.request<{ data: { article_id: string } }>(
				"https://api.juejin.cn/user_api/v1/article/publish",
				{
					method: "POST",
					body: JSON.stringify({
						title,
						content,
						cover_image: coverImage,
						status: 2,
					}),
				},
			);

			return {
				success: true,
				articleId: data.data.article_id,
				message: "发布成功",
				url: `https://juejin.cn/post/${data.data.article_id}`,
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
			await this.request(
				`https://api.juejin.cn/user_api/v1/article/delete`,
				{
					method: "POST",
					body: JSON.stringify({ article_id: articleId }),
				},
			);
			return { success: true, message: "删除成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "删除失败" };
		}
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		try {
			const data = await this.request<{ data: Array<{ article_id: string; title: string; content: string, ctime: number, status: number }> }>(
				`https://api.juejin.cn/user_api/v1/article/list?page=${page}&size=${pageSize}`,
			);

			return data.data.map((item) => ({
				id: item.article_id,
				title: item.title,
				content: item.content,
				publishedAt: item.ctime,
				status: item.status === 2 ? "published" as const : "draft" as const,
			}));
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const data = await this.request<{ data: { article_id: string; title: string; content: string; ctime: number; status: number } }>(
				`https://api.juejin.cn/user_api/v1/article/detail?article_id=${articleId}`,
			);

			return {
				id: data.data.article_id,
				title: data.data.title,
				content: data.data.content,
				publishedAt: data.data.ctime,
				status: data.data.status === 2 ? "published" : "draft",
			};
		} catch {
			return null;
		}
	}

	async articleTags(articleId: string): Promise<string[]> {
		try {
			const data = await this.request<{ data: string[] }>(
				`https://api.juejin.cn/user_api/v1/article/tags?article_id=${articleId}`,
			);
			return data.data || [];
		} catch {
			return [];
		}
	}

	async imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult> {
		try {
			const data = await this.request<{ data: { url: string } }>(
				"https://api.juejin.cn/media_api/v1/image/upload",
				{
					method: "POST",
					body: JSON.stringify({ file: imageData, name: filename }),
				},
			);

			return { success: true, url: data.data.url, message: "上传成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "上传失败" };
		}
	}
}

registerAccountService("juejin", JuejinAccountService);
