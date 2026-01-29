import type { Env } from "../types";

export async function saveDraft(env: Env, id: string, content: string) {
	const key = `drafts/${id}.md`;
	await env.DRAFTS.put(key, content, {
		httpMetadata: {
			contentType: "text/markdown; charset=utf-8",
		},
	});
	return key;
}

export async function savePublished(env: Env, id: string, content: string) {
	const key = `published/${id}.md`;
	await env.DRAFTS.put(key, content, {
		httpMetadata: {
			contentType: "text/markdown; charset=utf-8",
		},
	});
	return key;
}

export async function getDraft(env: Env, id: string) {
	const object = await env.DRAFTS.get(`drafts/${id}.md`);
	return object ? await object.text() : null;
}
