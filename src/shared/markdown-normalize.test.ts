import { describe, expect, it } from "vitest";
import { formatPlainMarkdownImage, normalizeMarkdownImageSyntax } from "./markdown-normalize";

describe("normalizeMarkdownImageSyntax", () => {
	it("does not keep adding escapes to pasted image alt text", () => {
		const pastedMarkdown = String.raw`![webpack\_error\_terminal\_style\_match.png](https://example.com/webpack.png)`;
		const once = normalizeMarkdownImageSyntax(pastedMarkdown);

		expect(once).toBe(pastedMarkdown);
		expect(normalizeMarkdownImageSyntax(once)).toBe(once);
	});

	it("escapes image-alt brackets only once", () => {
		const image = formatPlainMarkdownImage("[draft]", "https://example.com/image.png");

		expect(image).toBe("![\\[draft\\]](https://example.com/image.png)");
		expect(normalizeMarkdownImageSyntax(image)).toBe(image);
	});
});
