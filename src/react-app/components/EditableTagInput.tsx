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
				"rounded-xl border border-slate-200 bg-slate-50/60 p-2 transition-colors",
				disabled ? "opacity-60" : "focus-within:border-brand-300 focus-within:bg-white",
			)}
		>
			<div className="flex flex-wrap gap-2">
				{value.map((tag, index) => (
					editingIndex === index ? (
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
							className="h-7 w-28 bg-white px-2 text-xs"
						/>
					) : (
						<Badge
							key={`${tag}-${index}`}
							variant="secondary"
							className="group gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
						>
							<button
								type="button"
								disabled={disabled}
								onClick={() => beginEdit(index)}
								className="max-w-[160px] truncate text-left disabled:cursor-default"
								title="点击修改标签"
							>
								{tag}
							</button>
							<button
								type="button"
								disabled={disabled}
								onClick={() => removeTag(index)}
								className="rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:hidden"
								aria-label={`删除标签 ${tag}`}
							>
								<X className="h-3 w-3" />
							</button>
						</Badge>
					)
				))}

				<div className="flex min-w-[180px] flex-1 items-center gap-2">
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
						className="h-8 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
					/>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						disabled={disabled || !draft.trim()}
						onClick={commitDraft}
						className="h-7 shrink-0 gap-1 px-2 text-xs"
					>
						<Plus className="h-3.5 w-3.5" />
						添加
					</Button>
				</div>
			</div>
			<p className="mt-2 px-1 text-[11px] text-slate-400">
				支持 Enter、逗号、粘贴多标签添加；点击已有标签可修改。
			</p>
		</div>
	);
}
