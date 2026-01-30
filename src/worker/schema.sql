-- D1 schema for blog-to-post
CREATE TABLE IF NOT EXISTS articles (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	content TEXT NOT NULL,
	summary TEXT,
	tags TEXT,
	coverImage TEXT,
	platform TEXT NOT NULL,
	status TEXT NOT NULL,
	publishedAt INTEGER,
	createdAt INTEGER NOT NULL,
	updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
	id TEXT PRIMARY KEY,
	type TEXT NOT NULL,
	status TEXT NOT NULL,
	payload TEXT NOT NULL
);
