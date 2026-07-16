import type {
	AIFeature,
	AIModelRoute,
	AIModelRouteFeature,
	AIModelRouteInput,
	AIModelRoutingConfig,
	AIProviderProfileSummary,
	AIProviderProtocol,
} from "@/shared/types";

export interface AIProviderProfileRecord {
	id: string;
	name: string;
	protocol: AIProviderProtocol;
	baseUrl: string;
	apiKeyCiphertext: string | null;
	defaultModel: string;
	enabled: number;
	lastVerifiedAt: number | null;
	lastVerificationStatus: "success" | "failed" | null;
	lastVerificationMessage: string | null;
	createdAt: number;
	updatedAt: number;
}

interface AIModelRouteRow {
	feature: AIModelRouteFeature;
	providerId: string;
	providerName: string;
	protocol: AIProviderProtocol;
	model: string;
	temperature: number | null;
	topP: number | null;
	maxTokens: number | null;
	requestTimeoutSec: number | null;
	updatedAt: number;
}

function toSummary(row: AIProviderProfileRecord): AIProviderProfileSummary {
	return {
		id: row.id,
		name: row.name,
		protocol: row.protocol,
		baseUrl: row.baseUrl,
		defaultModel: row.defaultModel,
		enabled: Boolean(row.enabled),
		hasApiKey: Boolean(row.apiKeyCiphertext),
		lastVerifiedAt: row.lastVerifiedAt,
		lastVerificationStatus: row.lastVerificationStatus,
		lastVerificationMessage: row.lastVerificationMessage,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toRoute(row: AIModelRouteRow): AIModelRoute {
	return {
		feature: row.feature,
		providerId: row.providerId,
		providerName: row.providerName,
		protocol: row.protocol,
		model: row.model,
		temperature: row.temperature,
		topP: row.topP,
		maxTokens: row.maxTokens,
		requestTimeoutSec: row.requestTimeoutSec,
		updatedAt: row.updatedAt,
	};
}

export async function listAIProviderProfiles(db: D1Database): Promise<AIProviderProfileSummary[]> {
	const result = await db.prepare(
		"SELECT * FROM ai_provider_profiles ORDER BY enabled DESC, name COLLATE NOCASE ASC",
	).all<AIProviderProfileRecord>();
	return result.results.map(toSummary);
}

export async function getAIProviderProfileRecord(
	db: D1Database,
	id: string,
): Promise<AIProviderProfileRecord | null> {
	return db.prepare("SELECT * FROM ai_provider_profiles WHERE id = ?").bind(id).first<AIProviderProfileRecord>();
}

export async function insertAIProviderProfile(
	db: D1Database,
	record: AIProviderProfileRecord,
): Promise<AIProviderProfileSummary> {
	await db.prepare(
		`INSERT INTO ai_provider_profiles (
			id, name, protocol, baseUrl, apiKeyCiphertext, defaultModel, enabled,
			lastVerifiedAt, lastVerificationStatus, lastVerificationMessage, createdAt, updatedAt
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		record.id,
		record.name,
		record.protocol,
		record.baseUrl,
		record.apiKeyCiphertext,
		record.defaultModel,
		record.enabled,
		record.lastVerifiedAt,
		record.lastVerificationStatus,
		record.lastVerificationMessage,
		record.createdAt,
		record.updatedAt,
	).run();
	return toSummary(record);
}

export async function replaceAIProviderProfile(
	db: D1Database,
	record: AIProviderProfileRecord,
): Promise<AIProviderProfileSummary> {
	await db.prepare(
		`UPDATE ai_provider_profiles SET
			name = ?, protocol = ?, baseUrl = ?, apiKeyCiphertext = ?, defaultModel = ?, enabled = ?,
			lastVerifiedAt = ?, lastVerificationStatus = ?, lastVerificationMessage = ?, updatedAt = ?
		WHERE id = ?`,
	).bind(
		record.name,
		record.protocol,
		record.baseUrl,
		record.apiKeyCiphertext,
		record.defaultModel,
		record.enabled,
		record.lastVerifiedAt,
		record.lastVerificationStatus,
		record.lastVerificationMessage,
		record.updatedAt,
		record.id,
	).run();
	return toSummary(record);
}

export async function countRoutesUsingProvider(db: D1Database, providerId: string): Promise<number> {
	const result = await db.prepare(
		"SELECT COUNT(*) AS count FROM ai_model_routes WHERE providerId = ?",
	).bind(providerId).first<{ count: number }>();
	return Number(result?.count ?? 0);
}

export async function deleteAIProviderProfile(db: D1Database, id: string): Promise<void> {
	await db.prepare("DELETE FROM ai_provider_profiles WHERE id = ?").bind(id).run();
}

export async function updateAIProviderVerification(
	db: D1Database,
	id: string,
	status: "success" | "failed",
	message: string,
): Promise<void> {
	const now = Date.now();
	await db.prepare(
		`UPDATE ai_provider_profiles
		 SET lastVerifiedAt = ?, lastVerificationStatus = ?, lastVerificationMessage = ?, updatedAt = ?
		 WHERE id = ?`,
	).bind(now, status, message, now, id).run();
}

export async function getAIModelRoutingConfig(db: D1Database): Promise<AIModelRoutingConfig> {
	const result = await db.prepare(
		`SELECT r.*, p.name AS providerName, p.protocol AS protocol
		 FROM ai_model_routes r
		 JOIN ai_provider_profiles p ON p.id = r.providerId
		 ORDER BY CASE WHEN r.feature = 'default' THEN 0 ELSE 1 END, r.feature`,
	).all<AIModelRouteRow>();

	const config: AIModelRoutingConfig = { defaultRoute: null, featureRoutes: {} };
	for (const row of result.results) {
		const route = toRoute(row);
		if (row.feature === "default") config.defaultRoute = route;
		else config.featureRoutes[row.feature as AIFeature] = route;
	}
	return config;
}

export async function replaceAIModelRoutes(db: D1Database, routes: AIModelRouteInput[]): Promise<void> {
	const now = Date.now();
	const statements = [db.prepare("DELETE FROM ai_model_routes")];
	for (const route of routes) {
		statements.push(db.prepare(
			`INSERT INTO ai_model_routes (
				feature, providerId, model, temperature, topP, maxTokens, requestTimeoutSec, updatedAt
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			route.feature,
			route.providerId,
			route.model,
			route.temperature,
			route.topP,
			route.maxTokens,
			route.requestTimeoutSec,
			now,
		));
	}
	await db.batch(statements);
}
