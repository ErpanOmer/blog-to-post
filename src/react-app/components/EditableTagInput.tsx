import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditableTagInputProps {
	tags?: string[] | null;
	disabled?: boolean;
	placeholder?: string;
	onChange: (tags: string[]) => void;
}

const TAG_COLOR_STYLES = [
	"border-sky-200 bg-sky-50 text-sky-700",
	"border-emerald-200 bg-emerald-50 text-emerald-700",
	"border-amber-200 bg-amber-50 text-amber-700",
	"border-rose-200 bg-rose-50 text-rose-700",
	"border-violet-200 bg-violet-50 text-violet-700",
	"border-cyan-200 bg-cyan-50 text-cyan-700",
] as const;

function normalizeTags(tags: string[]): string[] {
	const result: string[] = [];
	for (const tag of tags) {
		const normalized = tag.trim();
		if (!normalized) continue;
		if (result.some((item) => item.toLowerCase() === normalized.toLowerCase())) continue;
		result.push(normalized);
	}
	return result;
}

function splitTagInput(value: string): string[] {
	return value
		.split(/[,，、;\n\r\t]+/)
		.map((item) => item.trim())
		.filter(Boolean);
}

export function EditableTagInput({
	tags,
	disabled,
	placeholder = "输入标签后按 Enter 添加",
	onChange,
}: EditableTagInputProps) {
	const value = normalizeTags(tags ?? []);
	const [draft, setDraft] = useState("");
	const [editingIndex, setEditingIndex] = useState<number | null>(null);
	const [editingValue, setEditingValue] = useState("");

	const commitDraft = () => {
		const nextTags = splitTagInput(draft);
		if (!nextTags.length) return;
		onChange(normalizeTags([...value, ...nextTags]));
		setDraft("");
	};

	const removeTag = (index: number) => {
		onChange(value.filter((_, currentIndex) => currentIndex !== index));
	};

	const beginEdit = (index: number) => {
		if (disabled) return;
		setEditingIndex(index);
		setEditingValue(value[index] ?? "");
	};

	const commitEdit = () => {
		if (editingIndex === null) return;
		const next = [...value];
		const replacements = splitTagInput(editingValue);
		next.splice(editingIndex, 1, ...replacements);
		onChange(normalizeTags(next));
		setEditingIndex(null);
		setEditingValue("");
	};

	const cancelEdit = () => {
		setEditingIndex(null);
		setEditingValue("");
	};

	return (
		<div
			className={cn(
				"rounded-2xl border border-brand-200 bg-white p-3 shadow-inner-soft transition-colors",
				disabled ? "opacity-60" : "focus-within:border-brand-400 focus-within:shadow-glow",
			)}
		>
			<div className="flex flex-wrap gap-2.5">
				{value.map((tag, index) => {
					const colorClass = TAG_COLOR_STYLES[index % TAG_COLOR_STYLES.length];

					return editingIndex === index ? (
						<Input
							key={`editing-${tag}-${index}`}
							autoFocus
							value={editingValue}
							disabled={disabled}
							onChange={(event) => setEditingValue(event.target.value)}
							onBlur={commitEdit}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									commitEdit();
								}
								if (event.key === "Escape") {
									event.preventDefault();
									cancelEdit();
								}
							}}
							className="h-8 w-32 rounded-full bg-white px-3 text-xs"
						/>
					) : (
						<Badge
							key={`${tag}-${index}`}
							variant="secondary"
							className={cn("group gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm", colorClass)}
						>
							<button
								type="button"
								disabled={disabled}
								onClick={() => beginEdit(index)}
								className="max-w-[170px] truncate text-left disabled:cursor-default"
								title="点击修改标签"
							>
								{tag}
							</button>
							<button
								type="button"
								disabled={disabled}
								onClick={() => removeTag(index)}
								className="rounded-full opacity-55 transition-opacity hover:opacity-100 disabled:hidden"
								aria-label={`删除标签 ${tag}`}
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					);
				})}

				<div className="flex min-w-0 basis-full flex-col gap-2 rounded-2xl bg-slate-50 p-2 sm:flex-row sm:items-center">
					<Input
						disabled={disabled}
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						onPaste={(event) => {
							const pasted = event.clipboardData.getData("text");
							if (splitTagInput(pasted).length <= 1) return;
							event.preventDefault();
							onChange(normalizeTags([...value, ...splitTagInput(pasted)]));
						}}
						onKeyDown={(event) => {
							if ((event.nativeEvent as KeyboardEvent).isComposing) return;
							if (event.key === "Enter" || event.key === "Tab" || event.key === "," || event.key === "，") {
								event.preventDefault();
								commitDraft();
							}
							if (event.key === "Backspace" && !draft && value.length > 0) {
								removeTag(value.length - 1);
							}
						}}
						placeholder={value.length ? "继续添加标签" : placeholder}
						className="h-9 min-w-0 flex-1 rounded-full border-0 bg-white px-3 text-xs shadow-sm focus-visible:ring-1 focus-visible:ring-brand-200"
					/>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						disabled={disabled || !draft.trim()}
						onClick={commitDraft}
						className="h-9 shrink-0 gap-1 rounded-full px-3 text-xs text-slate-600 hover:bg-white"
					>
						<Plus className="h-3.5 w-3.5" />
						添加
					</Button>
				</div>
			</div>
			<p className="mt-3 px-1 text-[11px] leading-5 text-slate-400">
				支持 Enter、逗号、粘贴多标签添加；点击已有标签可修改。
			</p>
		</div>
	);
}
