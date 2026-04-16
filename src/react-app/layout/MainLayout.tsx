import { NavLink, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlobalLoadingOverlay } from "@/react-app/components/GlobalLoadingOverlay";
import { NotificationContainer } from "@/react-app/components/NotificationSystem";
import { cn } from "@/lib/utils";
import { FileText, Home, Loader2, Orbit, Settings, Share2, Sparkles, User, Zap } from "lucide-react";

interface MainLayoutProps {
  isPublishing: boolean;
  isGenerating: boolean;
  onOpenEditor: () => void;
  children: React.ReactNode;
}

const navItems = [
  { to: "/", label: "首页", icon: Home, exact: true },
  { to: "/articles", label: "文章列表", icon: FileText },
  { to: "/distribution", label: "分发状态", icon: Share2 },
  { to: "/accounts", label: "平台账号", icon: User },
  { to: "/settings", label: "平台设置", icon: Settings },
];

export function MainLayout({ isPublishing, isGenerating, onOpenEditor, children }: MainLayoutProps) {
  const location = useLocation();
  const isBusy = isPublishing || isGenerating;

  return (
    <>
      <NotificationContainer />

      {isPublishing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-[18px] border border-slate-200 bg-white p-7 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.3)]">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">发布任务执行中</h3>
              <p className="text-sm leading-relaxed text-slate-500">系统正在后台执行分发流程，请稍候查看结果。</p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen text-slate-900">
        <GlobalLoadingOverlay isLoading={isGenerating} />

        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <NavLink to="/" className="flex min-w-0 items-center gap-3">
              <div className="icon-tile h-10 w-10 rounded-xl">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Editorial Workspace</p>
                <p className="truncate text-base font-semibold text-slate-900">多平台技术文章分发系统</p>
                <p className="truncate text-xs text-slate-500">创作、账号、分发、追踪一体化工作台</p>
              </div>
            </NavLink>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <nav className="overflow-x-auto">
                <div className="flex min-w-max items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.exact
                      ? location.pathname === item.to
                      : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-slate-900 font-medium text-white"
                            : "text-slate-600 hover:bg-white hover:text-slate-900",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </nav>

              <div className="flex items-center gap-2">
                {isBusy && (
                  <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
                    <Orbit className="h-3.5 w-3.5 animate-spin" />
                    {isGenerating ? "生成中" : "分发中"}
                  </Badge>
                )}
                <Button variant="default" size="sm" onClick={onOpenEditor} type="button" className="gap-2">
                  <Zap className="h-4 w-4" />
                  新建文章
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">{children}</main>
      </div>
    </>
  );
}
