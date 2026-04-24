import hljs from "highlight.js/lib/core";
import hljsFull from "highlight.js";
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
import Prism from "prismjs";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-markup-templating.js";
import "prismjs/components/prism-css.js";
import "prismjs/components/prism-clike.js";
import "prismjs/components/prism-javascript.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-typescript.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-json5.js";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-shell-session.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-java.js";
import "prismjs/components/prism-c.js";
import "prismjs/components/prism-cpp.js";
import "prismjs/components/prism-csharp.js";
import "prismjs/components/prism-go.js";
import "prismjs/components/prism-rust.js";
import "prismjs/components/prism-kotlin.js";
import "prismjs/components/prism-swift.js";
import "prismjs/components/prism-php.js";
import "prismjs/components/prism-ruby.js";
import "prismjs/components/prism-scala.js";
import "prismjs/components/prism-dart.js";
import "prismjs/components/prism-yaml.js";
import "prismjs/components/prism-markdown.js";
import "prismjs/components/prism-toml.js";
import "prismjs/components/prism-docker.js";
import "prismjs/components/prism-nginx.js";
import "prismjs/components/prism-graphql.js";
import "prismjs/components/prism-lua.js";
import "prismjs/components/prism-powershell.js";
import "prismjs/components/prism-less.js";
import "prismjs/components/prism-scss.js";
import "prismjs/components/prism-sass.js";
import "prismjs/components/prism-liquid.js";

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

