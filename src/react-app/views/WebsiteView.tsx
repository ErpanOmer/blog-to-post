import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bot, CalendarDays, Edit3, ExternalLink, Globe2, Loader2, RefreshCw, Search, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteWebsitePost,
  getAIModelSettings,
  getAIModels,
  getWebsitePosts,
  getWebsiteSlugSettings,
  publishWebsitePost,
  unpublishWebsitePost,
  updateWebsiteSlugSettings,
  type WebsitePost,
  type WebsiteSource,
  type WebsiteSlugSettings,
} from "@/react-app/api";

type WebsiteStatusFilter = "all" | "draft" | "published";
type WebsiteSortValue = "createdAt:desc" | "createdAt:asc" | "updatedAt:desc" | "updatedAt:asc";

const PAGE_SIZE = 20;
const STORAGE_KEY = "blog-to-post.website.list-state.v1";

function isLocalWebsiteDashboard(): boolean {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function normalizeWebsiteSource(value: unknown): WebsiteSource {
  if (isLocalWebsiteDashboard() && value === "local") return "local";
  return "remote";
}

function getDefaultWebsiteBaseUrl(): string {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:4321";
  }
  return "https://erpanomer.nurverse.com";
}

function resolvePostUrl(post: WebsitePost): string {
  return post.url || post.publishedUrl || `${getDefaultWebsiteBaseUrl()}/blog/${post.slug}`;
}

function getWebsiteSourceBaseUrl(source: WebsiteSource): string {
  return source === "local" ? "http://localhost:4321" : "https://erpanomer.nurverse.com";
}

function readInitialState(): { status: WebsiteStatusFilter; sort: WebsiteSortValue; query: string; source: WebsiteSource } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "all", sort: "createdAt:desc", query: "", source: isLocalWebsiteDashboard() ? "local" : "remote" };
    const parsed = JSON.parse(raw) as Partial<{ status: WebsiteStatusFilter; sort: WebsiteSortValue; query: string; source: WebsiteSource }>;
    return {
      status: parsed.status === "draft" || parsed.status === "published" || parsed.status === "all" ? parsed.status : "all",
      sort: parsed.sort === "createdAt:asc" || parsed.sort === "updatedAt:desc" || parsed.sort === "updatedAt:asc" || parsed.sort === "createdAt:desc" ? parsed.sort : "createdAt:desc",
      query: typeof parsed.query === "string" ? parsed.query : "",
      source: normalizeWebsiteSource(parsed.source),
    };
  } catch {
    return { status: "all", sort: "createdAt:desc", query: "", source: isLocalWebsiteDashboard() ? "local" : "remote" };
  }
}

