import type { Article, PublishContentSlots } from "@/shared/types";

export const HEADER_SLOT_PLACEHOLDER = "{{HEADER_SLOT}}";
export const FOOTER_SLOT_PLACEHOLDER = "{{FOOTER_SLOT}}";

export interface NormalizedPublishContentSlots {
	useCoverImageAsHeader: boolean;
	headerMarkdown: string;
	headerHtml: string;
	footerMarkdown: string;
	footerHtml: string;
}

export interface ApplyContentSlotsOptions {
	headerPlaceholders?: string[];
	footerPlaceholders?: string[];
	defaultHeaderMarkdown?: string;
	defaultHeaderHtml?: string;
	defaultFooterMarkdown?: string;
	defaultFooterHtml?: string;
}

export function normalizePublishContentSlots(
	contentSlots: PublishContentSlots | null | undefined,
): NormalizedPublishContentSlots {
	const headerSlot = contentSlots?.headerSlot?.trim() ?? "";
	const footerSlot = contentSlots?.footerSlot?.trim() ?? "";
	return {
		useCoverImageAsHeader: contentSlots?.useCoverImageAsHeader ?? false,
		headerMarkdown: contentSlots?.headerMarkdown?.trim() ?? headerSlot,
		headerHtml: contentSlots?.headerHtml?.trim() ?? headerSlot,
		footerMarkdown: contentSlots?.footerMarkdown?.trim() ?? footerSlot,
		footerHtml: contentSlots?.footerHtml?.trim() ?? footerSlot,
	};
}

function escapeHtmlAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeMarkdownImageAlt(value: string): string {
	return value
		.replace(/\r?\n/g, " ")
		.replace(/\\/g, "\\\\")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]");
}

function hasAnyPlaceholder(content: string, placeholders: string[]): boolean {
	return placeholders.some((placeholder) => content.includes(placeholder));
}

function replacePlaceholders(content: string, placeholders: string[], value: string): string {
	let output = content;
	for (const placeholder of placeholders) {
		output = output.split(placeholder).join(value);
	}
	return output;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds an otherwise inert marker so a fixed footer can be restored after a
 * platform has finished scanning and rewriting only article-owned images.
 */
export function createFooterImageScanPlaceholder(
	sourceContent: string,
	footerContent: string,
	platform: string,
): string {
	const normalizedPlatform = platform
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "") || "CONTENT";
	const prefix = `{{${normalizedPlatform}_FOOTER_SLOT_IMAGE_SCAN_EXCLUDED`;
	let suffix = 0;
	let placeholder = `${prefix}}}`;
	while (sourceContent.includes(placeholder) || footerContent.includes(placeholder)) {
		suffix += 1;
		placeholder = `${prefix}_${suffix}}}`;
	}
	return placeholder;
}

/**
 * Restore a deferred footer in HTML without nesting its block markup inside a
 * paragraph emitted by a Markdown-to-HTML converter.
 */
export function restoreFooterImageScanPlaceholderInHtml(
	htmlContent: string,
	placeholder: string,
	footerHtml: string,
): string {
	if (!placeholder) return htmlContent;
	const standaloneParagraph = new RegExp(
		`<p\\b[^>]*>\\s*${escapeRegExp(placeholder)}\\s*<\\/p>`,
		"gi",
	);
	return htmlContent
		.replace(standaloneParagraph, footerHtml)
		.split(placeholder)
		.join(footerHtml);
}

export function buildDefaultHeaderSlotMarkdown(article: Article): string {
	const coverImage = article.coverImage?.trim();
	if (!coverImage) return "";
	const alt = escapeMarkdownImageAlt(article.title || "cover");
	return `![${alt}](${coverImage})`;
}

export function buildDefaultHeaderSlotHtml(
	article: Article,
	imageStyle = "display:block;width:100%;max-width:100%;height:auto;border-radius:8px;",
): string {
	const coverImage = article.coverImage?.trim();
	if (!coverImage) return "";

	const safeSrc = escapeHtmlAttribute(coverImage);
	const safeAlt = escapeHtmlAttribute(article.title || "cover");
	return `<figure data-content-slot="header" style="margin:0 0 18px;"><img src="${safeSrc}" alt="${safeAlt}" style="${imageStyle}" /></figure>`;
}

function applySlots(
	content: string,
	params: {
		headerValue: string;
		footerValue: string;
		headerPlaceholders: string[];
		footerPlaceholders: string[];
	},
): string {
	if (!content.trim()) return content;

	let output = content.trim();
	if (params.headerValue && !hasAnyPlaceholder(output, params.headerPlaceholders)) {
		output = `${params.headerPlaceholders[0]}\n\n${output}`;
	}
	if (params.footerValue && !hasAnyPlaceholder(output, params.footerPlaceholders)) {
		output = `${output}\n\n${params.footerPlaceholders[0]}`;
	}

	output = replacePlaceholders(output, params.headerPlaceholders, params.headerValue);
	output = replacePlaceholders(output, params.footerPlaceholders, params.footerValue);
	return output.trim();
}

export function applyMarkdownContentSlots(
	markdownContent: string,
	article: Article,
	options: ApplyContentSlotsOptions = {},
): string {
	const slots = normalizePublishContentSlots(article.contentSlots);
	const headerPlaceholders = options.headerPlaceholders ?? [HEADER_SLOT_PLACEHOLDER];
	const footerPlaceholders = options.footerPlaceholders ?? [FOOTER_SLOT_PLACEHOLDER];
	const defaultHeader = options.defaultHeaderMarkdown
		?? (slots.useCoverImageAsHeader ? buildDefaultHeaderSlotMarkdown(article) : "");
	const defaultFooter = options.defaultFooterMarkdown ?? "";
	const headerValue = slots.useCoverImageAsHeader ? defaultHeader : slots.headerMarkdown;

	return applySlots(markdownContent, {
		headerValue,
		footerValue: slots.footerMarkdown || defaultFooter,
		headerPlaceholders,
		footerPlaceholders,
	});
}

export function applyHtmlContentSlots(
	htmlContent: string,
	article: Article,
	options: ApplyContentSlotsOptions = {},
): string {
	const slots = normalizePublishContentSlots(article.contentSlots);
	const headerPlaceholders = options.headerPlaceholders ?? [HEADER_SLOT_PLACEHOLDER];
	const footerPlaceholders = options.footerPlaceholders ?? [FOOTER_SLOT_PLACEHOLDER];
	const defaultHeader = options.defaultHeaderHtml
		?? (slots.useCoverImageAsHeader ? buildDefaultHeaderSlotHtml(article) : "");
	const defaultFooter = options.defaultFooterHtml ?? "";
	const headerValue = slots.useCoverImageAsHeader ? defaultHeader : slots.headerHtml;

	return applySlots(htmlContent, {
		headerValue,
		footerValue: slots.footerHtml || defaultFooter,
		headerPlaceholders,
		footerPlaceholders,
	});
}
