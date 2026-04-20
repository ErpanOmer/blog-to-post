import hljs from "highlight.js/lib/core";
import bashLanguage from "highlight.js/lib/languages/bash";
import cssLanguage from "highlight.js/lib/languages/css";
import handlebarsLanguage from "highlight.js/lib/languages/handlebars";
import javascriptLanguage from "highlight.js/lib/languages/javascript";
import jsonLanguage from "highlight.js/lib/languages/json";
import lessLanguage from "highlight.js/lib/languages/less";
import markdownLanguage from "highlight.js/lib/languages/markdown";
import plaintextLanguage from "highlight.js/lib/languages/plaintext";
import scssLanguage from "highlight.js/lib/languages/scss";
import shellLanguage from "highlight.js/lib/languages/shell";
import sqlLanguage from "highlight.js/lib/languages/sql";
import typescriptLanguage from "highlight.js/lib/languages/typescript";
import xmlLanguage from "highlight.js/lib/languages/xml";
import yamlLanguage from "highlight.js/lib/languages/yaml";

const CODE_BLOCK_REGEX = /<pre\b([^>]*)>\s*<code\b([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi;
const CLASS_ATTR_REGEX = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const STYLE_ATTR_REGEX = /\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const DATA_LANG_ATTR_REGEX = /\bdata-(?:lang|language)\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const LANG_ATTR_REGEX = /\blang(?:uage)?\s*=\s*(?:"([^"]*)"|'([^']*)')/i;
const LANGUAGE_CLASS_REGEX = /^(?:language|lang)-(.+)$/i;

export const FRONTEND_LANGUAGE_ALIAS_MAP: Record<string, string> = {
	js: "javascript",
	javascript: "javascript",
	node: "javascript",
	nodejs: "javascript",
	cjs: "javascript",
	mjs: "javascript",
	jsx: "javascript",
	ts: "typescript",
	typescript: "typescript",
	tsx: "typescript",
	html: "xml",
	htm: "xml",
	xml: "xml",
	svg: "xml",
	vue: "xml",
	css: "css",
	scss: "scss",
	less: "less",
	shell: "shell",
	sh: "shell",
	bash: "bash",
	zsh: "bash",
	fish: "bash",
	json: "json",
	yaml: "yaml",
	yml: "yaml",
	sql: "sql",
	mysql: "sql",
	postgresql: "sql",
	pgsql: "sql",
	postgres: "sql",
	liquid: "handlebars",
	hbs: "handlebars",
	handlebars: "handlebars",
	md: "markdown",
	markdown: "markdown",
	text: "plaintext",
	txt: "plaintext",
	plain: "plaintext",
	plaintext: "plaintext",
};

export const FRONTEND_LANGUAGE_DISPLAY_MAP: Record<string, string> = {
	javascript: "JavaScript",
	typescript: "TypeScript",
	xml: "HTML/XML",
	css: "CSS",
	scss: "SCSS",
	less: "Less",
	shell: "Shell",
	bash: "Bash",
	json: "JSON",
	yaml: "YAML",
	sql: "SQL",
	handlebars: "Liquid/Handlebars",
	markdown: "Markdown",
	plaintext: "Plain Text",
};

export const FRONTEND_AUTO_DETECT_LANGUAGES = [
	"javascript",
	"typescript",
	"xml",
	"css",
	"scss",
	"less",
	"shell",
	"bash",
	"sql",
	"handlebars",
	"json",
	"yaml",
	"markdown",
	"plaintext",
];

export const GITHUB_DARK_TOKEN_STYLE_MAP: Record<string, string> = {
	comment: "color:#8b949e;font-style:italic;",
	quote: "color:#8b949e;font-style:italic;",
	doctag: "color:#8b949e;font-style:italic;",
	keyword: "color:#ff7b72;",
	"selector-tag": "color:#7ee787;",
	"selector-id": "color:#d2a8ff;",
	"selector-class": "color:#d2a8ff;",
	"selector-attr": "color:#79c0ff;",
	"selector-pseudo": "color:#d2a8ff;",
	attr: "color:#79c0ff;",
	name: "color:#79c0ff;",
	tag: "color:#7ee787;",
	type: "color:#ff7b72;",
	title: "color:#d2a8ff;",
	function: "color:#d2a8ff;",
	"function_": "color:#d2a8ff;",
	class_: "color:#ffa657;",
	params: "color:#c9d1d9;",
	built_in: "color:#79c0ff;",
	literal: "color:#79c0ff;",
	number: "color:#79c0ff;",
	symbol: "color:#79c0ff;",
	variable: "color:#ffa657;",
	"template-variable": "color:#ffa657;",
	string: "color:#a5d6ff;",
	regexp: "color:#a5d6ff;",
	subst: "color:#c9d1d9;",
	meta: "color:#8b949e;",
	"meta-keyword": "color:#ff7b72;",
	"meta-string": "color:#a5d6ff;",
	section: "color:#d2a8ff;font-weight:700;",
	bullet: "color:#f2cc60;",
	emphasis: "font-style:italic;",
	strong: "font-weight:700;",
	addition: "color:#3fb950;",
	deletion: "color:#f85149;",
	link: "color:#79c0ff;text-decoration:underline;",
};

export interface HtmlCodeHighlightOptions {
	wrapperStyle: string;
	headerStyle: string;
	languageLabelStyle: string;
	preStyle: string;
	codeStyle: string;
	tokenStyleMap?: Record<string, string>;
	languageAliasMap?: Record<string, string>;
	languageDisplayMap?: Record<string, string>;
	autoDetectLanguages?: string[];
}

let highlightLanguagesRegistered = false;

const ensureHighlightLanguagesRegistered = (): void => {
	if (highlightLanguagesRegistered) return;

	hljs.registerLanguage("bash", bashLanguage);
	hljs.registerLanguage("css", cssLanguage);
	hljs.registerLanguage("handlebars", handlebarsLanguage);
	hljs.registerLanguage("javascript", javascriptLanguage);
	hljs.registerLanguage("json", jsonLanguage);
	hljs.registerLanguage("less", lessLanguage);
	hljs.registerLanguage("markdown", markdownLanguage);
	hljs.registerLanguage("plaintext", plaintextLanguage);
	hljs.registerLanguage("scss", scssLanguage);
	hljs.registerLanguage("shell", shellLanguage);
	hljs.registerLanguage("sql", sqlLanguage);
	hljs.registerLanguage("typescript", typescriptLanguage);
	hljs.registerLanguage("xml", xmlLanguage);
	hljs.registerLanguage("yaml", yamlLanguage);

	highlightLanguagesRegistered = true;
};

const extractAttributeValue = (attrs: string, regex: RegExp): string | null => {
	const match = regex.exec(attrs);
	if (!match) return null;
	const raw = match[1] ?? match[2] ?? "";
	const value = raw.trim();
	return value || null;
};

const extractClassNames = (attrs: string): string[] => {
	const classValue = extractAttributeValue(attrs, CLASS_ATTR_REGEX);
	if (!classValue) return [];
	return classValue
		.split(/\s+/)
		.map((item) => item.trim())
		.filter(Boolean);
};

const decodeHtmlEntities = (value: string): string => {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, "\"")
		.replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/&nbsp;/g, " ")
		.replace(/&#x([0-9a-fA-F]+);/g, (_full, hex: string) => {
			const codePoint = Number.parseInt(hex, 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _full;
		})
		.replace(/&#(\d+);/g, (_full, numeric: string) => {
			const codePoint = Number.parseInt(numeric, 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _full;
		});
};