function getPostTime(post: WebsitePost, field: "createdAt" | "updatedAt"): number {
  const raw = field === "createdAt"
    ? post.createdAt ?? post.publishedAt ?? post.pubDate
    : post.updatedAt ?? post.lastModified ?? post.createdAt ?? post.pubDate;
  if (typeof raw === "number") return raw;
  const parsed = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortPosts(posts: WebsitePost[], sort: WebsiteSortValue): WebsitePost[] {
  const [field, direction] = sort.split(":") as ["createdAt" | "updatedAt", "asc" | "desc"];
  return [...posts].sort((a, b) => {
    const diff = getPostTime(a, field) - getPostTime(b, field);
    return direction === "asc" ? diff : -diff;
  });
}

function WebsiteSlugSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [settings, setSettings] = useState<WebsiteSlugSettings | null>(null);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [globalDefaultModel, setGlobalDefaultModel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || settings) return;
    let cancelled = false;
    void (async () => {
      try {
        const [data, catalog, globalSettings] = await Promise.all([
          getWebsiteSlugSettings(),
          getAIModels(),
          getAIModelSettings(),
        ]);
        if (!cancelled) {
          setSettings(data);
          setGlobalDefaultModel(globalSettings.defaultModel);
          setModelOptions([...new Set([
            data.model,
            globalSettings.defaultModel,
            ...catalog.models,
            ...catalog.cloudModels,
            ...catalog.localModels,
          ].map((model) => model.trim()).filter(Boolean))]);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "加载 slug 配置失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, settings]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const next = await updateWebsiteSlugSettings(settings);
      setSettings(next);
      toast.success("Slug AI 配置已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 slug 配置失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            Website Slug AI 配置
          </DialogTitle>
          <DialogDescription>
            这里仅配置分发到个人网站时的 SEO slug 生成规则，实际 slug 会在 website 适配器发布流程里自动生成。
          </DialogDescription>
        </DialogHeader>
        {settings ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="space-y-2 md:col-span-2">
                <Label>模型</Label>
                <Select
                  value={settings.model.trim() || "__global__"}
                  onValueChange={(value) => setSettings((prev) => prev ? { ...prev, model: value === "__global__" ? "" : value } : prev)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">
                      继承全局模型{globalDefaultModel ? `（${globalDefaultModel}）` : ""}
                    </SelectItem>
                    {modelOptions.map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>超时秒数</Label>
                <Input type="number" value={settings.requestTimeoutSec} onChange={(event) => setSettings((prev) => prev ? { ...prev, requestTimeoutSec: Number(event.target.value) } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>maxTokens</Label>
                <Input type="number" value={settings.maxTokens} onChange={(event) => setSettings((prev) => prev ? { ...prev, maxTokens: Number(event.target.value) } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>temperature</Label>
                <Input type="number" step="0.05" value={settings.temperature} onChange={(event) => setSettings((prev) => prev ? { ...prev, temperature: Number(event.target.value) } : prev)} />
              </div>
              <div className="space-y-2">
                <Label>topP</Label>
                <Input type="number" step="0.05" value={settings.topP} onChange={(event) => setSettings((prev) => prev ? { ...prev, topP: Number(event.target.value) } : prev)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prompt</Label>
              <Textarea value={settings.systemPrompt} onChange={(event) => setSettings((prev) => prev ? { ...prev, systemPrompt: event.target.value } : prev)} className="min-h-[220px] font-mono text-xs" />
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                保存配置
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WebsiteView() {
  const navigate = useNavigate();
  const initialState = useMemo(() => readInitialState(), []);
  const [posts, setPosts] = useState<WebsitePost[]>([]);
  const [status, setStatus] = useState<WebsiteStatusFilter>(initialState.status);
  const [sort, setSort] = useState<WebsiteSortValue>(initialState.sort);
  const [query, setQuery] = useState(initialState.query);
  const [source, setSource] = useState<WebsiteSource>(initialState.source);
  const [debouncedQuery, setDebouncedQuery] = useState(initialState.query);
  const [cursor, setCursor] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingSlug, setUpdatingSlug] = useState<string | null>(null);
  const [slugSettingsOpen, setSlugSettingsOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, sort, query, source }));
  }, [query, sort, source, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const visiblePosts = useMemo(() => sortPosts(posts, sort), [posts, sort]);
  const filteredCountText = useMemo(() => `${posts.length} 篇文章`, [posts.length]);

  const loadPosts = useCallback(async (nextCursor = 0, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadError(null);
    }

    try {
      const [sortBy, sortOrder] = sort.split(":") as ["createdAt" | "updatedAt", "asc" | "desc"];
      const result = await getWebsitePosts({
        status,
        q: debouncedQuery.trim() || undefined,
        limit: PAGE_SIZE,
        cursor: nextCursor,
        sortBy,
        sortOrder,
        source,
      });
      setPosts((prev) => append ? sortPosts([...prev, ...result.items], sort) : sortPosts(result.items, sort));
      setCursor(result.nextCursor ?? nextCursor + result.items.length);
      setHasMore(result.hasMore);
      setLoadError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "加载个人网站文章失败";
      if (!append) {
        setPosts([]);
        setCursor(0);
        setHasMore(false);
        setLoadError(message);
      }
      toast.error(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [debouncedQuery, sort, source, status]);

  useEffect(() => {
    void loadPosts(0, false);
  }, [loadPosts]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadPosts(cursor, true);
      }
    }, { rootMargin: "240px" });

    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, hasMore, loadPosts, loading, loadingMore]);

  const handleToggleDraft = async (post: WebsitePost, nextDraft: boolean) => {
    setUpdatingSlug(post.slug);
    try {
      if (nextDraft) {
        await unpublishWebsitePost(post.slug, source);
        toast.success("已转为草稿");
      } else {
        await publishWebsitePost(post.slug, source);
        toast.success("已发布到个人网站");
      }
      await loadPosts(0, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新发布状态失败");
    } finally {
      setUpdatingSlug(null);
    }
  };

  const handleDelete = async (post: WebsitePost) => {
    if (!window.confirm(`确认删除「${post.title}」吗？`)) return;
    setUpdatingSlug(post.slug);
    try {
      await deleteWebsitePost(post.slug, source);
      toast.success("个人网站文章已删除");
      await loadPosts(0, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除失败");
    } finally {
      setUpdatingSlug(null);
    }
  };

  return (
    <div className="space-y-4 page-enter">
      <Card>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe2 className="h-5 w-5 text-brand-500" />
                个人网站文章
              </CardTitle>
              <p className="mt-1 text-[13px] text-slate-500">
                当前连接 {getWebsiteSourceBaseUrl(source)}，这里仅维护个人网站已有文章；新文章请从 /articles/new 创建后分发到个人网站。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-xs shadow-sm">
                {isLocalWebsiteDashboard() ? (
                  <button
                    type="button"
                    onClick={() => setSource("local")}
                    className={`rounded-full px-3 py-1.5 transition-colors ${source === "local" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                  >
                    本地
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setSource("remote")}
                  className={`rounded-full px-3 py-1.5 transition-colors ${source === "remote" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                >
                  线上
                </button>
              </div>
              <Button variant="outline" onClick={() => setSlugSettingsOpen(true)} className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Slug 配置
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_200px_auto] lg:items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索标题、摘要或标签"
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={(value) => setStatus(value as WebsiteStatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="文章状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部文章</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => setSort(value as WebsiteSortValue)}>
              <SelectTrigger>
                <SelectValue placeholder="排序" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt:desc">创建时间倒序</SelectItem>
                <SelectItem value="createdAt:asc">创建时间正序</SelectItem>
                <SelectItem value="updatedAt:desc">修改时间倒序</SelectItem>
                <SelectItem value="updatedAt:asc">修改时间正序</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => loadPosts(0, false)} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              刷新
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{filteredCountText}</span>
            <span>分页每次加载 {PAGE_SIZE} 条，状态与排序会自动保留。</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 py-20">
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center">
              <p className="text-sm font-medium text-slate-700">{loadError ? "加载失败" : "暂无个人网站文章"}</p>
              <p className="mx-auto mt-1 max-w-xl text-xs text-slate-500">
                {loadError
                  ? `当前数据源为 ${source === "local" ? "本地" : "线上"}，错误信息：${loadError}`
                  : "请确认个人网站 Admin API 已启动，或先从文章分发流程发布到个人网站。"}
              </p>
              {loadError ? (
                <Button variant="outline" size="sm" onClick={() => loadPosts(0, false)} disabled={loading} className="mt-4 gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  重试加载
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid grid-cols-[minmax(0,1fr)_140px_120px_190px] items-center border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
                <span>文章</span>
                <span>发布时间</span>
                <span>状态</span>
                <span className="text-right">操作</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visiblePosts.map((post) => {
                  const busy = updatingSlug === post.slug;
                  return (
                    <div key={post.slug} className="grid grid-cols-[minmax(0,1fr)_140px_120px_190px] items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-slate-900">{post.title}</h3>
                          <Badge variant={post.draft ? "secondary" : "default"}>{post.draft ? "草稿" : "已发布"}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">{post.description || "暂无摘要"}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-slate-400">{post.slug}</p>
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {post.pubDate?.slice(0, 10) || "-"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!post.draft}
                          disabled={busy}
                          onCheckedChange={(checked) => handleToggleDraft(post, !checked)}
                        />
                        <span className="text-xs text-slate-500">{post.draft ? "草稿" : "正式"}</span>
                      </div>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="ghost" size="sm" asChild title="查看文章">
                          <a href={resolvePostUrl(post)} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/website/${post.slug}/edit?source=${source}`)} title="编辑文章">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(post)} disabled={busy} title="删除文章" className="text-rose-600 hover:text-rose-700">
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div ref={sentinelRef} className="flex min-h-10 items-center justify-center text-xs text-slate-400">
            {loadingMore ? (
              <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />加载更多文章...</span>
            ) : hasMore ? "继续向下滚动加载更多" : posts.length > 0 ? "已经到底了" : null}
          </div>
        </CardContent>
      </Card>

      <WebsiteSlugSettingsDialog open={slugSettingsOpen} onOpenChange={setSlugSettingsOpen} />
    </div>
  );
}
