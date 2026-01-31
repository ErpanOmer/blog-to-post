import type { PlatformType } from "../types";

export interface AccountInfo {
    id: string;
    name: string;
    avatar?: string;
    isLogin: boolean;
    isRealname?: boolean;
}

export interface AccountStatus {
    isActive: boolean;
    isVerified: boolean;
    lastVerifiedAt: number;
    message: string;
}

export interface ArticleDraft {
    id: string;
    title: string;
    content: string;
    createdAt: number;
}

export interface Article {
    id: string;
    title: string;
    content: string;
    publishedAt?: number;
    status: "draft" | "published" | "deleted";
}

export interface VerifyResult {
    valid: boolean;
    message: string;
    accountInfo?: AccountInfo;
}

export interface ArticlePublishResult {
    success: boolean;
    articleId?: string;
    message: string;
    url?: string;
}

export interface ImageUploadResult {
    success: boolean;
    url?: string;
    message: string;
}

export interface AccountService {
    platform: PlatformType;

    verify(): Promise<VerifyResult>;

    status(): Promise<AccountStatus>;

    info(): Promise<AccountInfo>;

    articleDraft(): Promise<ArticleDraft | null>;

    articlePublish(title: string, content: string, coverImage?: string): Promise<ArticlePublishResult>;

    articleDelete(articleId: string): Promise<{ success: boolean; message: string }>;

    articleList(page?: number, pageSize?: number): Promise<Article[]>;

    articleDetail(articleId: string): Promise<Article | null>;

    articleTags(articleId: string): Promise<string[]>;

    imageUpload(imageData: string, filename?: string): Promise<ImageUploadResult>;
}

export type AccountServiceConstructor = new (authToken: string) => AccountService;
