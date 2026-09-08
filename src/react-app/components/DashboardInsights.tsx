import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { PlatformRollup } from "@/react-app/components/Dashboard";
import { getPlatformDisplayName } from "@/react-app/components/platform-brand-data";
import type { PublishablePlatformType } from "@/shared/types";
import type { ReactNode } from "react";
import {
	Cell,
	Legend,
	Line,
	LineChart,
	Pie,
	PieChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

// Hex mirrors of the platform brand tones in platform-brand-data.ts.
const PLATFORM_COLORS: Record<PublishablePlatformType, string> = {
	juejin: "#0ea5e9",
	zhihu: "#3b82f6",
	wechat: "#10b981",
	wechat_v2: "#059669",
	csdn: "#ef4444",
	cnblogs: "#6366f1",
	segmentfault: "#14b8a6",
	"51cto": "#06b6d4",
	website: "#f97316",
};

const COMPOSITION_COLORS: Record<string, string> = {
	published: "#10b981",
	draft_created: "#f59e0b",
	failed: "#ef4444",
};

const COMPOSITION_LABELS: Record<string, string> = {
	published: "正式发布",
	draft_created: "草稿成功",
	failed: "失败",
};

const tooltipStyle = {
	borderRadius: 8,
	border: "1px solid #e8e8ec",
	fontSize: 12,
	boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
} as const;

export interface DashboardInsightsProps {
	platformRows: PlatformRollup[];
	totals: { published: number; drafts: number; failed: number };
	taskDurations: Array<{ label: string; minutes: number }>;
	averageDurationMinutes: number;
}

export function DashboardInsights({
	platformRows,
	totals,
	taskDurations,
	averageDurationMinutes,
}: DashboardInsightsProps) {
	const platformData = platformRows
		.filter((row) => row.published + row.drafts > 0)
		.map((row) => ({
			name: getPlatformDisplayName(row.platform),
			value: row.published + row.drafts,
			color: PLATFORM_COLORS[row.platform],
		}));

	const compositionData = [
		{ key: "published", value: totals.published },
		{ key: "draft_created", value: totals.drafts },
		{ key: "failed", value: totals.failed },
	].filter((item) => item.value > 0);

	const totalSuccessful = totals.published + totals.drafts;

	if (platformData.length === 0 && compositionData.length === 0 && taskDurations.length === 0) {
		return null;
	}

	return (
		<div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)]">
			<Card className="border-design-border bg-white">
				<CardHeader className="space-y-1 pb-2">
					<CardTitle className="text-base">平台发布分布</CardTitle>
					<CardDescription>各平台成功发布次数占比（正式 + 草稿）。</CardDescription>
				</CardHeader>
				<CardContent>
					{platformData.length === 0 ? (
						<EmptyHint text="暂无成功发布记录" />
					) : (
						<div className="h-60">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={platformData}
										dataKey="value"
										nameKey="name"
										innerRadius="52%"
										outerRadius="80%"
										paddingAngle={2}
										stroke="none"
									>
										{platformData.map((entry) => (
											<Cell key={entry.name} fill={entry.color} />
										))}
									</Pie>
									<Tooltip contentStyle={tooltipStyle} />
									<Legend
										verticalAlign="bottom"
										iconType="circle"
										iconSize={8}
										formatter={(value: ReactNode) => <span style={{ color: "#6b6b6b", fontSize: 11 }}>{value}</span>}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="border-design-border bg-white">
				<CardHeader className="space-y-1 pb-2">
					<CardTitle className="text-base">发布构成</CardTitle>
					<CardDescription>全部发布记录的结果构成。</CardDescription>
				</CardHeader>
				<CardContent>
					{compositionData.length === 0 ? (
						<EmptyHint text="暂无发布记录" />
					) : (
						<div className="relative h-60">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={compositionData}
										dataKey="value"
										nameKey="key"
										innerRadius="58%"
										outerRadius="82%"
										paddingAngle={2}
										stroke="none"
									>
										{compositionData.map((entry) => (
											<Cell key={entry.key} fill={COMPOSITION_COLORS[entry.key]} />
										))}
									</Pie>
									<Tooltip
										contentStyle={tooltipStyle}
										formatter={(_value, name) => [`${_value} 次`, COMPOSITION_LABELS[String(name)] ?? String(name)]}
									/>
								</PieChart>
							</ResponsiveContainer>
							<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
								<p className="text-2xl font-semibold tabular-nums text-design-text">{totalSuccessful}</p>
								<p className="text-[11px] text-design-neutral">总成功</p>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			<Card className="border-design-border bg-white">
				<CardHeader className="space-y-1 pb-2">
					<CardTitle className="text-base">任务耗时趋势</CardTitle>
					<CardDescription>
						最近 {taskDurations.length} 次发布任务耗时（分钟），平均 {averageDurationMinutes.toFixed(1)} 分钟。
					</CardDescription>
				</CardHeader>
				<CardContent>
					{taskDurations.length === 0 ? (
						<EmptyHint text="暂无发布任务记录" />
					) : (
						<div className="h-60">
							<ResponsiveContainer width="100%" height="100%">
								<LineChart data={taskDurations} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
									<XAxis
										dataKey="label"
										tick={{ fontSize: 10, fill: "#9c9c9c" }}
										interval="preserveStartEnd"
										tickLine={false}
										axisLine={{ stroke: "#e8e8ec" }}
									/>
									<YAxis
										tick={{ fontSize: 10, fill: "#9c9c9c" }}
										tickLine={false}
										axisLine={false}
										width={40}
									/>
									<Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} 分钟`, "耗时"]} />
									<ReferenceLine
										y={averageDurationMinutes}
										stroke="#9c9c9c"
										strokeDasharray="4 4"
										label={{ value: "平均", position: "insideTopRight", fontSize: 10, fill: "#9c9c9c" }}
									/>
									<Line
										type="monotone"
										dataKey="minutes"
										stroke="#6366f1"
										strokeWidth={2}
										dot={{ r: 2.5, fill: "#6366f1" }}
										activeDot={{ r: 4 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

function EmptyHint({ text }: { text: string }) {
	return (
		<div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-design-border bg-design-background text-[12px] text-design-neutral">
			{text}
		</div>
	);
}
