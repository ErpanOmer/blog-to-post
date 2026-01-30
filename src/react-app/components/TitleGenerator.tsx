import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateTitle, getJuejinTopTitles } from "../api";
import { Type, Flame, Edit3, Wand2, Loader2, RefreshCw, Check } from "lucide-react";

interface TitleGeneratorProps {
  title: string;
  onTitleChange: (title: string) => void;
  disabled?: boolean;
}

export function TitleGenerator({ title, onTitleChange, disabled }: TitleGeneratorProps) {
  const [titleSource, setTitleSource] = useState<"juejin" | "custom">("juejin");
  const [customTitles, setCustomTitles] = useState("");
  const [sourceTitles, setSourceTitles] = useState<string[]>([]);
  const [generatedTitles, setGeneratedTitles] = useState<string[]>([]);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState({
    hot: false,
    generate: false,
  });

  const handleFetchHotTitles = async () => {
    setLoading((prev) => ({ ...prev, hot: true }));
    try {
      const titles = await getJuejinTopTitles();
      setSourceTitles(titles);
    } catch (error) {
      console.error("获取热门标题失败", error);
    } finally {
      setLoading((prev) => ({ ...prev, hot: false }));
    }
  };

  const handleGenerateTitle = async () => {
    const candidates = titleSource === "custom"
      ? customTitles.split("\n").map((item) => item.trim()).filter(Boolean)
      : sourceTitles;
    
    setLoading((prev) => ({ ...prev, generate: true }));
    try {
      const { titles } = await generateTitle({ 
        titleSource, 
        sourceTitles: candidates, 
        platform: "juejin" 
      });
      setGeneratedTitles(titles);
      setSelectedTitleIndex(null);
    } catch (error) {
      console.error("生成标题失败", error);
    } finally {
      setLoading((prev) => ({ ...prev, generate: false }));
    }
  };

  const handleSelectTitle = (index: number) => {
    setSelectedTitleIndex(index);
    onTitleChange(generatedTitles[index]);
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
          disabled={disabled || loading.generate}
          type="button"
          className="gap-2"
        >
          {loading.generate ? (
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

      {/* Source Selection Tabs */}
      <Tabs value={titleSource} onValueChange={(value) => setTitleSource(value as "juejin" | "custom")}>
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1">
          <TabsTrigger value="juejin" className="gap-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Flame className="h-3.5 w-3.5" />
            掘金Top20
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Edit3 className="h-3.5 w-3.5" />
            自定义
          </TabsTrigger>
        </TabsList>
        <TabsContent value="juejin" className="space-y-2 pt-2">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFetchHotTitles}
              disabled={disabled || loading.hot}
              type="button"
              className="gap-2 text-xs"
            >
              {loading.hot ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              抓取热门
            </Button>
          </div>
          {sourceTitles.length > 0 && (
            <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
              {sourceTitles.slice(0, 10).map((t, i) => (
                <div key={i} className="truncate py-0.5 text-xs text-slate-600">
                  {i + 1}. {t}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="custom" className="pt-2">
          <Textarea
            value={customTitles}
            disabled={disabled}
            onChange={(e) => setCustomTitles(e.target.value)}
            placeholder="每行输入一个参考标题，AI会基于这些生成新标题"
            className="h-24 resize-none rounded-lg border-slate-200 bg-white text-xs focus:border-brand-500 disabled:opacity-50"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
