import { accountServiceRegistry, registerAccountService, getAccountService } from "./registry";
import type {
	AccountInfo,
	AccountStatus,
	ArticleDraft,
	Article,
	VerifyResult,
	ArticlePublishResult,
	ImageUploadResult,
	AccountService,
	AccountServiceConstructor
} from "./types";

export type {
	AccountInfo,
	AccountStatus,
	ArticleDraft,
	Article,
	VerifyResult,
	ArticlePublishResult,
	ImageUploadResult,
	AccountService,
	AccountServiceConstructor
};

export {
	accountServiceRegistry,
	registerAccountService,
	getAccountService,
};

import "./juejin";
import "./zhihu";
import "./xiaohongshu";
import "./wechat";
import "./csdn";

export type { JuejinUserInfo, ZhihuUserInfo, XiaohongshuUserInfo, WechatUserInfo, CSDNUserInfo } from "./abstract";
