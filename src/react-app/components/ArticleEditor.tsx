import { useCallback, useState } from "react";
import { Editor } from "@bytemd/react";
import breaks from "@bytemd/plugin-breaks";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import math from "@bytemd/plugin-math";
import { AlertCircle, CloudUpload, FileText, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateContent } from "@/react-app/api";
import { createAlignPlugin } from "@/react-app/components/bytemd/align-plugin";
import { uploadImagesToImageHosting } from "@/react-app/services/image-hosting";
import type { Article } from "@/react-app/types";
import { normalizeMarkdownImageSyntax } from "@/shared/markdown-normalize";
import "bytemd/dist/index.css";
import "../jueijn.css";

const plugins = [gfm(), breaks(), frontmatter(), gemoji(), highlight(), math(), createAlignPlugin()];

interface ArticleEditorProps {
  article: Article | null;
  onChange: (draft: Article) => void;
  disabled?: boolean;
  hideAIActions?: boolean;
}

export function ArticleEditor({ article, onChange, disabled, hideAIActions = false }: ArticleEditorProps) {
  const content = article?.content ?? "";
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleGenerateContent = async () => {
    if (!article) return;

    const event = new CustomEvent("content-generating", { detail: { generating: true } });
    window.dispatchEvent(event);

    try {
      const result = await generateContent(article.title);
      onChange({ ...article, content: normalizeMarkdownImageSyntax(result.content) });
    } catch (error) {
      console.error("生成正文失败", error);
    } finally {
      const endEvent = new CustomEvent("content-generating", { detail: { generating: false } });
      window.dispatchEvent(endEvent);
    }
  };

  const handleUploadImages = useCallback(async (files: File[]) => {
    setUploadError(null);
    setIsUploadingImages(true);

    try {
      return await uploadImagesToImageHosting(files);
    } catch (error) {
      const message = error instanceof Error ? error.message : "图片上传失败";
      setUploadError(message);
      throw error;
    } finally {
      setIsUploadingImages(false);
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between px-1">
        <div className="flex items-center gap-2.5 w-full">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <FileText className="h-4 w-4" />
          </div>
          <div className="flex justify-between w-full">
            <h3 className="text-[14px] font-semibold text-slate-900 leading-tight">正文编辑区</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span>Markdown 编辑器</span>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1">
                <CloudUpload className="h-3 w-3" />
                图床: image-hosting
              </span>
              <span className="text-slate-300">|</span>
              <span>字数: {content.length}</span>
              {isUploadingImages && <span className="text-brand-600 ml-1">图片上传中...</span>}
            </div>
          </div>
        </div>

        {!hideAIActions && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleGenerateContent}
            disabled={!article || !article.title?.trim() || disabled || isUploadingImages}
            type="button"
            className="gap-2 shrink-0 border border-slate-200/60 shadow-sm"
          >
            {disabled || isUploadingImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span className="text-[12px]">智能补全正文</span>
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200/60 shadow-sm bg-white">
        <div className={`bytemd-container flex h-full flex-col ${disabled ? "pointer-events-none opacity-55" : ""}`}>
          <Editor
            value={content}
            plugins={plugins}
            uploadImages={handleUploadImages}
            onChange={(value) => {
              if (!article) return;
              onChange({ ...article, content: normalizeMarkdownImageSyntax(value) });
            }}
          />
        </div>
      </div>

      {!article && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          先填写标题，再开始编辑正文。
        </div>
      )}

      {uploadError && (
        <div className="mt-3 rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-[12px] text-red-700">
          图片上传失败: {uploadError}
        </div>
      )}
    </div>
  );
}
