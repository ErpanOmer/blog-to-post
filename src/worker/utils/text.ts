/**
 * 提取文本的第一行
 */
export function pickFirstLine(text: string) {
    const line = text.split("\n").find((item) => item.trim());
    return line?.trim() ?? "";
}

/**
 * 规范化标签字符串
 * 将逗号分隔的字符串转换为数组，保留前6个非空标签
 */
export function normalizeTags(text: string) {
    return text
        .split(/[,，\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 6);
}
