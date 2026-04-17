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
  { to: "/articles", label: "文章", icon: FileText },
  { to: "/distribution", label: "分发", icon: Share2 },
  { to: "/accounts", label: "账号", icon: User },
  { to: "/settings", label: "设置", icon: Settings },
];

export function MainLayout({ isPublishing, isGenerating, onOpenEditor, children }: MainLayoutProps) {
  const location = useLocation();
  const isBusy = isPublishing || isGenerating;
  
  const isEditorPage = location.pathname.includes("/articles/new") || location.pathname.includes("/edit");

  return (
    <>
      <NotificationContainer />

      {isPublishing && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-slate-200/80 bg-white p-6 shadow-elevated animate-in">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-slate-900">发布任务执行中</h3>
              <p className="text-[13px] leading-relaxed text-slate-500">系统正在后台执行分发流程，请稍候查看结果。</p>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen text-slate-900 flex flex-col bg-slate-50/50">
        <GlobalLoadingOverlay isLoading={isGenerating} />

        {!isEditorPage && (
          <header className="sticky top-0 z-40 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl shrink-0">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 lg:px-6">
            <NavLink to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
              <div className="icon-tile h-8 w-8 rounded-lg">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="text-sm font-semibold text-slate-900">Blog-to-Post</p>
                <p className="text-[11px] text-slate-400">多平台内容分发</p>
              </div>
            </NavLink>

            <nav className="flex items-center">
              <div className="flex items-center gap-0.5">
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
                        "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all duration-200",
                        isActive
                          ? "text-brand-600"
                          : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/60",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden md:inline">{item.label}</span>
                      {isActive && (
                        <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-brand-500" />
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </nav>

            <div className="flex items-center gap-2">
              {isBusy && (
                <Badge variant="secondary" className="gap-1.5 text-[11px]">
                  <Orbit className="h-3 w-3 animate-spin" />
                  {isGenerating ? "生成中" : "分发中"}
                </Badge>
              )}
              <Button variant="default" size="sm" onClick={onOpenEditor} type="button" className="gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">新建文章</span>
              </Button>
            </div>
          </div>
        </header>
        )}

        {isEditorPage ? (
          <main className="flex-1 min-h-0 w-full overflow-hidden">
            {children}
          </main>
        ) : (
          <main className={cn("mx-auto py-5 lg:py-6 transition-all duration-300 w-full max-w-7xl px-4 lg:px-6")}>
            {children}
          </main>
        )}
      </div>
    </>
  );
}
