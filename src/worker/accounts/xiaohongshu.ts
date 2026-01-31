import { AbstractAccountService } from "./abstract";
import { registerAccountService } from "./index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult, XiaohongshuUserInfo } from "./index";

export default class XiaohongshuAccountService extends AbstractAccountService {
	constructor(authToken: string) {
		super("xiaohongshu", authToken);
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Authorization": `Bearer ${this.authToken}`,
			"Content-Type": "application/json",
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			const data = await this.request<{ data: XiaohongshuUserInfo }>(
				"https://api.xiaohongshu.com/api/sns/web/v1/user/profile",
			);

			return {
				valid: true,
				message: "验证成功",
				accountInfo: {
					id: data.data.user_id,
					name: data.data.nickname,
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
		const data = await this.request<{ data: XiaohongshuUserInfo }>(
			"https://api.xiaohongshu.com/api/sns/web/v1/user/profile",
		);

		return {
			id: data.data.user_id,
			name: data.data.nickname,
			avatar: data.data.avatar,
			isLogin: true,
		};
	}

	async articleDraft(): Promise<ArticleDraft | null> {
		return null;
	}

	async articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult> {
		try {
			const data = await this.request<{ data: { note_id: string } }>(
				"https://api.xiaohongshu.com/api/sns/web/v1/notes/publish",
				{
					method: "POST",
					body: JSON.stringify({
						title,
						content,
						cover: coverImage,
					}),
				},
			);

			return {
				success: true,
				articleId: data.data.note_id,
				message: "发布成功",
				url: `https://www.xiaohongshu.com/explore/${data.data.note_id}`,
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
			const data = await this.request<{ data: Array<{ note_id: string; title: string; desc: string; time: number }> }>(
				`https://api.xiaohongshu.com/api/sns/web/v1/notes?page=${page}&size=${pageSize}`,
			);

			return data.data.map((item) => ({
				id: item.note_id,
				title: item.title,
				content: item.desc,
				publishedAt: item.time,
				status: "published" as const,
			}));
		} catch {
			return [];
		}
	}

	async articleDetail(articleId: string): Promise<Article | null> {
		try {
			const data = await this.request<{ data: { note_id: string; title: string; content: string; time: number } }>(
				`https://api.xiaohongshu.com/api/sns/web/v1/notes/${articleId}`,
			);

			return {
				id: data.data.note_id,
				title: data.data.title,
				content: data.data.content,
				publishedAt: data.data.time,
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

registerAccountService("xiaohongshu", XiaohongshuAccountService);
