export type ImageMimeToExtensionMap = Readonly<Record<string, string>>;

export const COMMON_IMAGE_MIME_TO_EXTENSION: ImageMimeToExtensionMap = {
	"image/jpeg": "jpg",
	"image/jpg": "jpg",
	"image/png": "png",
	"image/gif": "gif",
	"image/bmp": "bmp",
	"image/webp": "webp",
	"image/svg+xml": "svg",
};

export type CloudinaryImageFormat = "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "avif";

export const resolveImageExtensionByMime = (
	mimeType: string,
	mimeToExtension: ImageMimeToExtensionMap = COMMON_IMAGE_MIME_TO_EXTENSION,
): string | null => {
	const normalized = mimeType.trim().toLowerCase();
	if (!normalized) return null;
	return mimeToExtension[normalized] ?? null;
};

export const resolveImageMimeTypeFromBlob = async (blob: Blob): Promise<string> => {
	const reported = (blob.type || "").toLowerCase();
	if (reported && reported !== "application/octet-stream") return reported;

	const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
	if (
		bytes.length >= 8 &&
		bytes[0] === 0x89 &&
		bytes[1] === 0x50 &&
		bytes[2] === 0x4e &&
		bytes[3] === 0x47 &&
		bytes[4] === 0x0d &&
		bytes[5] === 0x0a &&
		bytes[6] === 0x1a &&
		bytes[7] === 0x0a
	) {
		return "image/png";
	}
	if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
		return "image/jpeg";
	}
	if (
		bytes.length >= 6 &&
		bytes[0] === 0x47 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x38 &&
		(bytes[4] === 0x39 || bytes[4] === 0x37) &&
		bytes[5] === 0x61
	) {
		return "image/gif";
	}
	if (bytes.length >= 2 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
		return "image/bmp";
	}
	if (
		bytes.length >= 12 &&
		bytes[0] === 0x52 &&
		bytes[1] === 0x49 &&
		bytes[2] === 0x46 &&
		bytes[3] === 0x46 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return "image/webp";
	}
	return reported || "application/octet-stream";
};

export const rewriteCloudinaryImageFormat = (
	sourceUrl: string,
	format: CloudinaryImageFormat,
): string | null => {
	let parsed: URL;
	try {
		parsed = new URL(sourceUrl);
	} catch {
		return null;
	}
	if (!parsed.hostname.toLowerCase().includes("res.cloudinary.com")) {
		return null;
	}

	const formatToken = `f_${format}`;
	let nextPath = parsed.pathname;
	if (/\/f_[^/]+\//i.test(nextPath)) {
		nextPath = nextPath.replace(/\/f_[^/]+\//i, `/${formatToken}/`);
	} else if (nextPath.includes("/upload/")) {
		nextPath = nextPath.replace("/upload/", `/upload/${formatToken}/`);
	}

	if (parsed.searchParams.has("f")) {
		parsed.searchParams.set("f", format);
	}
	if (parsed.searchParams.has("format")) {
		parsed.searchParams.set("format", format);
	}
	if (parsed.searchParams.has("fm")) {
		parsed.searchParams.set("fm", format);
	}

	parsed.pathname = nextPath;
	const rewritten = parsed.toString();
	return rewritten !== sourceUrl ? rewritten : null;
};

export const buildCloudinaryImageFormatRewriteSources = (
	sourceUrl: string,
	formats: readonly CloudinaryImageFormat[] = ["png", "jpg"],
): string[] => {
	if (sourceUrl.startsWith("data:")) return [];
	const candidates = new Set<string>();
	for (const format of formats) {
		const rewritten = rewriteCloudinaryImageFormat(sourceUrl, format);
		if (rewritten) candidates.add(rewritten);
	}
	return Array.from(candidates);
};
