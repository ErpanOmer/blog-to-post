import type { Article } from "../types";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import "bytemd/dist/index.css";
import { Button } from "@/components/ui/button";
import { generateContent } from "../api";
import { 
  FileText, 
  Wand2,
  Loader2,
  AlertCircle
} from "lucide-react";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import highlight from "@bytemd/plugin-highlight";
import math from "@bytemd/plugin-math";
import "../jueijn.css";

const plugins = [gfm(), breaks(), frontmatter(), gemoji(), highlight(), math()];  

interface ArticleEditorProps {
  article: Article | null;
  onChange: (draft: Article) => void;
  disabled?: boolean;
}

export function ArticleEditor({ article, onChange, disabled }: ArticleEditorProps) {
  const content = article?.content ?? "";

  const handleGenerateContent = async () => {
    if (!article) return;
    
    // 通知父组件开始生成，用于设置全局loading状态
    const event = new CustomEvent('content-generating', { detail: { generating: true } });
    window.dispatchEvent(event);
    
    try {
      const result = await generateContent(article.title);
      onChange({ ...article, content: result.content });
    } catch (error) {
      console.error("生成正文失败", error);
    } finally {
      const endEvent = new CustomEvent('content-generating', { detail: { generating: false } });
      window.dispatchEvent(endEvent);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header with Generate Button */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">文章内容</h3>
            <p className="text-xs text-slate-500">ByteMD Markdown 编辑器</p>
          </div>
        </div>
        <Button
          variant="gradient"
          size="sm"
          onClick={handleGenerateContent}
          disabled={!article || !article.title?.trim() || disabled}
          type="button"
          className="gap-2"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          AI生成正文
        </Button>
      </div>

      {/* Editor Container - Takes remaining height */}
      <div className="flex-1 min-h-0">
        <div className={`h-full rounded-xl border border-slate-200/60 bg-white overflow-hidden ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
          <div className="h-full bytemd-container flex flex-col">
            <Editor
              value={content}
              plugins={plugins}
              onChange={(value) => {
                if (!article) return;
                onChange({ ...article, content: value });
              }}
            />
          </div>
        </div>
      </div>

      {/* Empty State / Tips */}
      {!article && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            请先在左侧填写或生成文章标题，然后点击"AI生成正文"按钮生成内容。
          </p>
        </div>
      )}
    </div>
  );
}
