import type { PlatformType } from "../types";

export interface PlatformAdapter {
	adapt(content: string): string;
}

class JuejinAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 技术详解\n\n${content}\n\n> 掘金强调结构化输出与代码可读性。`;
	}
}

class ZhihuAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 从场景出发的技术叙事\n\n${content}\n\n结语：欢迎讨论更多细节。`;
	}
}

class XiaohongshuAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 这篇技术干货你一定要看✨\n\n${content}\n\n#技术分享 #效率工具 #工程实践 🚀`;
	}
}

class WechatAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 正式技术分享\n\n${content}\n\n—— 公众号排版建议：分节、要点加粗。`;
	}
}

export function getPlatformAdapter(platform: PlatformType): PlatformAdapter {
	switch (platform) {
		case "juejin":
			return new JuejinAdapter();
		case "zhihu":
			return new ZhihuAdapter();
		case "xiaohongshu":
			return new XiaohongshuAdapter();
		case "wechat":
			return new WechatAdapter();
	}
}
