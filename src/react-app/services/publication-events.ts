export const ARTICLE_PUBLICATIONS_UPDATED_EVENT = "article-publications-updated";

export interface ArticlePublicationsUpdatedDetail {
	taskId?: string;
	articleIds: string[];
}

export function notifyArticlePublicationsUpdated(detail: ArticlePublicationsUpdatedDetail): void {
	const articleIds = [...new Set(detail.articleIds.filter(Boolean))];
	if (articleIds.length === 0) return;

	window.dispatchEvent(new CustomEvent<ArticlePublicationsUpdatedDetail>(ARTICLE_PUBLICATIONS_UPDATED_EVENT, {
		detail: {
			taskId: detail.taskId,
			articleIds,
		},
	}));
}

export function subscribeToArticlePublicationUpdates(
	listener: (detail: ArticlePublicationsUpdatedDetail) => void,
): () => void {
	const handleUpdate = (event: Event) => {
		listener((event as CustomEvent<ArticlePublicationsUpdatedDetail>).detail);
	};

	window.addEventListener(ARTICLE_PUBLICATIONS_UPDATED_EVENT, handleUpdate);
	return () => window.removeEventListener(ARTICLE_PUBLICATIONS_UPDATED_EVENT, handleUpdate);
}
