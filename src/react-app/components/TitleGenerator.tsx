import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { generateTitle, getJuejinTopTitles } from "../api";
import { Type, Wand2, Loader2, Check, ExternalLink, Flame, User } from "lucide-react";

interface TitleGeneratorProps {
  title: string;
  onTitleChange: (title: string) => void;
  disabled?: boolean;
}

interface TitlesData {
  userTitles: string[];
  juejinTitles: string[];
}

export function TitleGenerator({ title, onTitleChange, disabled }: TitleGeneratorProps) {
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // 弹窗相关状态
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
    // 如果还没有数据，则加载
    if (titlesData.juejinTitles.length === 0 && titlesData.userTitles.length === 0) {
      setDialogLoading(true);
      try {
        const data = await getJuejinTopTitles();
        setTitlesData(data);
      } catch (error) {
        console.error("获取掘金热门标题失败", error);
      } finally {
        setDialogLoading(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Title Input Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-600">
            <Type className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold text-slate-900">文章标题</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerateTitle}
          disabled={disabled || loading}
          type="button"
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          AI生成标题
        </Button>
      </div>

      {/* Title Input */}
      <Textarea
        value={title}
        disabled={disabled}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="请输入文章标题，或点击右上角AI生成"
        className="min-h-[72px] resize-none rounded-xl border-slate-200 bg-white text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
        rows={2}
      />

      {/* 参考掘金热门文章链接 */}
      <div className="flex justify-end">
        <button
          onClick={handleOpenDialog}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 disabled:opacity-50 transition-colors"
          type="button"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          参考掘金热门文章
        </button>
      </div>

      {/* Generated Titles Selection */}
      {generatedTitles.length > 0 && (
        <div className="rounded-xl border border-slate-200/60 bg-slate-50/80 p-4">
          <p className="mb-3 text-xs font-medium text-slate-500">选择以下标题之一，或继续手动编辑：</p>
          <div className="space-y-2">
            {generatedTitles.map((t, index) => (
              <label
                key={index}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${
                  selectedTitleIndex === index
                    ? "border-brand-500 bg-brand-50 shadow-sm"
                    : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="generated-title"
                  checked={selectedTitleIndex === index}
                  onChange={() => handleSelectTitle(index)}
                  className="h-4 w-4 text-brand-600 focus:ring-brand-500"
                  disabled={disabled}
                />
                <span className={`flex-1 text-sm ${selectedTitleIndex === index ? "font-medium text-brand-900" : "text-slate-700"}`}>
                  {t}
                </span>
                {selectedTitleIndex === index && (
                  <Check className="h-4 w-4 text-brand-600" />
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 掘金热门文章弹窗 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-red-500">
                <Flame className="h-4 w-4 text-white" />
              </div>
              掘金热门文章参考
            </DialogTitle>
          </DialogHeader>
          
          {dialogLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-brand-500" />
              <span className="ml-3 text-sm text-slate-600">加载中...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-0 overflow-hidden">
              {/* 掘金Top20 - 排行榜样式 */}
              <div className="border-r border-slate-100">
                <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-50 to-amber-50 px-5 py-3 border-b border-orange-100">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-bold text-orange-800">掘金热门 TOP20</span>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[55vh]">
                  {titlesData.juejinTitles.slice(0, 20).map((t, i) => (
                    <div 
                      key={i} 
                      className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                    >
                      <div className={`
                        flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold
                        ${i === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white' : ''}
                        ${i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : ''}
                        ${i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' : ''}
                        ${i > 2 ? 'bg-slate-100 text-slate-500' : ''}
                      `}>
                        {i + 1}
                      </div>
                      <span className="text-sm text-slate-700 leading-relaxed line-clamp-2">{t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 用户热门文章TOP50 - 排行榜样式 */}
              <div>
                <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-50 to-violet-50 px-5 py-3 border-b border-brand-100">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-brand-500" />
                    <span className="text-sm font-bold text-brand-800">用户热门文章 TOP50</span>
                  </div>
                </div>
                <div className="overflow-y-auto max-h-[55vh]">
                  {titlesData.userTitles.length > 0 ? (
                    titlesData.userTitles.slice(0, 50).map((t, i) => (
                      <div 
                        key={i} 
                        className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                      >
                        <div className={`
                          flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold
                          ${i === 0 ? 'bg-gradient-to-br from-brand-400 to-violet-500 text-white' : ''}
                          ${i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : ''}
                          ${i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' : ''}
                          ${i > 2 ? 'bg-slate-100 text-slate-500' : ''}
                        `}>
                          {i + 1}
                        </div>
                        <span className="text-sm text-slate-700 leading-relaxed line-clamp-2">{t}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <User className="h-12 w-12 mb-3 opacity-30" />
                      <span className="text-sm">暂无数据</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            数据来自服务器缓存，24小时更新一次
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
