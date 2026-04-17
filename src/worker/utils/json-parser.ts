/**
 * JSON 提取工具
 * 用于从 LLM 输出中可靠地提取 JSON 内容
 * 处理常见的 LLM 输出问题：Markdown 代码块、多余文本、格式错误等
 */

/**
 * 从可能包含 Markdown 代码块的文本中提取 JSON
 * @param text LLM 的原始输出
 * @returns 清洗后的 JSON 字符串
 */
export function extractJsonString(text: string): string {
    if (!text || typeof text !== "string") {
        return "";
    }

    let cleaned = text.trim();

    // 1. 尝试移除 Markdown 代码块标记 ```json ... ``` 或 ``` ... ```
    const jsonBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
        cleaned = jsonBlockMatch[1].trim();
    }

    // 2. 尝试找到 JSON 数组或对象的边界
    // 找第一个 [ 或 { 和对应的最后一个 ] 或 }
    const arrayStart = cleaned.indexOf("[");
    const objectStart = cleaned.indexOf("{");

    let startIndex = -1;
    let endChar = "";

    if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
        startIndex = arrayStart;
        endChar = "]";
    } else if (objectStart >= 0) {
        startIndex = objectStart;
        endChar = "}";
    }

    if (startIndex >= 0) {
        const endIndex = cleaned.lastIndexOf(endChar);
        if (endIndex > startIndex) {
            cleaned = cleaned.slice(startIndex, endIndex + 1);
        }
    }

    return cleaned;
}

/**
 * 安全地解析 JSON，带有自动清洗和回退逻辑
 * @param text LLM 的原始输出
 * @param fallback 解析失败时的回退值
 * @returns 解析后的对象或回退值
 */
function looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed) return false;
    const first = trimmed[0];
    return first === "{" || first === "[" || first === "\"";
}

export function safeParseJson<T>(text: string, fallback: T): T {
    const cleaned = extractJsonString(text);
    if (!cleaned) {
        return fallback;
    }

    // 对纯文本结果（例如摘要/标题）直接回退，不打 JSON 失败告警。
    if (!looksLikeJson(cleaned)) {
        return fallback;
    }

    try {
        return JSON.parse(cleaned) as T;
    } catch {
        console.warn("[safeParseJson] JSON 解析失败，返回回退值:", text.slice(0, 100));
        return fallback;
    }
}

/**
 * 从 LLM 输出中提取字符串数组
 * 处理多种格式：JSON 数组、带编号列表、换行分隔等
 * @param text LLM 的原始输出
 * @param maxItems 最大返回项数
 * @returns 字符串数组
 */
export function extractStringArray(text: string, maxItems = 10): string[] {
    if (!text || typeof text !== "string") {
        return [];
    }

    // 1. 先尝试 JSON 解析
    try {
        const cleaned = extractJsonString(text);
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((item) => typeof item === "string" && item.trim())
                .map((item) => item.trim())
                .slice(0, maxItems);
        }
    } catch {
        // 继续尝试其他格式
    }

    // 2. 尝试按行解析（移除常见的列表前缀）
    const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        // 移除 Markdown 列表标记: - * 1. 1) 等
        .map((line) => line.replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, ""))
        // 移除引号包裹
        .map((line) => line.replace(/^["'](.+)["']$/, "$1"))
        .filter((line) => line.length > 0 && !line.startsWith("```"));

    return lines.slice(0, maxItems);
}

/**
 * 从 LLM 输出中提取带有特定字段的对象
 * @param text LLM 的原始输出
 * @param requiredFields 必须包含的字段名
 * @returns 解析后的对象或 null
 */
export function extractObject<T extends Record<string, unknown>>(
    text: string,
    requiredFields: (keyof T)[] = []
): T | null {
    const parsed = safeParseJson<T | null>(text, null);

    if (!parsed || typeof parsed !== "object") {
        return null;
    }

    // 检查必需字段
    for (const field of requiredFields) {
        if (!(field in parsed)) {
            console.warn(`[extractObject] 缺少必需字段: ${String(field)}`);
            return null;
        }
    }

    return parsed;
}
