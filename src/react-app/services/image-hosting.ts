import type { Image } from "mdast";

interface ImageHostingUploadResponse {
	success?: boolean;
	url?: string;
	message?: string;
	error?: string;
	urls?: {
		jsdelivr_commit?: string;
		raw_commit?: string;
		jsdelivr?: string;
		raw?: string;
		github_commit?: string;
		github?: string;
	};
}

export const IMAGE_HOSTING_UPLOAD_ENDPOINT = "https://image-hosting.nurverse.com/api/upload";

function pickBestUrl(payload: ImageHostingUploadResponse): string {
	const url =
		payload.urls?.jsdelivr_commit ||
		payload.url ||
		payload.urls?.raw_commit ||
		payload.urls?.jsdelivr ||
		payload.urls?.raw ||
		payload.urls?.github_commit ||
		payload.urls?.github;

	if (!url) {
		throw new Error("Image hosting API responded without a usable image URL");
	}

	return url;
}

async function uploadSingleImage(file: File): Promise<Pick<Image, "url" | "alt" | "title">> {
	const formData = new FormData();
	formData.append("file", file);

	const response = await fetch(IMAGE_HOSTING_UPLOAD_ENDPOINT, {
		method: "POST",
		body: formData,
	});

	const text = await response.text();
	const parsed = (() => {
		try {
			return JSON.parse(text) as ImageHostingUploadResponse;
		} catch {
			return null;
		}
	})();

	if (!response.ok) {
		const message = parsed?.message || parsed?.error || text || `HTTP ${response.status}`;
		throw new Error(`Image upload failed: ${message}`);
	}

	if (!parsed?.success) {
		const message = parsed?.message || parsed?.error || "Unknown error";
		throw new Error(`Image upload failed: ${message}`);
	}

	const url = pickBestUrl(parsed);
	const fileName = file.name || "image";

	return {
		url,
		alt: fileName,
		title: fileName,
	};
}

export async function uploadImageToImageHosting(file: File): Promise<string> {
	const uploaded = await uploadSingleImage(file);
	return uploaded.url;
}

export async function uploadImagesToImageHosting(files: File[]): Promise<Pick<Image, "url" | "alt" | "title">[]> {
	if (!files.length) return [];
	return Promise.all(files.map((file) => uploadSingleImage(file)));
}
