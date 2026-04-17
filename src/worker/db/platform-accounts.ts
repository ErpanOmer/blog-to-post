import type { AccountInfo, AccountStatus } from "@/worker/accounts";
import "../accounts";
import { getAccountService } from "@/worker/accounts";
import type { PlatformType, VerifyAccountResult } from "@/worker/types";
import { decrypt, encrypt, isEncrypted } from "@/worker/utils/crypto";

export interface PlatformAccount {
	id: string;
	platform: PlatformType;
	userId?: string | null;
	userName?: string | null;
	avatar?: string | null;
	authToken?: string | null;
	description?: string | null;
	isActive: boolean;
	isVerified: boolean;
	lastVerifiedAt?: number | null;
	createdAt: number;
	updatedAt: number;
}

type PlatformAccountRow = Omit<
	PlatformAccount,
	"createdAt" | "updatedAt" | "isActive" | "isVerified" | "lastVerifiedAt"
> & {
	isActive: number | null;
	isVerified: number | null;
	lastVerifiedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

function normalizeAuthToken(token?: string | null): string | null {
	if (token === undefined || token === null) return null;
	const trimmed = token.trim();
	return trimmed.length > 0 ? trimmed : null;
}

async function encryptAuthToken(
	token: string,
	encryptionKey?: string,
): Promise<string> {
	if (!encryptionKey) return token;
	if (isEncrypted(token)) return token;
	return encrypt(token, encryptionKey);
}

async function decryptAuthToken(
	token: string,
	encryptionKey?: string,
): Promise<string | null> {
	if (!token) return null;
	if (!isEncrypted(token)) return token;
	if (!encryptionKey) return null;

	try {
		return await decrypt(token, encryptionKey);
	} catch {
		return null;
	}
}

async function mapPlatformAccount(
	row: PlatformAccountRow,
	encryptionKey?: string,
): Promise<PlatformAccount> {
	const authToken = await decryptAuthToken(row.authToken ?? "", encryptionKey);
	return {
		...row,
		userId: row.userId ?? null,
		userName: row.userName ?? null,
		avatar: row.avatar ?? null,
		authToken,
		description: row.description ?? null,
		isActive: (row.isActive ?? 1) === 1,
		isVerified: (row.isVerified ?? 0) === 1,
		lastVerifiedAt: row.lastVerifiedAt ? Number(row.lastVerifiedAt) : null,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

async function getPlatformAccountRow(
	db: D1Database,
	id: string,
): Promise<PlatformAccountRow | null> {
	const result = await db
		.prepare("SELECT * FROM platform_accounts WHERE id = ?")
		.bind(id)
		.first<PlatformAccountRow>();
	return result ?? null;
}

async function refreshExistingPlatformAccountProfile(
	db: D1Database,
	params: {
		id: string;
		userInfo: AccountInfo;
		authToken: string;
		description?: string | null;
	},
	encryptionKey?: string,
): Promise<PlatformAccount | null> {
	const now = Date.now();
	const storedToken = await encryptAuthToken(params.authToken, encryptionKey);

	await db
		.prepare(
			"UPDATE platform_accounts SET userId = ?, userName = ?, avatar = ?, authToken = ?, description = ?, isActive = 1, isVerified = 1, lastVerifiedAt = ?, updatedAt = ? WHERE id = ?",
		)
		.bind(
			params.userInfo.id,
			params.userInfo.name,
			params.userInfo.avatar ?? null,
			storedToken,
			params.description ?? null,
			now,
			now,
			params.id,
		)
		.run();

	return getPlatformAccount(db, params.id, encryptionKey);
}

export async function listPlatformAccounts(
	db: D1Database,
	platform?: PlatformType,
	encryptionKey?: string,
): Promise<PlatformAccount[]> {
	let query = "SELECT * FROM platform_accounts";
	const params: unknown[] = [];

	if (platform) {
		query += " WHERE platform = ?";
		params.push(platform);
	}

	query += " ORDER BY createdAt DESC";

	const result = await db.prepare(query).bind(...params).all<PlatformAccountRow>();
	return Promise.all((result.results ?? []).map((row) => mapPlatformAccount(row, encryptionKey)));
}

export async function getPlatformAccount(
	db: D1Database,
	id: string,
	encryptionKey?: string,
): Promise<PlatformAccount | null> {
	const row = await getPlatformAccountRow(db, id);
	if (!row) return null;
	return mapPlatformAccount(row, encryptionKey);
}

export async function createPlatformAccount(
	db: D1Database,
	payload: {
		id: string;
		platform: PlatformType;
		authToken?: string | null;
		description?: string | null;
		createdAt: number;
		updatedAt: number;
	},
	encryptionKey?: string,
): Promise<{ account: PlatformAccount; verifyResult: VerifyAccountResult; isDuplicate: boolean }> {
	const token = normalizeAuthToken(payload.authToken);
	if (!token) {
		return {
			account: null as unknown as PlatformAccount,
			verifyResult: { valid: false, message: "未提供认证信息" },
			isDuplicate: false,
		};
	}

	const service = getAccountService(payload.platform, token);
	if (!service) {
		return {
			account: null as unknown as PlatformAccount,
			verifyResult: { valid: false, message: `不支持的平台类型: ${payload.platform}` },
			isDuplicate: false,
		};
	}

	const verifyResult = await service.verify();
	if (!verifyResult.valid) {
		return {
			account: null as unknown as PlatformAccount,
			verifyResult,
			isDuplicate: false,
		};
	}

	const userInfo = verifyResult.accountInfo;
	if (!userInfo) {
		return {
			account: null as unknown as PlatformAccount,
			verifyResult: { valid: false, message: "无法获取用户信息" },
			isDuplicate: false,
		};
	}

	const existing = await db
		.prepare("SELECT * FROM platform_accounts WHERE platform = ? AND userId = ?")
		.bind(payload.platform, userInfo.id)
		.first<PlatformAccountRow>();

	if (existing) {
		const refreshed = await refreshExistingPlatformAccountProfile(
			db,
			{
				id: existing.id,
				userInfo,
				authToken: token,
				description: payload.description ?? existing.description ?? null,
			},
			encryptionKey,
		);
		return {
			account: refreshed ?? await mapPlatformAccount(existing, encryptionKey),
			verifyResult: { valid: true, message: "该平台账号已存在，已刷新资料与登录态", accountInfo: userInfo },
			isDuplicate: true,
		};
	}

	const storedToken = await encryptAuthToken(token, encryptionKey);
	const now = Date.now();

	await db
		.prepare(
			"INSERT INTO platform_accounts (id, platform, userId, userName, avatar, authToken, description, isActive, isVerified, lastVerifiedAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?)",
		)
		.bind(
			payload.id,
			payload.platform,
			userInfo.id,
			userInfo.name,
			userInfo.avatar ?? null,
			storedToken,
			payload.description ?? null,
			now,
			payload.createdAt,
			payload.updatedAt,
		)
		.run();

	const account: PlatformAccount = {
		id: payload.id,
		platform: payload.platform,
		userId: userInfo.id,
		userName: userInfo.name,
		avatar: userInfo.avatar ?? null,
		authToken: token,
		description: payload.description ?? null,
		isActive: true,
		isVerified: true,
		lastVerifiedAt: now,
		createdAt: payload.createdAt,
		updatedAt: payload.updatedAt,
	};

	return { account, verifyResult, isDuplicate: false };
}

export async function updatePlatformAccount(
	db: D1Database,
	id: string,
	payload: {
		authToken?: string | null;
		description?: string | null;
		isActive?: boolean;
		isVerified?: boolean;
		lastVerifiedAt?: number | null;
	},
	encryptionKey?: string,
): Promise<PlatformAccount | null> {
	const currentRow = await getPlatformAccountRow(db, id);
	if (!currentRow) {
		return null;
	}
	const current = await mapPlatformAccount(currentRow, encryptionKey);

	const tokenFromPayload = normalizeAuthToken(payload.authToken);
	const shouldUpdateToken = payload.authToken !== undefined;
	const nextStoredToken = shouldUpdateToken
		? tokenFromPayload
			? await encryptAuthToken(tokenFromPayload, encryptionKey)
			: null
		: currentRow.authToken ?? null;

	const next = {
		description: payload.description ?? current.description ?? null,
		isActive: payload.isActive ?? current.isActive,
		isVerified: payload.isVerified ?? current.isVerified,
		lastVerifiedAt: payload.lastVerifiedAt ?? current.lastVerifiedAt ?? null,
		updatedAt: Date.now(),
	};

	await db
		.prepare(
			"UPDATE platform_accounts SET authToken = ?, description = ?, isActive = ?, isVerified = ?, lastVerifiedAt = ?, updatedAt = ? WHERE id = ?",
		)
		.bind(
			nextStoredToken,
			next.description,
			next.isActive ? 1 : 0,
			next.isVerified ? 1 : 0,
			next.lastVerifiedAt,
			next.updatedAt,
			id,
		)
		.run();

	const updated = await getPlatformAccount(db, id, encryptionKey);
	return updated ?? { ...current, ...next, authToken: shouldUpdateToken ? tokenFromPayload : current.authToken };
}

export async function deletePlatformAccount(db: D1Database, id: string): Promise<boolean> {
	const current = await getPlatformAccountRow(db, id);
	if (!current) {
		return false;
	}

	await db.prepare("DELETE FROM platform_accounts WHERE id = ?").bind(id).run();
	return true;
}

export async function verifyPlatformAccount(
	db: D1Database,
	id: string,
	encryptionKey?: string,
): Promise<VerifyAccountResult> {
	const account = await getPlatformAccount(db, id, encryptionKey);
	if (!account) {
		return { valid: false, message: "账号不存在" };
	}

	if (!account.authToken) {
		return { valid: false, message: "请先配置认证信息" };
	}

	const service = getAccountService(account.platform, account.authToken);
	if (!service) {
		return { valid: false, message: `不支持的平台类型: ${account.platform}` };
	}

	try {
		const result = await service.verify();
		const now = Date.now();

		if (result.valid && result.accountInfo) {
			await db
				.prepare(
					"UPDATE platform_accounts SET userId = ?, userName = ?, avatar = ?, isVerified = 1, lastVerifiedAt = ?, updatedAt = ? WHERE id = ?",
				)
				.bind(
					result.accountInfo.id,
					result.accountInfo.name,
					result.accountInfo.avatar ?? account.avatar ?? null,
					now,
					now,
					id,
				)
				.run();
		} else {
			await updatePlatformAccount(
				db,
				id,
				{
					isVerified: result.valid,
					lastVerifiedAt: now,
				},
				encryptionKey,
			);
		}

		return {
			valid: result.valid,
			message: result.message,
			accountInfo: result.accountInfo,
		};
	} catch (error) {
		await updatePlatformAccount(
			db,
			id,
			{
				isVerified: false,
				lastVerifiedAt: Date.now(),
			},
			encryptionKey,
		);
		return {
			valid: false,
			message: `验证失败: ${error instanceof Error ? error.message : "未知错误"}`,
		};
	}
}

export async function getAccountStatus(
	db: D1Database,
	id: string,
	encryptionKey?: string,
): Promise<AccountStatus | null> {
	const account = await getPlatformAccount(db, id, encryptionKey);
	if (!account) {
		return null;
	}

	if (!account.authToken) {
		return {
			isActive: false,
			isVerified: false,
			lastVerifiedAt: account.lastVerifiedAt ?? 0,
			message: "请先配置认证信息",
		};
	}

	const service = getAccountService(account.platform, account.authToken);
	if (!service) {
		return {
			isActive: false,
			isVerified: account.isVerified,
			lastVerifiedAt: account.lastVerifiedAt ?? 0,
			message: `不支持的平台类型: ${account.platform}`,
		};
	}

	try {
		return await service.status();
	} catch (error) {
		return {
			isActive: false,
			isVerified: account.isVerified,
			lastVerifiedAt: account.lastVerifiedAt ?? 0,
			message: error instanceof Error ? error.message : "获取状态失败",
		};
	}
}