const stripHtmlTags = (value: string): string => {
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/?[^>]+>/g, "");
};

const escapeHtml = (value: string): string => {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
};

const mergeInlineStyle = (existingStyle: string, incomingStyle: string): string => {
	const merged = new Map<string, string>();
	const order: string[] = [];

	const parseInlineStyle = (styleText: string): Array<{ prop: string; value: string }> => {
		const result: Array<{ prop: string; value: string }> = [];
		for (const rawDeclaration of styleText.split(";")) {
			const declaration = rawDeclaration.trim();
			if (!declaration) continue;
			const splitIndex = declaration.indexOf(":");
			if (splitIndex <= 0) continue;
			const prop = declaration.slice(0, splitIndex).trim().toLowerCase();
			const value = declaration.slice(splitIndex + 1).trim();
			if (!prop || !value) continue;
			result.push({ prop, value });
		}
		return result;
	};

	for (const declaration of parseInlineStyle(existingStyle)) {
		merged.set(declaration.prop, declaration.value);
		order.push(declaration.prop);
	}

	for (const declaration of parseInlineStyle(incomingStyle)) {
		if (!merged.has(declaration.prop)) {
			merged.set(declaration.prop, declaration.value);
			order.push(declaration.prop);
		}
	}

	return order.map((prop) => `${prop}:${merged.get(prop)}`).join(";");
};

const normalizeCodeLanguage = (
	rawLanguage: string | null,
	languageAliasMap: Record<string, string>,
): string | null => {
	if (!rawLanguage) return null;

	let normalized = rawLanguage.trim().toLowerCase();
	normalized = normalized
		.replace(/^language[-:_]/, "")
		.replace(/^lang[-:_]/, "")
		.split(/[\s,;|]+/)[0]
		.trim();
	if (!normalized) return null;

	const aliased = languageAliasMap[normalized] ?? normalized;
	if (!hljs.getLanguage(aliased)) return null;
	return aliased;
};

const resolveCodeLanguageFromAttributes = (
	preAttrs: string,
	codeAttrs: string,
	languageAliasMap: Record<string, string>,
): string | null => {
	const attrSources = [codeAttrs, preAttrs];
	for (const attrs of attrSources) {
		const fromDataLang = extractAttributeValue(attrs, DATA_LANG_ATTR_REGEX);
		const normalizedFromDataLang = normalizeCodeLanguage(fromDataLang, languageAliasMap);
		if (normalizedFromDataLang) return normalizedFromDataLang;

		const fromLang = extractAttributeValue(attrs, LANG_ATTR_REGEX);
		const normalizedFromLang = normalizeCodeLanguage(fromLang, languageAliasMap);
		if (normalizedFromLang) return normalizedFromLang;

		for (const className of extractClassNames(attrs)) {
			const languageClassMatch = LANGUAGE_CLASS_REGEX.exec(className);
			const languageCandidate = languageClassMatch ? languageClassMatch[1] : className;
			const normalized = normalizeCodeLanguage(languageCandidate, languageAliasMap);
			if (normalized) return normalized;
		}
	}

	return null;
};

