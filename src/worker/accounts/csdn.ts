import { AbstractAccountService } from "./abstract";
import { registerAccountService } from "./index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult, CSDNUserInfo } from "./index";

export default class CSDNAccountService extends AbstractAccountService {
	constructor(authToken: string) {
		super("csdn", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Authorization": `Bearer ${this.authToken}`,
			"Content-Type": "application/json",
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const data = await this.request<{ data: CSDNUserInfo }>(
				"https://api.csdn.net/user/api/getUserInfo",
			);

			return {
				valid: true,
				message: "验证成功",
				accountInfo: {
					id: data.data.userName,
					name: data.data.userName,
					avatar: data.data.avatar,
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
		const data = await this.request<{ data: CSDNUserInfo }>(
			"https://api.csdn.net/user/api/getUserInfo",
		);

		return {
			id: data.data.userName,
			name: data.data.userName,
			avatar: data.data.avatar,
			isLogin: true,
		};
	}

	async articleDraft(): Promise<ArticleDraft | null> {
		return null;
	}

	async articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult> {
		try {
			const data = await this.request<{ code: number; data: { id: string }; msg: string }>(
				"https://api.csdn.net/user/api/article/publish",
				{
					method: "POST",
					body: JSON.stringify({
						title,
						content,
						cover: coverImage,
						status: "published",
					}),
				},
			);

			if (data.code !== 200) {
				return { success: false, message: data.msg };
			}

			return {
				success: true,
				articleId: data.data.id,
				message: "发布成功",
				url: `https://blog.csdn.net/${data.data.id}`,
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
			const data = await this.request<{ code: number; msg: string }>(
				`https://api.csdn.net/user/api/article/delete/${articleId}`,
				{ method: "DELETE" },
			);

			if (data.code !== 200) {
				return { success: false, message: data.msg };
			}

			return { success: true, message: "删除成功" };
		} catch (error) {
			return { success: false, message: error instanceof Error ? error.message : "删除失败" };
		}
	}

	async articleList(page = 1, pageSize = 10): Promise<Article[]> {
		try {
			const data = await this.request<{ data: Array<{ id: string; title: string; description: string; create_time: number; status: number }> }>(
				`https://api.csdn.net/user/api/articles?page=${page}&size=${pageSize}`,
			);

			return data.data.map((item) => ({
				id: item.id,
				title: item.title,
				content: item.description,
				publishedAt: item.create_time,
				status: item.status === 1 ? "published" as const : "draft" as const,
			}));
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const data = await this.request<{ data: { id: string; title: string; content: string; create_time: number; status: number } }>(
				`https://api.csdn.net/user/api/article/${articleId}`,
			);

			return {
				id: data.data.id,
				title: data.data.title,
				content: data.data.content,
				publishedAt: data.data.create_time,
				status: data.data.status === 1 ? "published" : "draft",
			};
		} catch {
			return null;
		}
	}

	async articleTags(articleId: string): Promise<string[]> {
		try {
			const data = await this.request<{ data: string[] }>(
				`https://api.csdn.net/user/api/article/tags/${articleId}`,
			);
			return data.data || [];
		} catch {
			return [];
		}
	}

	async imageUpload(_imageData: string, _filename?: string): Promise<ImageUploadResult> {
		return { success: false, message: "暂不支持图片上传" };
	}
}

registerAccountService("csdn", CSDNAccountService);
