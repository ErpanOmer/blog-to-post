import type { ImageMimeToExtensionMap } from "./image";
import { resolveImageExtensionByMime, resolveImageMimeTypeFromBlob } from "./image";

export interface ResolvedImageUploadCandidate {
	source: string;
	blob: Blob;
	mimeType: string;
	suffix: string;
}

export interface UploadImageWithCandidatesOptions<TPayload> {
	sourceUrl: string;
	mimeToSuffix: ImageMimeToExtensionMap;
	downloadImageFromUrl: (url: string) => Promise<Blob>;
	dataUriToBlob: (dataUri: string) => Blob;
	buildRewriteSources?: (sourceUrl: string) => string[];
	uploadCandidate: (candidate: ResolvedImageUploadCandidate) => Promise<TPayload>;
	shouldRetryError?: (error: unknown) => boolean;
	onUseRewriteCandidate?: (candidate: ResolvedImageUploadCandidate) => void | Promise<void>;
}

export interface UploadImageWithCandidatesResult<TPayload> {
	payload: TPayload;
	candidate: ResolvedImageUploadCandidate;
	primaryMimeType: string;
}

const inspectUploadCandidateSource = async (
	source: string,
	options: Pick<
		UploadImageWithCandidatesOptions<unknown>,
		"dataUriToBlob" | "downloadImageFromUrl" | "mimeToSuffix"
	>,
): Promise<{
	blob: Blob;
	mimeType: string;
	suffix: string | null;
}> => {
	const blob = source.startsWith("data:")
		? options.dataUriToBlob(source)
		: await options.downloadImageFromUrl(source);
	const mimeType = await resolveImageMimeTypeFromBlob(blob);
	const suffix = resolveImageExtensionByMime(mimeType, options.mimeToSuffix);
	return { blob, mimeType, suffix };
};

export const uploadImageWithCandidates = async <TPayload>(
	options: UploadImageWithCandidatesOptions<TPayload>,
): Promise<UploadImageWithCandidatesResult<TPayload>> => {
	const primary = await inspectUploadCandidateSource(options.sourceUrl, options);
	const queue: ResolvedImageUploadCandidate[] = [];
	if (primary.suffix) {
		queue.push({
			source: options.sourceUrl,
			blob: primary.blob,
			mimeType: primary.mimeType,
			suffix: primary.suffix,
		});
	}

	let rewriteSourcesQueued = false;
	const enqueueRewriteCandidates = async (): Promise<void> => {
		if (rewriteSourcesQueued) return;
		rewriteSourcesQueued = true;
		for (const rewriteSource of options.buildRewriteSources?.(options.sourceUrl) ?? []) {
			try {
				const inspected = await inspectUploadCandidateSource(rewriteSource, options);
				if (!inspected.suffix) continue;
				queue.push({
					source: rewriteSource,
					blob: inspected.blob,
					mimeType: inspected.mimeType,
					suffix: inspected.suffix,
				});
			} catch {
				// Ignore optional rewrite candidate failures and continue with next candidate.
			}
		}
	};

	if (!primary.suffix) {
		await enqueueRewriteCandidates();
	}

	let lastError: unknown = null;
	for (let i = 0; i < queue.length; i++) {
		const candidate = queue[i];
		if (candidate.source !== options.sourceUrl) {
			await options.onUseRewriteCandidate?.(candidate);
		}

		try {
			const payload = await options.uploadCandidate(candidate);
			return { payload, candidate, primaryMimeType: primary.mimeType };
		} catch (error) {
			lastError = error;
			if (options.shouldRetryError?.(error)) {
				await enqueueRewriteCandidates();
				continue;
			}
			throw error;
		}
	}

	if (lastError instanceof Error) throw lastError;
	throw new Error(
		`Unsupported image mime type for upload (mime=${primary.mimeType}, source=${options.sourceUrl})`,
	);
};
