import { describe, expect, it, vi } from "vitest";
import type { Article } from "@/shared/types";
import CSDNAccountService from "@/worker/accounts/csdn";
import CnblogsAccountService from "@/worker/accounts/cnblogs";
import Cto51AccountService from "@/worker/accounts/cto51";
import JuejinAccountService from "@/worker/accounts/juejin";
import SegmentFaultAccountService from "@/worker/accounts/segmentfault";
import WechatAccountService from "@/worker/accounts/wechat";
import ZhihuAccountService from "@/worker/accounts/zhihu";
import {
	applyMarkdownContentSlots,
	FOOTER_SLOT_PLACEHOLDER,
	restoreFooterImageScanPlaceholderInHtml,
} from "./content-slots";

const footerMarkdown = `---

### 📮 微信公众号

扫码关注。

<p align="center">
  <img src="https://example.com/wechat-qr.svg" alt="微信公众号二维码" width="180" />
</p>`;

function createArticle(overrides: Partial<Article> = {}): Article {
	return {
		id: "article-1",
		title: "测试文章",
		content: "正文",
		platform: "juejin",
		status: "draft",
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

describe("applyMarkdownContentSlots", () => {
	it("在正文没有 FOOTER_SLOT 时仅在结尾追加一次", () => {
		const rendered = applyMarkdownContentSlots(
			"正文",
			createArticle({ contentSlots: { footerMarkdown } }),
		);

		expect(rendered).toBe(`正文\n\n${footerMarkdown}`);
		expect(rendered.split(footerMarkdown)).toHaveLength(2);
	});

	it("在显式 FOOTER_SLOT 位置替换而不重复追加", () => {
		const rendered = applyMarkdownContentSlots(
			`开头\n\n${FOOTER_SLOT_PLACEHOLDER}\n\n结尾`,
			createArticle({ contentSlots: { footerMarkdown } }),
		);

		expect(rendered).toBe(`开头\n\n${footerMarkdown}\n\n结尾`);
		expect(rendered).not.toContain(FOOTER_SLOT_PLACEHOLDER);
		expect(rendered.split(footerMarkdown)).toHaveLength(2);
	});

	it("在 Footer 为空时保留正文", () => {
		expect(applyMarkdownContentSlots("正文", createArticle())).toBe("正文");
	});

	it("在 HTML 中恢复 Footer 时不嵌套额外段落", () => {
		const placeholder = "{{TEST_FOOTER_SLOT_IMAGE_SCAN_EXCLUDED}}";
		const footerHtml = "<hr><p><img src=\"https://example.com/footer.png\" /></p>";

		expect(restoreFooterImageScanPlaceholderInHtml(
			`<p>正文</p><p>${placeholder}</p>`,
			placeholder,
			footerHtml,
		)).toBe(`<p>正文</p>${footerHtml}`);
	});

	it("掷金仅扫描正文图片，不上传固定 Footer 中的二维码", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "https://p0-xtjj-private.juejin.cn/wechat-qr.webp";
		const uploadedArticleImage = "https://p0-xtjj-private.juejin.cn/article-image.webp";
		const service = new JuejinAccountService("sessionid=test-only") as unknown as {
			resolveArticleMarkdown(article: Article): Promise<string>;
			uploadImageBySourceUrl(source: string): Promise<string>;
			verifyExistingPlatformImage(source: string): Promise<void>;
		};
		const uploadImageBySourceUrl = vi.fn(async () => uploadedArticleImage);
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadImageBySourceUrl = uploadImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const rendered = await service.resolveArticleMarkdown(createArticle({
			content: `正文\n\n![正文图](${articleImage})`,
			contentSlots: {
				footerMarkdown: `---\n\n<p align="center"><img src="${footerImage}" alt="微信公众号二维码" /></p>`,
			},
		}));

		expect(uploadImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(rendered).toContain(uploadedArticleImage);
		expect(rendered).toContain(footerImage);
	});

	it("SegmentFault 仅扫描正文图片，保留固定 Footer 的相对图床路径", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "/img/bVdqpix";
		const uploadedArticleImage = "https://image-static.segmentfault.com/article-image.webp";
		const service = new SegmentFaultAccountService("token=test-only") as unknown as {
			resolveArticleContent(article: Article): Promise<{ markdownContent: string }>;
			uploadImageBySourceUrl(source: string): Promise<{ contentUrl: string; coverUrl: string }>;
			verifyExistingPlatformImage(source: string): Promise<void>;
		};
		const uploadImageBySourceUrl = vi.fn(async () => ({
			contentUrl: uploadedArticleImage,
			coverUrl: uploadedArticleImage,
		}));
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadImageBySourceUrl = uploadImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const content = await service.resolveArticleContent(createArticle({
			platform: "segmentfault",
			content: `正文\n\n![正文图](${articleImage})`,
			contentSlots: { footerMarkdown: `---\n\n![](${footerImage})` },
		}));

		expect(uploadImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(content.markdownContent).toContain(uploadedArticleImage);
		expect(content.markdownContent).toContain(`![](${footerImage})`);
	});

	it("CSDN 仅处理正文图片，不扫描固定 Footer 图片", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "https://example.com/footer.png";
		const uploadedArticleImage = "https://img-blog.csdnimg.cn/article.png";
		const service = new CSDNAccountService("cookie=test-only") as unknown as {
			resolveArticleContent(article: Article): Promise<{ markdownContent: string; htmlContent: string }>;
			uploadImageBySourceUrl(source: string): Promise<string>;
			verifyExistingPlatformImage(source: string): Promise<void>;
		};
		const uploadImageBySourceUrl = vi.fn(async () => uploadedArticleImage);
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadImageBySourceUrl = uploadImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const content = await service.resolveArticleContent(createArticle({
			platform: "csdn",
			content: `正文\n\n![正文图](${articleImage})`,
			htmlContent: `<p><img src="${articleImage}" /></p>`,
			contentSlots: {
				footerMarkdown: `---\n\n![Footer 图](${footerImage})`,
				footerHtml: `<p><img src="${footerImage}" /></p>`,
			},
		}));

		expect(uploadImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(content.markdownContent).toContain(footerImage);
		expect(content.htmlContent).toContain(footerImage);
	});

	it("51CTO 仅处理正文图片，不扫描固定 Footer 图片", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "https://example.com/footer.png";
		const uploadedArticleImage = "https://image.51cto.com/article.png";
		const service = new Cto51AccountService("cookie=test-only") as unknown as {
			resolveArticleContent(article: Article): Promise<{ markdownContent: string }>;
			uploadImageBySourceUrl(source: string): Promise<string>;
			verifyExistingPlatformImage(source: string): Promise<void>;
		};
		const uploadImageBySourceUrl = vi.fn(async () => uploadedArticleImage);
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadImageBySourceUrl = uploadImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const content = await service.resolveArticleContent(createArticle({
			platform: "51cto",
			content: `正文\n\n![正文图](${articleImage})`,
			contentSlots: { footerMarkdown: `---\n\n![Footer 图](${footerImage})` },
		}));

		expect(uploadImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(content.markdownContent).toContain(footerImage);
	});

	it("博客园仅处理正文图片，不扫描固定 Footer 图片", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "https://example.com/footer.png";
		const uploadedArticleImage = "https://img.cnblogs.com/article.png";
		const service = new CnblogsAccountService("cookie=test-only") as unknown as {
			resolveArticleContent(article: Article): Promise<{ markdownContent: string }>;
			uploadImageBySourceUrl(source: string): Promise<string>;
			verifyExistingPlatformImage(source: string): Promise<void>;
		};
		const uploadImageBySourceUrl = vi.fn(async () => uploadedArticleImage);
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadImageBySourceUrl = uploadImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const content = await service.resolveArticleContent(createArticle({
			platform: "cnblogs",
			content: `正文\n\n![正文图](${articleImage})`,
			contentSlots: { footerMarkdown: `---\n\n![Footer 图](${footerImage})` },
		}));

		expect(uploadImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(content.markdownContent).toContain(footerImage);
	});

	it("知乎转换正文时不会把 Footer 交给图片处理流程", async () => {
		const footerImage = "https://example.com/footer.png";
		const footerMarkdown = `---\n\n![Footer 图](${footerImage})`;
		const service = new ZhihuAccountService("cookie=test-only") as unknown as {
			resolveArticleHtml(article: Article): Promise<string>;
			convertMarkdownToHtmlViaAPI(markdown: string): Promise<string>;
			replaceHtmlImageUrls(html: string): Promise<string>;
		};
		const convertMarkdownToHtmlViaAPI = vi.fn(async (markdown: string) => {
			const placeholder = markdown.match(/\{\{ZHIHU_FOOTER_SLOT_IMAGE_SCAN_EXCLUDED[^}]*\}\}/)?.[0];
			if (placeholder) return `<p>正文</p><p>${placeholder}</p>`;
			return `<p><img src="${footerImage}" /></p>`;
		});
		const replaceHtmlImageUrls = vi.fn(async (html: string) => html);
		service.convertMarkdownToHtmlViaAPI = convertMarkdownToHtmlViaAPI;
		service.replaceHtmlImageUrls = replaceHtmlImageUrls;

		const html = await service.resolveArticleHtml(createArticle({
			platform: "zhihu",
			content: "正文",
			contentSlots: { footerMarkdown },
		}));

		expect(convertMarkdownToHtmlViaAPI).toHaveBeenCalledTimes(2);
		expect(convertMarkdownToHtmlViaAPI.mock.calls[0]?.[0]).not.toContain(footerImage);
		expect(replaceHtmlImageUrls.mock.calls[0]?.[0]).not.toContain(footerImage);
		expect(html).toContain(footerImage);
		expect(html).not.toContain("<p><p>");
	});

	it("公众号不上传或选择固定 Footer 图作为封面", async () => {
		const articleImage = "https://example.com/article.png";
		const footerImage = "https://example.com/footer.png";
		const uploadedArticleImage = "https://mmbiz.qpic.cn/article.png";
		const service = new WechatAccountService("appId=test-app-id\nappSecret=test-secret") as unknown as {
			resolveArticleHtml(article: Article): Promise<{ htmlContent: string; contentHtmlForCover: string }>;
			uploadContentImageBySourceUrl(source: string): Promise<string>;
			verifyExistingPlatformImage(source: string): Promise<void>;
			collectCoverCandidates(article: Article, html: string): string[];
		};
		const uploadContentImageBySourceUrl = vi.fn(async () => uploadedArticleImage);
		const verifyExistingPlatformImage = vi.fn(async () => undefined);
		service.uploadContentImageBySourceUrl = uploadContentImageBySourceUrl;
		service.verifyExistingPlatformImage = verifyExistingPlatformImage;

		const article = createArticle({
			platform: "wechat",
			content: `![正文图](${articleImage})`,
			htmlContent: `<p><img src="${articleImage}" /></p>`,
			contentSlots: { footerHtml: `<p><img src="${footerImage}" /></p>` },
		});
		const resolved = await service.resolveArticleHtml(article);

		expect(uploadContentImageBySourceUrl).toHaveBeenCalledTimes(1);
		expect(uploadContentImageBySourceUrl).toHaveBeenCalledWith(articleImage);
		expect(verifyExistingPlatformImage).not.toHaveBeenCalled();
		expect(resolved.htmlContent).toContain(footerImage);
		expect(service.collectCoverCandidates(article, resolved.contentHtmlForCover)).toEqual([articleImage]);
	});
});
