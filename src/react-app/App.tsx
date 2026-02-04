import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAppController } from "./hooks/useAppController";

// Layout & Features
import { MainLayout } from "./layout/MainLayout";
import { ArticleEditorSheet } from "./features/editor/ArticleEditorSheet";

// Views
import { ArticlesView } from "./views/ArticlesView";
import { AccountsView } from "./views/AccountsView";
import { SettingsView } from "./views/SettingsView";

// Existing Components
import { Dashboard } from "./components/Dashboard";
import { ArticleDetailDialog } from "./components/ArticleDetailDialog";
import { PublishDialog } from "./components/PublishDialog";
import { DistributionStatus } from "./components/DistributionStatus";
import { ConfirmDialog } from "@/components/ui/confirm-dialog"; // Import ConfirmDialog

import "./App.css";

function App() {
  const { state, actions } = useAppController();

  return (
    <MainLayout
      activeTab={state.activeTab}
      onTabChange={actions.setActiveTab}
      isPublishing={state.isPublishing}
      isGenerating={state.isGenerating}
      onOpenEditor={actions.handleOpenEditor}
    >
      <Tabs value={state.activeTab} onValueChange={actions.setActiveTab} className="space-y-6">
        <TabsContent value="dashboard" className="animate-in">
          <Dashboard
            articles={state.articles}
            onNavigate={actions.handleDashboardNavigate}
          />
        </TabsContent>

        <TabsContent value="articles" className="animate-in">
          <ArticlesView
            articles={state.articles}
            onViewDetail={actions.handleViewDetail}
            onEdit={actions.handleEdit}
            onDelete={actions.handleDelete}
            onPublish={actions.handlePublish}
          />
        </TabsContent>

        <TabsContent value="distribution" className="animate-in">
          <DistributionStatus
            initialTaskId={state.distributionDetailTaskId}
            onDeepLinkHandled={() => actions.setDistributionDetailTaskId(null)}
          />
        </TabsContent>

        <TabsContent value="accounts" className="animate-in">
          <AccountsView />
        </TabsContent>

        <TabsContent value="settings" className="animate-in">
          <SettingsView providerStatus={state.providerStatus} />
        </TabsContent>
      </Tabs>

      {/* Global Dialogs & Sheets */}
      <ArticleEditorSheet
        isOpen={state.isEditorOpen}
        onOpenChange={open => !open && actions.handleCloseEditor()}
        draft={state.draft}
        isGenerating={state.isGenerating}
        isLoading={state.isLoading}
        isFormValid={state.isFormValid} // Fixed typing
        onTitleChange={actions.handleTitleChange}
        onArticleUpdate={actions.handleArticleUpdate}
        onSave={actions.handleSave}
        onQuickPublish={actions.handleQuickPublish}
        onClose={actions.handleCloseEditor}
      />

      <ArticleDetailDialog
        article={state.detailArticle}
        open={state.isDetailOpen}
        onOpenChange={actions.setIsDetailOpen}
        onEdit={actions.handleEdit}
        onDelete={actions.handleDelete}
        onPublish={actions.handlePublish}
      />

      {state.isPublishDialogOpen && (
        <PublishDialog
          articles={state.articlesToPublish}
          open={state.isPublishDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              actions.setIsPublishDialogOpen(false);
            }
          }}
          onPublishConfirm={actions.handlePublishConfirm}
          onQuickPublishConfirm={state.draft ? actions.handleQuickPublishConfirm : undefined}
          isQuickPublish={!!state.draft}
          onTaskCompleted={actions.handleOpenDistributionDetail}
        />
      )}

      {/* Global Confirmation Dialog */}
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
