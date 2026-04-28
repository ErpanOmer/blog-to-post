export interface MarkdownImageNormalizeOptions {
	normalizeUrl?: (rawUrl: string) => string | null;
	resolveUrl?: (normalizedUrl: string) => string | null | undefined;
	defaultAlt?: string;
}

function decodeHtmlEntities(value: string): string {
	const namedEntities: Record<string, string> = {
		amp: "&",
		lt: "<",
		gt: ">",
		quot: "\"",
		apos: "'",
		nbsp: " ",
	};

	return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
		const lowerEntity = entity.toLowerCase();
		if (lowerEntity.startsWith("#x")) {
			const codePoint = Number.parseInt(lowerEntity.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		if (lowerEntity.startsWith("#")) {
			const codePoint = Number.parseInt(lowerEntity.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		return namedEntities[lowerEntity] ?? match;
	});
}

function stripHtmlTags(value: string): string {
	return decodeHtmlEntities(value.replace(/<[^>]+>/g, "")).trim();
}

function getHtmlAttribute(tag: string, name: string): string | null {
	const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp("\\b" + escapedName + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))", "i");
	const match = tag.match(regex);
	const value = match?.[1] ?? match?.[2] ?? match?.[3];
	return value ? decodeHtmlEntities(value) : null;
}

function unwrapMarkdownDestination(destination: string): string {
	const trimmed = destination.trim();
	if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function escapeMarkdownImageAlt(value: string): string {
	return value
		.replace(/\r?\n/g, " ")
		.replace(/\\/g, "\\\\")
		.replace(/\[/g, "\\[")
		.replace(/\]/g, "\\]");
}

function sanitizeMarkdownImageUrl(value: string): string {
	return value.trim().replace(/[<>\s()]/g, (char) => encodeURIComponent(char));
}

export function formatPlainMarkdownImage(alt: string | null | undefined, url: string): string {
	const safeAlt = escapeMarkdownImageAlt((alt || "image").trim() || "image");
	return `![${safeAlt}](${sanitizeMarkdownImageUrl(url)})`;
}

function resolveMarkdownImageUrl(
	rawUrl: string,
	options: MarkdownImageNormalizeOptions = {},
): string | null {
	const unwrapped = unwrapMarkdownDestination(rawUrl);
	const normalized = options.normalizeUrl ? options.normalizeUrl(unwrapped) : unwrapped.trim();
	if (!normalized) return null;
	return options.resolveUrl?.(normalized) || normalized;
}

export function normalizeMarkdownImageSyntax(
	markdownContent: string,
	options: MarkdownImageNormalizeOptions = {},
): string {
	if (!markdownContent) return markdownContent;

	return markdownContent.replace(
		/!\[([^\]]*)\]\(\s*(<[^>\r\n]+>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
		(fullMatch, alt: string, src: string) => {
			const resolvedUrl = resolveMarkdownImageUrl(src, options);
			if (!resolvedUrl) return fullMatch;
			return formatPlainMarkdownImage(alt || options.defaultAlt, resolvedUrl);
		},
	);
}

export function convertHtmlImagesToMarkdown(
	content: string,
	options: MarkdownImageNormalizeOptions = {},
): string {
	if (!content) return content;

	return content.replace(/<img\b[^>]*>/gi, (tag) => {
		const rawSrc = getHtmlAttribute(tag, "src");
		if (!rawSrc) return tag;

		const resolvedUrl = resolveMarkdownImageUrl(rawSrc, options);
		if (!resolvedUrl) return tag;

		const alt = getHtmlAttribute(tag, "alt")
			|| getHtmlAttribute(tag, "title")
			|| options.defaultAlt;
		return formatPlainMarkdownImage(alt, resolvedUrl);
	});
}

function protectFencedCodeBlocks(content: string): {
	content: string;
	restore: (value: string) => string;
} {
	const blocks: string[] = [];
	const protectedContent = content.replace(/```[\s\S]*?```/g, (block) => {
		const token = `@@BLOG_TO_POST_MD_CODE_BLOCK_${blocks.length}@@`;
		blocks.push(block);
		return token;
	});

	return {
		content: protectedContent,
		restore: (value) => value.replace(/@@BLOG_TO_POST_MD_CODE_BLOCK_(\d+)@@/g, (_match, index: string) => {
			return blocks[Number.parseInt(index, 10)] ?? "";
		}),
	};
}

export function convertHtmlTagsToMarkdown(
	content: string,
	options: MarkdownImageNormalizeOptions = {},
): string {
	if (!content) return content;

	const protectedBlocks = protectFencedCodeBlocks(content);
	let output = protectedBlocks.content;

	output = output.replace(
		/<pre\b[^>]*>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi,
		(_match, codeAttrs: string, rawCode: string) => {
			const className = getHtmlAttribute(`<code ${codeAttrs}>`, "class") ?? "";
			const language = className.match(/(?:language|lang)-([\w-]+)/i)?.[1] ?? "";
			const code = stripHtmlTags(rawCode).replace(/\n{3,}/g, "\n\n");
			return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
		},
	);

	output = convertHtmlImagesToMarkdown(output, options);
	output = output.replace(/<br\s*\/?>/gi, "\n");
	output = output.replace(/<hr\b[^>]*\/?>/gi, "\n\n---\n\n");

	output = output.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, text: string) => {
		return `\n\n${"#".repeat(Number.parseInt(level, 10))} ${stripHtmlTags(text)}\n\n`;
	});

	output = output.replace(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, text: string) => {
		const label = stripHtmlTags(text) || href;
		return `[${label}](${sanitizeMarkdownImageUrl(decodeHtmlEntities(href))})`;
	});

	output = output.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag: string, text: string) => {
		return `**${stripHtmlTags(text)}**`;
	});
	output = output.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_match, _tag: string, text: string) => {
		return `*${stripHtmlTags(text)}*`;
	});
	output = output.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_match, text: string) => {
		const code = stripHtmlTags(text).replace(/`/g, "\\`");
		return `\`${code}\``;
	});

	output = output.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, text: string) => {
		return `\n\n${stripHtmlTags(text).split(/\r?\n/).map((line) => `> ${line}`).join("\n")}\n\n`;
	});
	output = output.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_match, text: string) => {
		return `\n- ${stripHtmlTags(text)}`;
	});
	output = output.replace(/<\/?(ul|ol)\b[^>]*>/gi, "\n");
	output = output.replace(/<(p|div|section|article|header|footer|figure|figcaption)\b[^>]*>/gi, "\n\n");
	output = output.replace(/<\/(p|div|section|article|header|footer|figure|figcaption)>/gi, "\n\n");
	output = output.replace(/<[^>]+>/g, "");
	output = decodeHtmlEntities(output);
	output = output.replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();

	return protectedBlocks.restore(output);
}
