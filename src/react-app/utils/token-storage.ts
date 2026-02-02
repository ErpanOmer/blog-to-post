/**
 * 平台账号 Token 本地存储管理
 * 
 * 为了安全考虑，敏感的 authToken 存储在浏览器本地，不上传到服务器。
 * 服务器端只保存账号的元数据（平台、用户名、头像等）。
 * 
 * 存储结构: { [accountId]: encryptedToken }
 */

const STORAGE_KEY = "blog-to-post:platform-tokens";
const ENCRYPTION_SALT = "blog-to-post-v1"; // 用于简单混淆

/**
 * 简单的 Base64 编码混淆（非真正加密，但防止明文存储）
 * 生产环境建议使用 Web Crypto API 进行真正的加密
 */
function obfuscate(text: string): string {
    try {
        const withSalt = `${ENCRYPTION_SALT}:${text}`;
        return btoa(encodeURIComponent(withSalt));
    } catch {
        console.warn("Token 混淆失败");
        return text;
    }
}

function deobfuscate(encoded: string): string {
    try {
        const decoded = decodeURIComponent(atob(encoded));
        if (decoded.startsWith(`${ENCRYPTION_SALT}:`)) {
            return decoded.slice(ENCRYPTION_SALT.length + 1);
        }
        return decoded;
    } catch {
        console.warn("Token 解混淆失败，返回原始值");
        return encoded;
    }
}

/**
 * 获取所有存储的 Token 映射
 */
function getAllTokens(): Record<string, string> {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return {};
        return JSON.parse(stored);
    } catch {
        console.warn("读取本地 Token 存储失败");
        return {};
    }
}

/**
 * 保存所有 Token 到本地存储
 */
function saveAllTokens(tokens: Record<string, string>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    } catch (error) {
        console.error("保存 Token 到本地存储失败:", error);
    }
}

/**
 * 保存账号的 Token 到浏览器本地存储
 */
export function saveAccountToken(accountId: string, token: string): void {
    if (!accountId || !token) return;

    const tokens = getAllTokens();
    tokens[accountId] = obfuscate(token);
    saveAllTokens(tokens);

    console.log(`[TokenStorage] 已保存账号 ${accountId} 的 Token 到本地`);
}

/**
 * 从浏览器本地存储获取账号的 Token
 */
export function getAccountToken(accountId: string): string | null {
    if (!accountId) return null;

    const tokens = getAllTokens();
    const encoded = tokens[accountId];

    if (!encoded) return null;

    return deobfuscate(encoded);
}

/**
 * 从浏览器本地存储删除账号的 Token
 */
export function removeAccountToken(accountId: string): void {
    if (!accountId) return;

    const tokens = getAllTokens();
    delete tokens[accountId];
    saveAllTokens(tokens);

    console.log(`[TokenStorage] 已删除账号 ${accountId} 的本地 Token`);
}

/**
 * 检查账号是否有本地存储的 Token
 */
export function hasAccountToken(accountId: string): boolean {
    return getAccountToken(accountId) !== null;
}

/**
 * 清除所有本地存储的 Token（用于退出登录或清理）
 */
export function clearAllTokens(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        console.log("[TokenStorage] 已清除所有本地 Token");
    } catch (error) {
        console.error("清除本地 Token 失败:", error);
    }
}

/**
 * 导出所有 Token（用于备份，返回解密后的数据）
 */
export function exportTokens(): Record<string, string> {
    const tokens = getAllTokens();
    const decrypted: Record<string, string> = {};

    for (const [accountId, encoded] of Object.entries(tokens)) {
        decrypted[accountId] = deobfuscate(encoded);
    }

    return decrypted;
}

/**
 * 导入 Token（用于恢复备份）
 */
export function importTokens(tokens: Record<string, string>): void {
    const encrypted: Record<string, string> = {};

    for (const [accountId, token] of Object.entries(tokens)) {
        encrypted[accountId] = obfuscate(token);
    }

    saveAllTokens(encrypted);
    console.log(`[TokenStorage] 已导入 ${Object.keys(tokens).length} 个 Token`);
}
