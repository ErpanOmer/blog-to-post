export type PlatformType = "juejin" | "zhihu" | "wechat" | "csdn" | "cnblogs" | "segmentfault" | "51cto" | "website" | "";
export type ArticleStatus = "draft" | "reviewed" | "scheduled" | "published" | "failed";
export type PromptKey = "title" | "content" | "summary" | "tags" | "cover";

export interface PublishContentSlots {
    useCoverImageAsHeader?: boolean;
    headerSlot?: string | null;
    footerSlot?: string | null;
    headerMarkdown?: string | null;
    headerHtml?: string | null;
    footerMarkdown?: string | null;
    footerHtml?: string | null;
}

export type PublishablePlatformType = Exclude<PlatformType, "">;

export interface PlatformPublishSetting {
    platform: PublishablePlatformType;
    enabled: boolean;
    draftOnly: boolean;
    useCoverImageAsHeader: boolean;
    headerSlot: string;
    footerSlot: string;
}

export type PlatformPublishSettingsMap = Record<PublishablePlatformType, PlatformPublishSetting>;

export interface Article {
    id: string;
    title: string;
    content: string;
    htmlContent?: string | null;
    summary?: string | null;
    tags?: string[] | null;
    coverImage?: string | null;
    platform: PlatformType;
    status: ArticleStatus;
    publishedAt?: number | null;
    createdAt: number;
    updatedAt: number;
    draftId?: string;
    contentSlots?: PublishContentSlots | null;
}

export interface PlatformAccount {
    id: string;
    platform: PlatformType;
    authToken?: string | null;
    description?: string | null;
    isActive: boolean;
    isVerified: boolean;
    lastVerifiedAt?: number | null;
    createdAt: number;
    updatedAt: number;
}

export interface VerifyAccountResult {
    valid: boolean;
    message: string;
    accountInfo?: {
        id: string;
        name: string;
        isLogin: boolean;
    };
}

export interface Task {
    id: string;
    type: "generate" | "publish";
    status: "pending" | "success" | "failed";
    payload: Record<string, unknown>;
}

export interface GenerateContentInput {
    title: string;
}

export interface GenerateSummaryInput {
    title: string;
    content: string;
}

export interface GenerateTagsInput {
    title: string;
    content: string;
}

export interface GenerateCoverInput {
    title: string;
    content: string;
}

export type AIProviderProtocol = "openai-compatible" | "anthropic";
export type AIFeature = "title" | "content" | "summary" | "tags" | "cover" | "website_slug";
export type AIModelRouteFeature = "default" | AIFeature;

export interface AIProviderProfileSummary {
    id: string;
    name: string;
    protocol: AIProviderProtocol;
    baseUrl: string;
    defaultModel: string;
    enabled: boolean;
    hasApiKey: boolean;
    lastVerifiedAt?: number | null;
    lastVerificationStatus?: "success" | "failed" | null;
    lastVerificationMessage?: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface CreateAIProviderProfileInput {
    name: string;
    protocol: AIProviderProtocol;
    baseUrl: string;
    apiKey?: string;
    defaultModel: string;
    enabled?: boolean;
}

export interface UpdateAIProviderProfileInput {
    name?: string;
    protocol?: AIProviderProtocol;
    baseUrl?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    defaultModel?: string;
    enabled?: boolean;
}

export interface AIModelRoute {
    feature: AIModelRouteFeature;
    providerId: string;
    providerName?: string;
    protocol?: AIProviderProtocol;
    model: string;
    temperature: number | null;
    topP: number | null;
    maxTokens: number | null;
    requestTimeoutSec: number | null;
    updatedAt: number;
}

export type AIModelRouteInput = Omit<AIModelRoute, "providerName" | "protocol" | "updatedAt">;

export interface AIModelRoutingConfig {
    defaultRoute: AIModelRoute | null;
    featureRoutes: Partial<Record<AIFeature, AIModelRoute>>;
}

export interface AIProviderModelsResult {
    supported: boolean;
    models: string[];
    message: string;
}

export interface AIProviderTestResult {
    success: true;
    message: string;
    provider: {
        name: string;
        protocol: AIProviderProtocol;
        model: string;
    };
    testedAt: number;
}

export interface AIErrorResponse {
    success: false;
    error_code:
        | "AI_PROVIDER_NOT_CONFIGURED"
        | "AI_AUTH_FAILED"
        | "AI_MODEL_NOT_FOUND"
        | "AI_RATE_LIMITED"
        | "AI_TIMEOUT"
        | "AI_INVALID_RESPONSE"
        | "AI_PROVIDER_UNAVAILABLE"
        | "AI_INVALID_CONFIGURATION";
    message: string;
    timestamp: number;
}

export interface ProviderStatus {
    provider: string;
    ready: boolean;
    lastCheckedAt: number;
    message: string;
    defaultModel?: string;
    providerId?: string;
    profileName?: string;
    protocol?: AIProviderProtocol;
    model?: string;
}

export interface PromptTemplate {
    key: PromptKey;
    template: string;
}

export interface AIModelSettings {
    defaultModel: string;
    temperature: number;
    topP: number;
    maxTokens: number;
    requestTimeoutSec: number;
}

export interface AIModelCatalog {
    defaultModel: string;
    cloudModels: string[];
    localModels: string[];
    models: string[];
}

export interface ArticleAISettings {
    temperature: number;
    topP: number;
    summaryPrompt: string;
    tagsPrompt: string;
}
