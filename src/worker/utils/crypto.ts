/**
 * 加密工具模块
 * 用于加密/解密敏感数据（如平台 AuthToken）
 * 使用 AES-GCM 算法，密钥从环境变量 ENCRYPTION_KEY 获取
 */

// 将十六进制字符串转换为 Uint8Array
function hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// 将 Uint8Array 转换为十六进制字符串
function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

// 将字符串转换为 Uint8Array
function stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
}

// 将 Uint8Array 转换为字符串
function bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
}

/**
 * 从环境变量获取加密密钥
 * 密钥应为 32 字节（256 位）的十六进制字符串
 */
async function getEncryptionKey(encryptionKeyHex: string): Promise<CryptoKey> {
    const keyBytes = hexToBytes(encryptionKeyHex);

    if (keyBytes.length !== 32) {
        throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex characters)");
    }

    return crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * 加密字符串
 * @param plaintext 明文
 * @param encryptionKeyHex 加密密钥（十六进制字符串）
 * @returns 加密后的字符串（格式：iv:ciphertext，均为十六进制）
 */
export async function encrypt(plaintext: string, encryptionKeyHex: string): Promise<string> {
    if (!encryptionKeyHex) {
        // 如果没有配置加密密钥，返回原文（开发环境兼容）
        console.warn("[crypto] ENCRYPTION_KEY not configured, storing plaintext");
        return plaintext;
    }

    const key = await getEncryptionKey(encryptionKeyHex);

    // 生成随机 IV（12 字节是 AES-GCM 推荐值）
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 加密
    const plaintextBytes = stringToBytes(plaintext);
    const ciphertextBytes = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintextBytes
    );

    // 返回格式：iv:ciphertext（均为十六进制）
    const ivHex = bytesToHex(iv);
    const ciphertextHex = bytesToHex(new Uint8Array(ciphertextBytes));

    return `${ivHex}:${ciphertextHex}`;
}

/**
 * 解密字符串
 * @param encrypted 加密后的字符串（格式：iv:ciphertext）
 * @param encryptionKeyHex 加密密钥（十六进制字符串）
 * @returns 解密后的明文
 */
export async function decrypt(encrypted: string, encryptionKeyHex: string): Promise<string> {
    if (!encryptionKeyHex) {
        // 如果没有配置加密密钥，假设是明文
        return encrypted;
    }

    // 检查是否是加密格式
    if (!encrypted.includes(":")) {
        // 不是加密格式，可能是旧数据，直接返回
        return encrypted;
    }

    const [ivHex, ciphertextHex] = encrypted.split(":");

    if (!ivHex || !ciphertextHex) {
        throw new Error("Invalid encrypted format");
    }

    const key = await getEncryptionKey(encryptionKeyHex);
    const iv = hexToBytes(ivHex);
    const ciphertextBytes = hexToBytes(ciphertextHex);

    // 解密
    const plaintextBytes = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        ciphertextBytes
    );

    return bytesToString(new Uint8Array(plaintextBytes));
}

/**
 * 检查字符串是否已加密
 */
export function isEncrypted(value: string): boolean {
    // 加密格式：24位十六进制(IV) + ':' + 至少32位十六进制(ciphertext+tag)
    const parts = value.split(":");
    if (parts.length !== 2) return false;

    const [ivHex, ciphertextHex] = parts;
    // IV 是 12 字节 = 24 个十六进制字符
    // Ciphertext 至少应该比原文长（包含 16 字节的 auth tag）
    return ivHex.length === 24 && ciphertextHex.length >= 32 && /^[0-9a-f]+$/i.test(ivHex) && /^[0-9a-f]+$/i.test(ciphertextHex);
}

/**
 * 生成新的加密密钥（用于初始化）
 * 返回 32 字节的十六进制字符串
 */
export function generateEncryptionKey(): string {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    return bytesToHex(keyBytes);
}