const resolveCodeLanguageLabel = (
	language: string,
	languageDisplayMap: Record<string, string>,
): string => {
	const normalized = language.trim().toLowerCase();
	if (languageDisplayMap[normalized]) {
		return languageDisplayMap[normalized];
	}
	if (normalized.length <= 4) return normalized.toUpperCase();
	return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const inlineHighlightTokenStyles = (
	highlightedHtml: string,
	tokenStyleMap: Record<string, string>,
): string => {
	return highlightedHtml.replace(/<span\b([^>]*?)>/gi, (fullMatch, rawAttrs: string) => {
		const classNames = extractClassNames(rawAttrs);
		if (classNames.length === 0) return fullMatch;

		let tokenStyle = "";
		for (const className of classNames) {
			const normalizedClass = className.startsWith("hljs-")
				? className.slice(5)
				: className;
			const style = tokenStyleMap[normalizedClass];
			if (!style) continue;
			tokenStyle = mergeInlineStyle(tokenStyle, style);
		}

		if (!tokenStyle) return fullMatch;

		const styleMatch = STYLE_ATTR_REGEX.exec(rawAttrs);
		let nextAttrs = rawAttrs;
		if (styleMatch) {
			const currentStyle = styleMatch[1] ?? styleMatch[2] ?? "";
			const mergedStyle = mergeInlineStyle(currentStyle, tokenStyle);
			nextAttrs = rawAttrs.replace(styleMatch[0], ` style="${mergedStyle}"`);
		} else {
			nextAttrs = `${rawAttrs} style="${tokenStyle}"`;
		}

		return `<span${nextAttrs}>`;
	});
};

const highlightCodeToGithubHtml = (
	rawCode: string,
	explicitLanguage: string | null,
	autoDetectLanguages: string[],
): {
	html: string;
	language: string;
} => {
	try {
		if (explicitLanguage) {
			const highlighted = hljs.highlight(rawCode, {
				language: explicitLanguage,
				ignoreIllegals: true,
			});
			return {
				html: highlighted.value,
				language: explicitLanguage,
			};
		}

		const autoHighlighted = hljs.highlightAuto(rawCode, autoDetectLanguages);
		const normalizedAutoLanguage = autoHighlighted.language ?? "plaintext";
		return {
			html: autoHighlighted.value,
			language: normalizedAutoLanguage,
		};
	} catch {
		return {
			html: escapeHtml(rawCode),
			language: explicitLanguage ?? "plaintext",
		};
	}
};

export const highlightHtmlCodeBlocks = (
	htmlContent: string,
	options: HtmlCodeHighlightOptions,
): string => {
	if (!htmlContent.trim()) return htmlContent;

	ensureHighlightLanguagesRegistered();

	const tokenStyleMap = options.tokenStyleMap ?? GITHUB_DARK_TOKEN_STYLE_MAP;
	const languageAliasMap = options.languageAliasMap ?? FRONTEND_LANGUAGE_ALIAS_MAP;
	const languageDisplayMap = options.languageDisplayMap ?? FRONTEND_LANGUAGE_DISPLAY_MAP;
	const autoDetectLanguages = options.autoDetectLanguages ?? FRONTEND_AUTO_DETECT_LANGUAGES;

	return htmlContent.replace(
		CODE_BLOCK_REGEX,
		(_fullMatch, preAttrs: string | undefined, codeAttrs: string | undefined, codeInnerHtml: string | undefined) => {
			const resolvedPreAttrs = preAttrs ?? "";
			const resolvedCodeAttrs = codeAttrs ?? "";
			const resolvedCodeHtml = codeInnerHtml ?? "";

			const explicitLanguage = resolveCodeLanguageFromAttributes(
				resolvedPreAttrs,
				resolvedCodeAttrs,
				languageAliasMap,
			);
			const plainCode = decodeHtmlEntities(stripHtmlTags(resolvedCodeHtml));
			const highlighted = highlightCodeToGithubHtml(plainCode, explicitLanguage, autoDetectLanguages);
			const highlightedWithTokenStyle = inlineHighlightTokenStyles(highlighted.html, tokenStyleMap);
			const normalizedLanguage = normalizeCodeLanguage(
				explicitLanguage ?? highlighted.language,
				languageAliasMap,
			) ?? "plaintext";
			const languageLabel = resolveCodeLanguageLabel(normalizedLanguage, languageDisplayMap);

			return `<div style="${options.wrapperStyle}"><div style="${options.headerStyle}"><span style="${options.languageLabelStyle}">${escapeHtml(languageLabel)}</span></div><pre style="${options.preStyle}"><code style="${options.codeStyle}">${highlightedWithTokenStyle}</code></pre></div>`;
		},
	);
};
