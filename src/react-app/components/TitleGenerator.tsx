import { useState } from "react";
import { Check, ExternalLink, Flame, Loader2, Type, User, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { generateTitle, getJuejinTopTitles } from "@/react-app/api";

interface TitleGeneratorProps {
  title: string;
  onTitleChange: (title: string) => void;
  disabled?: boolean;
  hideAIActions?: boolean;
}

interface TitlesData {
  userTitles: string[];
  juejinTitles: string[];
}

export function TitleGenerator({ title, onTitleChange, disabled, hideAIActions = false }: TitleGeneratorProps) {
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [titlesData, setTitlesData] = useState<TitlesData>({ userTitles: [], juejinTitles: [] });
  const [dialogLoading, setDialogLoading] = useState(false);

  const handleGenerateTitle = async () => {
    setLoading(true);
    try {
      const { titles } = await generateTitle();
      setGeneratedTitles(titles);
      setSelectedTitleIndex(null);
    } catch (error) {
      console.error("生成标题失败", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTitle = (index: number) => {
    setSelectedTitleIndex(index);
    onTitleChange(generatedTitles[index]);
  };

  const handleOpenDialog = async () => {
    setIsDialogOpen(true);

    if (titlesData.juejinTitles.length === 0 && titlesData.userTitles.length === 0) {
      setDialogLoading(true);
      try {
        const data = await getJuejinTopTitles();
        setTitlesData(data);
      } catch (error) {
        console.error("获取热门标题失败", error);
      } finally {
        setDialogLoading(false);
      }
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Type className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">文章标题</p>
            {/* <p className="text-xs text-slate-500">标题决定后续内容生成和列表展示气质。</p> */}
          </div>
        </div>

        {!hideAIActions && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateTitle}
            disabled={disabled || loading}
            type="button"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            生成标题
          </Button>
        )}
      </div>

      <Textarea
        value={title}
        disabled={disabled}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="输入文章标题"
        className="mt-4 min-h-[78px] resize-none font-medium"
        rows={2}
      />

      {!hideAIActions && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => void handleOpenDialog()}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 text-xs text-brand-600 transition-colors hover:text-brand-700 disabled:opacity-50"
            type="button"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            查看掘金热门标题
          </button>
        </div>
      )}

      {!hideAIActions && generatedTitles.length > 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-3 text-xs text-slate-500">可以直接采用下面的建议标题，也可以继续手动调整。</p>
          <div className="space-y-2">
            {generatedTitles.map((generatedTitle, index) => {
              const selected = selectedTitleIndex === index;

              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelectTitle(index)}
                  disabled={disabled}
                  className={`flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                    selected
                      ? "border-brand-500 bg-brand-50 text-brand-900"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${
                      selected ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white"
                    }`}
                  >
                    {selected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="flex-1 text-sm leading-6">{generatedTitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[86vh] max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-4">
            <DialogTitle className="text-base font-semibold text-slate-900">标题参考库</DialogTitle>
          </DialogHeader>

          {dialogLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
              <span className="ml-3 text-sm text-slate-600">正在加载标题样本...</span>
            </div>
          ) : (
            <div className="grid max-h-[68vh] grid-cols-1 md:grid-cols-2">
              <div className="border-b border-slate-200 md:border-b-0 md:border-r">
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-800">
                  <Flame className="h-4 w-4 text-orange-500" />
                  掘金热门标题
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {titlesData.juejinTitles.slice(0, 20).map((entry, index) => (
                    <div key={index} className="flex items-start gap-3 border-b border-slate-100 px-5 py-3">
                      <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-medium text-slate-600">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-6 text-slate-700">{entry}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-medium text-slate-800">
                  <User className="h-4 w-4 text-brand-500" />
                  你的热门文章
                </div>
                <div className="max-h-[60vh] overflow-y-auto">
                  {titlesData.userTitles.length > 0 ? (
                    titlesData.userTitles.slice(0, 50).map((entry, index) => (
                      <div key={index} className="flex items-start gap-3 border-b border-slate-100 px-5 py-3">
                        <span className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-medium text-slate-600">
                          {index + 1}
                        </span>
                        <span className="text-sm leading-6 text-slate-700">{entry}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-sm text-slate-400">
                      暂无历史数据。
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
