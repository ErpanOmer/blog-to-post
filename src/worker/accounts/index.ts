import { accountServiceRegistry, registerAccountService, getAccountService } from "@/worker/accounts/registry";
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
} from "@/worker/accounts/types";

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
import "./cnblogs";
import "./segmentfault";

export type { JuejinUserInfo, ZhihuUserInfo, XiaohongshuUserInfo, WechatUserInfo, CSDNUserInfo } from "@/worker/accounts/abstract";
