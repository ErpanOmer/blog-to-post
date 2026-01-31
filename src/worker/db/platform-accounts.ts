import type { PlatformType, VerifyAccountResult } from "../types";
import "../accounts";
import { getAccountService } from "../accounts";

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

type PlatformAccountRow = Omit<PlatformAccount, "createdAt" | "updatedAt" | "isActive" | "isVerified" | "lastVerifiedAt"> & {
	isActive: number | null;
	isVerified: number | null;
	lastVerifiedAt: string | null;
	createdAt: string;
	updatedAt: string;
};

function mapPlatformAccount(row: PlatformAccountRow): PlatformAccount {
	return {
		...row,
		userId: row.userId ?? null,
		userName: row.userName ?? null,
		avatar: row.avatar ?? null,
		authToken: row.authToken ?? null,
		description: row.description ?? null,
		isActive: (row.isActive ?? 1) === 1,
		isVerified: (row.isVerified ?? 0) === 1,
		lastVerifiedAt: row.lastVerifiedAt ? Number(row.lastVerifiedAt) : null,
		createdAt: Number(row.createdAt),
		updatedAt: Number(row.updatedAt),
	};
}

export async function listPlatformAccounts(
	db: D1Database,
	platform?: PlatformType,
): Promise<PlatformAccount[]> {
	let query = "SELECT * FROM platform_accounts";
	const params: unknown[] = [];

	if (platform) {
		query += " WHERE platform = ?";
		params.push(platform);
	}

	query += " ORDER BY createdAt DESC";

	const result = await db.prepare(query).bind(...params).all<PlatformAccountRow>();
	return (result.results ?? []).map(mapPlatformAccount);
}

export async function getPlatformAccount(
	db: D1Database,
	id: string,
): Promise<PlatformAccount | null> {
	const result = await db
		.prepare("SELECT * FROM platform_accounts WHERE id = ?")
		.bind(id)
		.first<PlatformAccountRow>();
	return result ? mapPlatformAccount(result) : null;
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
): Promise<{ account: PlatformAccount; verifyResult: VerifyAccountResult; isDuplicate: boolean }> {
	if (!payload.authToken) {
		return {
			account: null as unknown as PlatformAccount,
			verifyResult: { valid: false, message: "未提供认证信息" },
			isDuplicate: false,
		};
	}

	const service = getAccountService(payload.platform, payload.authToken);
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
		return {
			account: mapPlatformAccount(existing),
			verifyResult: { valid: true, message: "该平台帐号已存在", accountInfo: userInfo },
			isDuplicate: true,
		};
	}

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
			payload.authToken,
			payload.description ?? null,
			Date.now(),
			payload.createdAt,
			payload.updatedAt,
		)
		.run();

	const account: PlatformAccount = {
		...payload,
		userId: userInfo.id,
		userName: userInfo.name,
		avatar: userInfo.avatar,
		authToken: payload.authToken,
		description: payload.description ?? null,
		isActive: true,
		isVerified: true,
		lastVerifiedAt: Date.now(),
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
): Promise<PlatformAccount | null> {
	const current = await getPlatformAccount(db, id);
	if (!current) {
		return null;
	}

	const next = {
		authToken: payload.authToken ?? current.authToken ?? null,
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
			next.authToken,
			next.description,
			next.isActive ? 1 : 0,
			next.isVerified ? 1 : 0,
			next.lastVerifiedAt,
			next.updatedAt,
			id,
		)
		.run();

	return { ...current, ...next };
}

export async function deletePlatformAccount(db: D1Database, id: string): Promise<boolean> {
	const current = await getPlatformAccount(db, id);
	if (!current) {
		return false;
	}

	await db.prepare("DELETE FROM platform_accounts WHERE id = ?").bind(id).run();
	return true;
}

export async function verifyPlatformAccount(
	db: D1Database,
	id: string,
): Promise<VerifyAccountResult> {
	const account = await getPlatformAccount(db, id);
	if (!account) {
		return { valid: false, message: "帐号不存在" };
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
		
		await updatePlatformAccount(db, id, {
			isVerified: result.valid,
			lastVerifiedAt: Date.now(),
		});

		return {
			valid: result.valid,
			message: result.message,
			accountInfo: result.accountInfo,
		};
	} catch (error) {
		await updatePlatformAccount(db, id, {
			isVerified: false,
			lastVerifiedAt: Date.now(),
		});
		return { valid: false, message: `验证失败: ${error instanceof Error ? error.message : "未知错误"}` };
	}
}

export async function getAccountStatus(
	db: D1Database,
	id: string,
): Promise<AccountStatus | null> {
	const account = await getPlatformAccount(db, id);
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

export async function publishArticle(
	db: D1Database,
	id: string,
	title: string,
	content: string,
	coverImage?: string,
): Promise<{ success: boolean; message: string; url?: string }> {
	const account = await getPlatformAccount(db, id);
	if (!account) {
		return { success: false, message: "帐号不存在" };
	}

	if (!account.authToken) {
		return { success: false, message: "请先配置认证信息" };
	}

	if (!account.isVerified) {
		return { success: false, message: "请先验证帐号的可用性" };
	}

	const service = getAccountService(account.platform, account.authToken);
	if (!service) {
		return { success: false, message: `不支持的平台类型: ${account.platform}` };
	}

	try {
		const result = await service.articlePublish(title, content, coverImage);
		return {
			success: result.success,
			message: result.message,
			url: result.url,
		};
	} catch (error) {
		return { success: false, message: error instanceof Error ? error.message : "发布失败" };
	}
}

import type { AccountStatus } from "../accounts";
