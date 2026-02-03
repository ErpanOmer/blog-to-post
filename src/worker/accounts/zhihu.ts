import { AbstractAccountService } from "@/worker/accounts/abstract";
import { registerAccountService } from "@/worker/accounts/index";
import type { VerifyResult, AccountStatus, AccountInfo, ArticleDraft, Article, ArticlePublishResult, ImageUploadResult } from "@/worker/accounts/types";
import type { ZhihuUserInfo } from "@/worker/accounts/abstract";
import { marked } from "marked";
import { randomDelay } from "@/worker/utils/helpers";

export default class ZhihuAccountService extends AbstractAccountService {
	/**
	 * 是否使用知乎 API 进行 Markdown 转换
	 * true: 使用知乎官方 API（更兼容，但需要额外请求）
	 * false: 使用本地 marked 库（更快，但可能存在兼容性差异）
	 */
	private useApiConversion: boolean = true;

	constructor(authToken: string, useApiConversion: boolean = true) {
		super("zhihu", authToken);
		this.useApiConversion = useApiConversion;
	}

	protected buildHeaders(): Record<string, string> {
		return {
			"Content-Type": "application/json",
		};
	}

	async verify(): Promise<VerifyResult> {
		try {
			// 直接调用 info() 获取账号信息，无需泛型参数
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
					"cookie": this.authToken,
					"Content-Type": "application/json",
				}
			}
		);

		return {
			id: data.uid,
			name: data.name,
			avatar: data.avatar_url,
			isLogin: true,
			isRealname: data.is_realname,
		};
	}



	/**
	 * 使用 marked 库将 Markdown 转换为 HTML
	 * 配置自定义渲染器以匹配知乎的HTML格式
	 */
	private convertMarkdownToHtml(content: string): string {
		try {
			// 配置自定义渲染器
			const renderer = new marked.Renderer();

			// 自定义标题渲染，添加ID
			renderer.heading = ({ tokens, depth }) => {
				// 从 tokens 中提取纯文本内容
				const text = tokens.map(token => {
					if ('text' in token) {
						return token.text;
					}
					return '';
				}).join('');

				// 生成id：转小写，中文标点替换为-，空格替换为-，移除特殊字符
				const id = text
					.toLowerCase()
					.replace(/[：，。！？、]/g, '-')
					.replace(/\s+/g, '-')
					.replace(/[^\w\u4e00-\u9fa5-]/g, '');

				return `<h${depth} id="${id}">${text}</h${depth}>\n`;
			};

			// 配置marked选项
			marked.setOptions({
				renderer: renderer,
				gfm: true,
				breaks: false,
				pedantic: false
			});

			// 转换Markdown为HTML
			const html = marked.parse(content, {
				async: false,
				gfm: true,
				breaks: false
			}) as string;
			return html;
		} catch (error) {
			console.error('Markdown 转换失败:', error);
			// 如果转换失败，返回原始内容
			return content;
		}
	}

	/**
	 * 使用知乎 API 将 Markdown 转换为 HTML
	 * 这是一个备选方案，使用知乎官方的转换服务，可能比本地转换更兼容
	 * 
	 * @param content Markdown 内容
	 * @returns 转换后的 HTML 内容
	 */
	private async convertMarkdownToHtmlViaAPI(content: string): Promise<string> {
		try {
			const fileBlob = new Blob([content], { type: 'text/markdown' });

			const formdata = new FormData();
			formdata.append("document", fileBlob, "content.md");
			formdata.append("task_id", crypto.randomUUID());
			formdata.append("content_token", "undefined");
			formdata.append("scene", "article");

			const response = await fetch("https://www.zhihu.com/api/v4/document/convert", {
				method: "POST",
				body: formdata,
				redirect: "follow"
			});

			if (!response.ok) {
				const errorText = await response.text();
				console.error(`知乎 Markdown 转换 API 失败: HTTP ${response.status}`, errorText);
				throw new Error(`HTTP ${response.status}`);
			}

			const result = await response.json() as {
				data?: { html_content: string };
				code: number;
				message: string;
			};

			if (result.code !== 0) {
				console.error('知乎 Markdown 转换 API 错误:', result);
				throw new Error(result.message || '未知错误');
			}

			if (!result.data?.html_content) {
				console.error('知乎 Markdown 转换 API 返回空内容:', result);
				throw new Error('API 未返回转换内容');
			}

			return result.data.html_content;
		} catch (error) {
			console.error('知乎 API Markdown 转换失败，降级到本地转换:', error);
			return this.convertMarkdownToHtml(content);
		}
	}

	async articleDraft(title: string, content: string): Promise<ArticleDraft | null> {
		try {
			// 将 Markdown 转换为 HTML（支持本地转换和 API 转换）
			const htmlContent = this.useApiConversion
				? await this.convertMarkdownToHtmlViaAPI(content)
				: this.convertMarkdownToHtml(content);

			// 延迟 3 秒，防止频繁调用 API 被限流
			await randomDelay(2000, 5000);

			const data = await this.request<{ id: string; title: string; content: string; url: string; created: number }>(
				"https://zhuanlan.zhihu.com/api/articles/drafts",
				{
					method: "POST",
					headers: {
						"cookie": this.authToken,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						content: htmlContent,
						title: title,
						table_of_contents: false,
						delta_time: 0,
						can_reward: true
					})
				}
			);

			return {
				id: data.id,
				title: data.title,
				content: data.content,
				url: data.url,
				createdAt: data.created,
			};
		} catch (error) {
			console.error("知乎草稿创建失败:", error);
			return null;
		}
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
