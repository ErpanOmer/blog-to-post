import type { BytemdEditorContext, BytemdPlugin } from "bytemd";

type AlignMode = "left" | "center" | "right";

const ICON_ALIGN = `
<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
  <path d="M2 3h12v1H2zM4 6h8v1H4zM2 9h12v1H2zM4 12h8v1H4z" fill="currentColor"/>
</svg>
`;

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)/g;

function escapeHtmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function convertMarkdownImagesToHtml(content: string): string {
	return content.replace(MARKDOWN_IMAGE_RE, (_raw, alt: string, src: string, title?: string) => {
		const altText = escapeHtmlAttr((alt ?? "").trim());
		const srcValue = escapeHtmlAttr((src ?? "").trim());
		const titleAttr = title ? ` title="${escapeHtmlAttr(title.trim())}"` : "";
		return `<img src="${srcValue}" alt="${altText}"${titleAttr} />`;
	});
}

function unwrapAlignedParagraph(content: string): string {
	const match = content.match(/^<p\s+align\s*=\s*['"]?(left|center|right)['"]?\s*>([\s\S]*?)<\/p>$/i);
	if (!match) return content;
	return match[2].trim();
}

function toAlignedParagraph(content: string, align: AlignMode): string {
	const trimmed = content.trim();
	if (!trimmed) return "";

	const unwrapped = unwrapAlignedParagraph(trimmed);
	const normalized = convertMarkdownImagesToHtml(unwrapped);
	return `<p align=${align}>${normalized}</p>`;
}

function applyAlignment(ctx: BytemdEditorContext, align: AlignMode) {
	const { editor } = ctx;
	const selected = editor.getSelection();
	if (!selected.trim()) return;

	editor.replaceSelection(toAlignedParagraph(selected, align));
	editor.focus();
}

export function createAlignPlugin(): BytemdPlugin {
	return {
		actions: [
			{
				icon: ICON_ALIGN,
				handler: {
					type: "dropdown",
					actions: [
						{
							title: "左对齐",
							handler: {
								type: "action",
								click: (ctx) => applyAlignment(ctx, "left"),
							},
						},
						{
							title: "居中对齐",
							handler: {
								type: "action",
								click: (ctx) => applyAlignment(ctx, "center"),
							},
						},
						{
							title: "右对齐",
							handler: {
								type: "action",
								click: (ctx) => applyAlignment(ctx, "right"),
							},
						},
					],
				},
			},
		],
	};
}
