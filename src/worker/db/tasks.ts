import type { Task } from "@/worker/types";

export async function createTask(db: D1Database, payload: Task) {
	await db.prepare("INSERT INTO tasks (id, type, status, payload) VALUES (?, ?, ?, ?)")
		.bind(payload.id, payload.type, payload.status, JSON.stringify(payload.payload))
		.run();
	return payload;
}

export async function listTasks(db: D1Database) {
	const result = await db
		.prepare("SELECT * FROM tasks ORDER BY rowid DESC")
		.all<{ id: string; type: Task["type"]; status: Task["status"]; payload: string }>();
	return (result.results ?? []).map((row) => ({
		id: row.id,
		type: row.type,
		status: row.status,
		payload: JSON.parse(row.payload) as Task["payload"],
	}));
}
