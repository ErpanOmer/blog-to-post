import type { PromptKey, PromptTemplate } from "../types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const labels: Record<PromptKey, string> = {
	title: "标题生成",
	content: "正文生成",
	summary: "摘要生成",
	tags: "标签生成",
};


export function PromptTemplateManager({ templates, onChange, onSave }: {
	templates: PromptTemplate[];
	onChange: (next: PromptTemplate[]) => void;
	onSave: (template: PromptTemplate) => void;
}) {
	return (
		<div className="space-y-5">
			{templates.map((template) => (
				<div key={template.key} className="rounded-xl border border-slate-200 bg-white p-4">
					<div className="mb-2 flex items-center justify-between">
						<h3 className="text-sm font-semibold text-slate-900">{labels[template.key]}</h3>
						<Button size="sm" variant="secondary" onClick={() => onSave(template)} type="button">保存模板</Button>
					</div>
					<Textarea
						value={template.template}
						onChange={(event) =>
							onChange(
								templates.map((item) =>
									item.key === template.key ? { ...item, template: event.target.value } : item,
								),
							)
						}
					/>
				</div>
			))}
		</div>
	);
}