export const PRISM_LANGUAGE_ALIAS_MAP: Record<string, string> = {
	plain: "none",
	text: "none",
	txt: "none",
	plaintext: "none",
	js: "javascript",
	mjs: "javascript",
	cjs: "javascript",
	node: "javascript",
	nodejs: "javascript",
	ts: "typescript",
	tsx: "tsx",
	jsx: "jsx",
	html: "markup",
	htm: "markup",
	xml: "markup",
	svg: "markup",
	vue: "markup",
	yml: "yaml",
	sh: "bash",
	shell: "bash",
	zsh: "bash",
	ps1: "powershell",
	md: "markdown",
	dockerfile: "docker",
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

export const ATOM_ONE_DARK_TOKEN_STYLE_MAP: Record<string, string> = {
	comment: "color:#5c6370;font-style:italic;",
	quote: "color:#5c6370;font-style:italic;",
	doctag: "color:#c678dd;",
	keyword: "color:#c678dd;",
	"selector-tag": "color:#e06c75;",
	"selector-id": "color:#e06c75;",
	"selector-class": "color:#e06c75;",
	"selector-attr": "color:#d19a66;",
	"selector-pseudo": "color:#56b6c2;",
	attr: "color:#d19a66;",
	name: "color:#e06c75;",
	tag: "color:#e06c75;",
	type: "color:#e5c07b;",
	title: "color:#61afef;",
	function: "color:#61afef;",
	"function_": "color:#61afef;",
	class_: "color:#e5c07b;",
	params: "color:#abb2bf;",
	built_in: "color:#e5c07b;",
	literal: "color:#56b6c2;",
	number: "color:#d19a66;",
	symbol: "color:#56b6c2;",
	variable: "color:#e06c75;",
	"template-variable": "color:#e06c75;",
	string: "color:#98c379;",
	regexp: "color:#98c379;",
	subst: "color:#abb2bf;",
	meta: "color:#61afef;",
	"meta-keyword": "color:#c678dd;",
	"meta-string": "color:#98c379;",
	section: "color:#61afef;font-weight:700;",
	bullet: "color:#d19a66;",
	emphasis: "font-style:italic;",
	strong: "font-weight:700;",
	addition: "color:#98c379;",
	deletion: "color:#e06c75;",
	link: "color:#61afef;text-decoration:underline;",
	operator: "color:#56b6c2;",
	punctuation: "color:#abb2bf;",
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

export interface HtmlPreCodeHighlightOptions {
	languageAliasMap?: Record<string, string>;
	autoDetectLanguages?: string[];
	addHljsClass?: boolean;
	preserveExistingCodeClasses?: boolean;
	inlineTokenStyles?: boolean;
	tokenStyleMap?: Record<string, string>;
	preStyle?: string;
	codeStyle?: string;
}

export interface HtmlPreCodePrismOptions {
	languageAliasMap?: Record<string, string>;
	preserveExistingCodeClasses?: boolean;
	addPrismClass?: boolean;
	preStyle?: string;
	codeStyle?: string;
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
	return normalizeCodeLanguageWithChecker(
		rawLanguage,
		languageAliasMap,
		(language) => Boolean(hljs.getLanguage(language)),
	);
};

const normalizePrismLanguage = (
	rawLanguage: string | null,
	languageAliasMap: Record<string, string>,
): string | null => {
	return normalizeCodeLanguageWithChecker(
		rawLanguage,
		languageAliasMap,
		(language) => language === "none" || Boolean(Prism.languages[language]),
	);
};

const normalizeCodeLanguageWithChecker = (
	rawLanguage: string | null,
	languageAliasMap: Record<string, string>,
	isLanguageAvailable: (language: string) => boolean,
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
	if (!isLanguageAvailable(aliased)) return null;
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

const highlightCodeToPrismHtml = (
	rawCode: string,
	explicitLanguage: string | null,
): {
	html: string;
	language: string;
} => {
	const normalizedLanguage = explicitLanguage ?? "none";
	try {
		if (normalizedLanguage === "none") {
			return {
				html: escapeHtml(rawCode),
				language: "none",
			};
		}

		const grammar = Prism.languages[normalizedLanguage];
		if (!grammar) {
			return {
				html: escapeHtml(rawCode),
				language: normalizedLanguage,
			};
		}

		return {
			html: Prism.highlight(rawCode, grammar, normalizedLanguage),
			language: normalizedLanguage,
		};
	} catch {
		return {
			html: escapeHtml(rawCode),
			language: normalizedLanguage,
		};
	}
};

const resolveCodeLanguageFromAttributesWithChecker = (
	preAttrs: string,
	codeAttrs: string,
	languageAliasMap: Record<string, string>,
	isLanguageAvailable: (language: string) => boolean,
): string | null => {
	const attrSources = [codeAttrs, preAttrs];
	for (const attrs of attrSources) {
		const fromDataLang = extractAttributeValue(attrs, DATA_LANG_ATTR_REGEX);
		const normalizedFromDataLang = normalizeCodeLanguageWithChecker(
			fromDataLang,
			languageAliasMap,
			isLanguageAvailable,
		);
		if (normalizedFromDataLang) return normalizedFromDataLang;

		const fromLang = extractAttributeValue(attrs, LANG_ATTR_REGEX);
		const normalizedFromLang = normalizeCodeLanguageWithChecker(
			fromLang,
			languageAliasMap,
			isLanguageAvailable,
		);
		if (normalizedFromLang) return normalizedFromLang;

		for (const className of extractClassNames(attrs)) {
			const languageClassMatch = LANGUAGE_CLASS_REGEX.exec(className);
			const languageCandidate = languageClassMatch ? languageClassMatch[1] : className;
			const normalized = normalizeCodeLanguageWithChecker(
				languageCandidate,
				languageAliasMap,
				isLanguageAvailable,
			);
			if (normalized) return normalized;
		}
	}

	return null;
};

const upsertClassAttribute = (attrs: string, classNames: string[]): string => {
	const uniqueClassNames = Array.from(
		new Set(
			classNames
				.map((item) => item.trim())
				.filter(Boolean),
		),
	);
	const classValue = uniqueClassNames.join(" ");
	const normalizedAttrs = attrs.trim();

	if (!classValue) {
		return normalizedAttrs ? ` ${normalizedAttrs}` : "";
	}

	if (!normalizedAttrs) {
		return ` class="${classValue}"`;
	}

	const classPattern = /\bclass\s*=\s*(?:"[^"]*"|'[^']*')/i;
	const nextAttrs = classPattern.test(normalizedAttrs)
		? normalizedAttrs.replace(classPattern, `class="${classValue}"`)
		: `${normalizedAttrs} class="${classValue}"`;

	return ` ${nextAttrs.trim()}`;
};

const removeClassNamesByPredicate = (
	classNames: string[],
	shouldRemove: (className: string) => boolean,
): string[] => {
	return classNames.filter((className) => !shouldRemove(className));
};

const upsertStyleAttribute = (attrs: string, incomingStyle: string): string => {
	const normalizedIncomingStyle = incomingStyle.trim();
	const normalizedAttrs = attrs.trim();
	if (!normalizedIncomingStyle) {
		return normalizedAttrs ? ` ${normalizedAttrs}` : "";
	}

	if (!normalizedAttrs) {
		return ` style="${normalizedIncomingStyle}"`;
	}

	const styleMatch = STYLE_ATTR_REGEX.exec(normalizedAttrs);
	const nextAttrs = styleMatch
		? normalizedAttrs.replace(
			styleMatch[0],
			` style="${mergeInlineStyle(styleMatch[1] ?? styleMatch[2] ?? "", normalizedIncomingStyle)}"`,
		)
		: `${normalizedAttrs} style="${normalizedIncomingStyle}"`;

	return ` ${nextAttrs.trim()}`;
};

export const highlightHtmlPreCodeBlocksWithHighlightJs = (
	htmlContent: string,
	options: HtmlPreCodeHighlightOptions = {},
): string => {
	if (!htmlContent.trim()) return htmlContent;

	const languageAliasMap = options.languageAliasMap ?? FRONTEND_LANGUAGE_ALIAS_MAP;
	const addHljsClass = options.addHljsClass ?? true;
	const preserveExistingCodeClasses = options.preserveExistingCodeClasses ?? true;
	const inlineTokenStyles = options.inlineTokenStyles ?? false;
	const tokenStyleMap = options.tokenStyleMap ?? ATOM_ONE_DARK_TOKEN_STYLE_MAP;
	const preStyle = options.preStyle ?? "";
	const codeStyle = options.codeStyle ?? "";
	const isLanguageAvailable = (language: string): boolean => Boolean(hljsFull.getLanguage(language));
	const normalizedAutoDetectLanguages = (options.autoDetectLanguages ?? [])
		.map((language) =>
			normalizeCodeLanguageWithChecker(language, languageAliasMap, isLanguageAvailable))
		.filter((language): language is string => Boolean(language));

	return htmlContent.replace(
		CODE_BLOCK_REGEX,
		(_fullMatch, preAttrs: string | undefined, codeAttrs: string | undefined, codeInnerHtml: string | undefined) => {
			const resolvedPreAttrs = preAttrs ?? "";
			const resolvedCodeAttrs = codeAttrs ?? "";
			const resolvedCodeHtml = codeInnerHtml ?? "";
			const plainCode = decodeHtmlEntities(stripHtmlTags(resolvedCodeHtml));
			const explicitLanguage = resolveCodeLanguageFromAttributesWithChecker(
				resolvedPreAttrs,
				resolvedCodeAttrs,
				languageAliasMap,
				isLanguageAvailable,
			);

			let highlightedHtml = escapeHtml(plainCode);
			let detectedLanguage = explicitLanguage ?? "plaintext";
			try {
				if (explicitLanguage) {
					const highlighted = hljsFull.highlight(plainCode, {
						language: explicitLanguage,
						ignoreIllegals: true,
					});
					highlightedHtml = highlighted.value;
					detectedLanguage = explicitLanguage;
				} else {
					const autoHighlighted = normalizedAutoDetectLanguages.length > 0
						? hljsFull.highlightAuto(plainCode, normalizedAutoDetectLanguages)
						: hljsFull.highlightAuto(plainCode);
					highlightedHtml = autoHighlighted.value;
					detectedLanguage = autoHighlighted.language ?? "plaintext";
				}
			} catch {
				highlightedHtml = escapeHtml(plainCode);
				detectedLanguage = explicitLanguage ?? "plaintext";
			}
			const highlightedWithTokenStyle = inlineTokenStyles
				? inlineHighlightTokenStyles(highlightedHtml, tokenStyleMap)
				: highlightedHtml;

			const normalizedLanguage = normalizeCodeLanguageWithChecker(
				detectedLanguage,
				languageAliasMap,
				isLanguageAvailable,
			) ?? "plaintext";

			const codeClasses = preserveExistingCodeClasses
				? extractClassNames(resolvedCodeAttrs)
				: [];
			if (addHljsClass) {
				codeClasses.push("hljs");
			}
			codeClasses.push(`language-${normalizedLanguage}`);
			const nextCodeClassAttrs = upsertClassAttribute(resolvedCodeAttrs, codeClasses).trim();
			const nextCodeAttrs = upsertStyleAttribute(nextCodeClassAttrs, codeStyle);
			const nextPreAttrs = upsertStyleAttribute(resolvedPreAttrs, preStyle);

			return `<pre${nextPreAttrs}><code${nextCodeAttrs}>${highlightedWithTokenStyle}</code></pre>`;
		},
	);
};

export const highlightHtmlPreCodeBlocksWithPrism = (
	htmlContent: string,
	options: HtmlPreCodePrismOptions = {},
): string => {
	if (!htmlContent.trim()) return htmlContent;

	const languageAliasMap = {
		...FRONTEND_LANGUAGE_ALIAS_MAP,
		...PRISM_LANGUAGE_ALIAS_MAP,
		...(options.languageAliasMap ?? {}),
	};
	const preserveExistingCodeClasses = options.preserveExistingCodeClasses ?? true;
	const addPrismClass = options.addPrismClass ?? true;
	const preStyle = options.preStyle ?? "";
	const codeStyle = options.codeStyle ?? "";
	const isLanguageAvailable = (language: string): boolean =>
		language === "none" || Boolean(Prism.languages[language]);

	return htmlContent.replace(
		CODE_BLOCK_REGEX,
		(_fullMatch, preAttrs: string | undefined, codeAttrs: string | undefined, codeInnerHtml: string | undefined) => {
			const resolvedPreAttrs = preAttrs ?? "";
			const resolvedCodeAttrs = codeAttrs ?? "";
			const resolvedCodeHtml = codeInnerHtml ?? "";
			const plainCode = decodeHtmlEntities(stripHtmlTags(resolvedCodeHtml));
			const explicitLanguage = resolveCodeLanguageFromAttributesWithChecker(
				resolvedPreAttrs,
				resolvedCodeAttrs,
				languageAliasMap,
				isLanguageAvailable,
			);
			const normalizedLanguage = normalizePrismLanguage(explicitLanguage, languageAliasMap) ?? "none";
			const highlighted = highlightCodeToPrismHtml(plainCode, normalizedLanguage);

			let codeClasses = preserveExistingCodeClasses
				? extractClassNames(resolvedCodeAttrs)
				: [];
			codeClasses = removeClassNamesByPredicate(
				codeClasses,
				(className) =>
					className === "hljs"
					|| className.startsWith("hljs-")
					|| className === "prism"
					|| className === "token"
					|| /^language-/i.test(className)
					|| /^lang-/i.test(className),
			);
			if (addPrismClass) {
				codeClasses.push("prism");
			}
			if (highlighted.language !== "none") {
				codeClasses.push(`language-${highlighted.language}`);
			}

			const nextCodeClassAttrs = upsertClassAttribute(resolvedCodeAttrs, codeClasses).trim();
			const nextCodeAttrs = upsertStyleAttribute(nextCodeClassAttrs, codeStyle);
			const nextPreAttrs = upsertStyleAttribute(resolvedPreAttrs, preStyle);

			return `<pre${nextPreAttrs}><code${nextCodeAttrs}>${highlighted.html}</code></pre>`;
		},
	);
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
