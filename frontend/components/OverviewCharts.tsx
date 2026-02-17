"use client";

import { useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

type ChartDataPoint = Record<string, string | number | null>;

interface ChartInsights {
    simplified_trend?: {
        date_column: string;
        growth_metric: string | null;
        growth_pct: number | null;
        points: Array<Record<string, string | number | null>>;
    } | null;
    chart_explanations?: string[];
}

interface ChartComponentProps {
    data: ChartDataPoint[];
    numericColumns: string[];
    insights?: ChartInsights | null;
}

function normalizeNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

export default function OverviewCharts({ data, numericColumns, insights }: ChartComponentProps) {
    const [mode, setMode] = useState<"simple" | "detailed">("simple");

    const simplifiedPoints = useMemo(() => {
        const points = insights?.simplified_trend?.points || [];
        return points.map((point) => ({
            period: String(point.period ?? ""),
            revenue: normalizeNumber(point.revenue),
            cost: normalizeNumber(point.cost),
            profit: normalizeNumber(point.profit),
        }));
    }, [insights?.simplified_trend?.points]);

    const hasAnyData =
        (data && data.length > 0 && numericColumns.length > 0)
        || simplifiedPoints.length > 0;
    if (!hasAnyData) {
        return (
            <div className="p-6 border rounded-xl bg-card/50 text-center text-muted-foreground text-sm">
                No data available for visualization.
            </div>
        );
    }

    const colors = ["#3b82f6", "#10b981", "#f43f5e", "#8b5cf6"];
    const explanations = (insights?.chart_explanations && insights.chart_explanations.length > 0)
        ? insights.chart_explanations
        : [
            "Use Simple mode to focus on one KPI trend at a time.",
            "If your chart feels noisy, compare only one or two metrics.",
        ];

    const hasRevenue = simplifiedPoints.some((point) => point.revenue !== null);
    const hasCost = simplifiedPoints.some((point) => point.cost !== null);
    const hasProfit = simplifiedPoints.some((point) => point.profit !== null);

    const fallbackSimple = data.slice(0, 10).map((item) => ({
        period: String(item.name ?? ""),
        metric: normalizeNumber(item[numericColumns[0]]),
    }));

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">Charts</h3>
                <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-1">
                    <button
                        onClick={() => setMode("simple")}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mode === "simple" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                            }`}
                    >
                        Simple
                    </button>
                    <button
                        onClick={() => setMode("detailed")}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${mode === "detailed" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                            }`}
                    >
                        Detailed
                    </button>
                </div>
            </div>

            {mode === "simple" ? (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h4 className="font-semibold mb-4">
                        Simple Trend View
                    </h4>
                    <div className="h-[320px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {simplifiedPoints.length > 1 ? (
                                <ComposedChart data={simplifiedPoints}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "none",
                                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        }}
                                    />
                                    <Legend />
                                    {hasRevenue && <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />}
                                    {hasCost && <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[4, 4, 0, 0]} />}
                                    {hasProfit && (
                                        <Line
                                            type="monotone"
                                            dataKey="profit"
                                            name="Profit"
                                            stroke="#10b981"
                                            strokeWidth={2.5}
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                        />
                                    )}
                                </ComposedChart>
                            ) : (
                                <LineChart data={fallbackSimple}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "none",
                                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="metric"
                                        stroke="#3b82f6"
                                        strokeWidth={2.5}
                                        dot={false}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                        <h4 className="font-semibold mb-6">Distribution (First 10 Rows)</h4>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "none",
                                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        }}
                                        cursor={{ fill: "rgba(0,0,0,0.05)" }}
                                    />
                                    <Legend />
                                    {numericColumns.slice(0, 2).map((col, index) => (
                                        <Bar
                                            key={col}
                                            dataKey={col}
                                            fill={colors[index % colors.length]}
                                            radius={[4, 4, 0, 0]}
                                            maxBarSize={50}
                                        />
                                    ))}
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                        <h4 className="font-semibold mb-6">Detailed Trends</h4>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data}>
                                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: "#888" }} tickLine={false} axisLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: "8px",
                                            border: "none",
                                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                                        }}
                                    />
                                    <Legend />
                                    {numericColumns.slice(0, 4).map((col, index) => (
                                        <Line
                                            key={col}
                                            type="monotone"
                                            dataKey={col}
                                            stroke={colors[index % colors.length]}
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 6 }}
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-primary mb-2">Plain-English Chart Readout</h4>
                <div className="space-y-1.5">
                    {explanations.slice(0, 4).map((line, index) => (
                        <p key={`${line}-${index}`} className="text-sm text-muted-foreground">
                            - {line}
                        </p>
                    ))}
                </div>
            </div>
        </div>
    );
}
