import type { PlatformType } from "@/worker/types";

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
		return `# 这篇技术干货你一定要看\n\n${content}\n\n#技术分享 #效率工具 #工程实践`;
	}
}

class WechatAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 正式技术分享\n\n${content}\n\n公众号排版建议：分节、要点加粗。`;
	}
}

class CSDNAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# CSDN 技术发布\n\n${content}\n\n> 本文由自动分发系统生成。`;
	}
}

class CnblogsAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# 博客园技术发布\n\n${content}\n\n> 本文由自动分发系统生成。`;
	}
}

class SegmentFaultAdapter implements PlatformAdapter {
	adapt(content: string) {
		return `# SegmentFault 技术发布\n\n${content}\n\n> 本文由自动分发系统生成。`;
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
		case "csdn":
			return new CSDNAdapter();
		case "cnblogs":
			return new CnblogsAdapter();
		case "segmentfault":
			return new SegmentFaultAdapter();
		default:
			throw new Error(`Unsupported platform: ${platform}`);
	}
}