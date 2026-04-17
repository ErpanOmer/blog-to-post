import { useEffect } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dashboard } from "./components/Dashboard";
import { DistributionStatus } from "./components/DistributionStatus";
import { PublishDialog } from "./components/PublishDialog";
import { useAppController } from "./hooks/useAppController";
import { MainLayout } from "./layout/MainLayout";
import { ArticleDetailPage } from "./pages/ArticleDetailPage";
import { ArticleEditorPage } from "./pages/ArticleEditorPage";
import { AccountsView } from "./views/AccountsView";
import { ArticlesView } from "./views/ArticlesView";
import { SettingsView } from "./views/SettingsView";
import "./App.css";

function EmptyState({ title, description, backTo }: { title: string; description: string; backTo: string }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-white px-6 py-10 text-center shadow-sm page-enter">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1.5 text-[13px] text-slate-500">{description}</p>
      <Link to={backTo} className="mt-3 inline-flex text-[13px] font-medium text-brand-500 hover:text-brand-600 transition-colors">
        返回
      </Link>
    </div>
  );
}



// Extracted route components to prevent unmounting on every render
type AppController = ReturnType<typeof useAppController>;
type AppState = AppController["state"];
type AppActions = AppController["actions"];

const ArticleNewRoute = ({ state, actions }: { state: AppState; actions: AppActions }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const draftIsExistingArticle = state.draft
      ? state.articles.some((article) => article.id === state.draft?.id)
      : false;
    if (!state.draft || draftIsExistingArticle) {
      actions.openNewArticleEditor();
    }
  }, [actions, state.articles, state.draft]);

  return (
    <ArticleEditorPage
      draft={state.draft}
      isGenerating={state.isGenerating}
      isSaving={state.isLoading}
      isFormValid={state.isFormValid}
      onBack={() => navigate("/articles")}
      onTitleChange={actions.handleTitleChange}
      onArticleUpdate={actions.handleArticleUpdate}
      onSave={async () => {
        const saved = await actions.handleSave();
        if (saved) navigate(`/articles/${saved.id}`);
      }}
      onQuickPublish={actions.handleQuickPublish}
    />
  );
};

const ArticleEditRoute = ({ state, actions }: { state: AppState; actions: AppActions }) => {
  const params = useParams();
  const navigate = useNavigate();
  const articleId = params.id;
  const article = state.articles.find((item) => item.id === articleId);

  useEffect(() => {
    if (!article) return;
    if (state.draft?.id !== article.id) {
      actions.openArticleEditor(article);
    }
  }, [actions, article, state.draft?.id]);

  if (!article) {
    return <EmptyState title="文章不存在" description="这篇文章可能已被删除，或者仍在加载中。" backTo="/articles" />;
  }

  if (article.status !== "draft") {
    return (
      <EmptyState
        title="当前文章不可编辑"
        description="只有草稿状态的文章可以进入编辑器。你可以返回文章详情页查看并重新发起分发。"
        backTo={`/articles/${article.id}`}
      />
    );
  }

  const currentDraft = state.draft?.id === article.id ? state.draft : article;

  return (
    <ArticleEditorPage
      draft={currentDraft}
      isGenerating={state.isGenerating}
      isSaving={state.isLoading}
      isFormValid={state.isFormValid}
      onBack={() => navigate(`/articles/${article.id}`)}
      onTitleChange={actions.handleTitleChange}
      onArticleUpdate={actions.handleArticleUpdate}
      onSave={async () => {
        const saved = await actions.handleSave();
        if (saved) navigate(`/articles/${saved.id}`);
      }}
      onQuickPublish={actions.handleQuickPublish}
    />
  );
};

const ArticleDetailRoute = ({ state, actions }: { state: AppState; actions: AppActions }) => {
  const params = useParams();
  const navigate = useNavigate();
  const articleId = params.id;
  const article = state.articles.find((item) => item.id === articleId);

  if (!article) {
    return <EmptyState title="文章不存在" description="这篇文章可能已被删除，或者仍在加载中。" backTo="/articles" />;
  }

  return (
    <ArticleDetailPage
      article={article}
      onBack={() => navigate("/articles")}
      onEdit={(target) => {
        const ok = actions.openArticleEditor(target);
        if (ok) navigate(`/articles/${target.id}/edit`);
      }}
      onDelete={actions.handleDelete}
      onPublish={actions.handlePublish}
    />
  );
};

function App() {
  const { state, actions } = useAppController();
  const navigate = useNavigate();

  const openCreateEditorPage = () => {
    actions.openNewArticleEditor();
    navigate("/articles/new");
  };

  const routeFromDashboard = (tab: string) => {
    const pathMap: Record<string, string> = {
      dashboard: "/",
      articles: "/articles",
      distribution: "/distribution",
      accounts: "/accounts",
      settings: "/settings",
    };

    navigate(pathMap[tab] ?? "/");
  };

  const handlePublishTaskCompleted = (taskId: string) => {
    actions.handleOpenDistributionDetail(taskId);
    navigate("/distribution");
  };



  return (
    <MainLayout isPublishing={state.isPublishing} isGenerating={state.isGenerating} onOpenEditor={openCreateEditorPage}>
      <Routes>
        <Route path="/" element={<Dashboard articles={state.articles} onNavigate={routeFromDashboard} />} />
        <Route
          path="/articles"
          element={
            <ArticlesView
              articles={state.articles}
              onViewDetail={(article) => navigate(`/articles/${article.id}`)}
              onEdit={(article) => {
                const ok = actions.openArticleEditor(article);
                if (ok) navigate(`/articles/${article.id}/edit`);
              }}
              onDelete={actions.handleDelete}
              onPublish={actions.handlePublish}
            />
          }
        />
        <Route path="/articles/new" element={<ArticleNewRoute state={state} actions={actions} />} />
        <Route path="/articles/:id/edit" element={<ArticleEditRoute state={state} actions={actions} />} />
        <Route path="/articles/:id" element={<ArticleDetailRoute state={state} actions={actions} />} />
        <Route
          path="/distribution"
          element={
            <DistributionStatus
              initialTaskId={state.distributionDetailTaskId}
              onDeepLinkHandled={() => actions.setDistributionDetailTaskId(null)}
            />
          }
        />
        <Route path="/accounts" element={<AccountsView />} />
        <Route path="/settings" element={<SettingsView providerStatus={state.providerStatus} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {state.isPublishDialogOpen && (
        <PublishDialog
          articles={state.articlesToPublish}
          open={state.isPublishDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              actions.setIsPublishDialogOpen(false);
              actions.setIsQuickPublishMode(false);
            }
          }}
          onPublishConfirm={actions.handlePublishConfirm}
          onQuickPublishConfirm={state.isQuickPublishMode ? actions.handleQuickPublishConfirm : undefined}
          isQuickPublish={state.isQuickPublishMode}
          onTaskCompleted={handlePublishTaskCompleted}
        />
      )}

      <ConfirmDialog
        open={state.confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) actions.closeConfirmDialog();
        }}
        title={state.confirmDialog.title}
        description={state.confirmDialog.description}
        confirmLabel={state.confirmDialog.confirmLabel}
        variant={state.confirmDialog.variant}
        isLoading={state.confirmDialog.isLoading}
        onConfirm={state.confirmDialog.onConfirm}
      />
    </MainLayout>
  );
}

export default App;
