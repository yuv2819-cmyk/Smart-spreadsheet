"use client";

import StatCard from "@/components/StatCard";
import {
    DollarSign,
    ShoppingCart,
    Activity,
    Users,
    CreditCard,
    Sparkles,
    FileText,
    Loader2
} from "lucide-react";
import { useState, useEffect } from "react";
import OverviewCharts from "@/components/OverviewCharts";
import CsvUpload from "@/components/CsvUpload";
import { apiFetch } from "@/lib/api-client";
import AnalystInsightsPanel, { type AnalystInsights } from "@/components/AnalystInsightsPanel";

interface OverviewMetrics {
    dataset_id?: number;
    total_rows: number;
    total_columns: number;
    numeric_columns: string[];
    last_updated: string | null;
    basic_stats: Record<string, { min: number; max: number; avg: number }>;
    chart_data: Array<Record<string, string | number | null>>;
    analyst_insights?: AnalystInsights | null;
}

interface AISummary {
    summary: string;
    key_insights: string[];
}

interface BusinessSummary {
    profit_available: boolean;
    revenue_column: string | null;
    cost_column: string | null;
    profit_column: string | null;
    total_revenue: number | null;
    total_cost: number | null;
    total_profit: number | null;
    profit_margin_pct: number | null;
    profit_rows: number | null;
    loss_rows: number | null;
    neutral_rows: number | null;
    message: string | null;
}

interface ProfitLossBreakdownRow {
    segment: string;
    revenue: number | null;
    cost: number | null;
    profit: number;
    margin_pct: number | null;
    status: "profit" | "loss";
}

interface ProfitLossBreakdown {
    segment_column: string | null;
    rows: ProfitLossBreakdownRow[];
    top_profit_segments: Array<{ segment: string; profit: number }>;
    top_loss_segments: Array<{ segment: string; profit: number }>;
    message: string | null;
}

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

export default function OverviewPage() {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AISummary | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showProfitLoss, setShowProfitLoss] = useState(false);

    const fetchMetrics = async () => {
        try {
            const response = await apiFetch("/overview/metrics");
            if (response.ok) {
                const data = await response.json();
                setMetrics(data);
                // Reset summary when new data is uploaded/fetched if the ID changed
                // For MVP we can just reset it or keep it if it matches
            }
        } catch (error) {
            console.error("Failed to fetch metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    const handleUploadSuccess = () => {
        setLoading(true);
        setSummary(null); // Clear old summary
        setShowProfitLoss(false);
        fetchMetrics();
    };

    const handleSummarize = async () => {
        if (!metrics?.dataset_id) {
            console.error("No dataset ID available");
            // If no ID (e.g. empty state), maybe trigger a default or show toast
            // For now, safe return to avoid crash
            return;
        }
        setIsSummarizing(true);
        try {
            const response = await apiFetch("/ai/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_id: metrics.dataset_id })
            });
            if (response.ok) {
                const data = await response.json();
                setSummary(data);
            }
        } catch (error) {
            console.error("Failed to summarize:", error);
        } finally {
            setIsSummarizing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    // Heuristics to map dynamic stats to cards (fallback to defaults if no numeric cols)
    const numCols = metrics?.numeric_columns || [];
    const revCol = numCols.find(c => c.toLowerCase().includes("revenue") || c.toLowerCase().includes("sales")) || numCols[0];
    const orderCol = numCols.find(c => c !== revCol && (c.toLowerCase().includes("quantity") || c.toLowerCase().includes("units")));

    // Fallback values
    const revenueVal = revCol && metrics?.basic_stats[revCol] ? `$${metrics.basic_stats[revCol].avg.toFixed(0)}` : "N/A";
    const ordersVal = orderCol && metrics?.basic_stats[orderCol] ? Math.round(metrics.basic_stats[orderCol].avg).toString() : "N/A";
    const businessSummary = (metrics?.analyst_insights?.business_summary || null) as BusinessSummary | null;
    const profitLossBreakdown = (metrics?.analyst_insights?.profit_loss_breakdown || null) as ProfitLossBreakdown | null;
    const hasProfitLossRows = !!profitLossBreakdown?.rows?.length;

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                    <p className="text-muted-foreground">Real-time insights from your spreadsheet data.</p>
                </div>
                <div className="flex items-center gap-3">
                    <CsvUpload onUploadSuccess={handleUploadSuccess} />
                    {metrics && metrics.total_rows > 0 && (
                        <button
                            onClick={async () => {
                                if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                                    setLoading(true);
                                    try {
                                        await apiFetch("/datasets/clear", { method: "DELETE" });
                                        handleUploadSuccess(); // Refresh metrics (will be empty)
                                    } catch (error) {
                                        console.error("Failed to clear data:", error);
                                        setLoading(false);
                                    }
                                }
                            }}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors shadow-sm"
                        >
                            Clear Data
                        </button>
                    )}
                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing || !metrics?.total_rows}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Summarize
                    </button>
                    {hasProfitLossRows && (
                        <button
                            onClick={() => setShowProfitLoss((prev) => !prev)}
                            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors shadow-sm"
                        >
                            {showProfitLoss ? "Hide Profit/Loss" : "Show Profit/Loss"}
                        </button>
                    )}
                </div>
            </div>

            {/* AI Summary Panel */}
            {summary && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 animate-in slide-in-from-top-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-primary">
                        <Sparkles className="w-4 h-4" />
                        AI Summary
                    </h3>
                    <p className="text-sm mb-4 leading-relaxed">{summary.summary}</p>
                    <div className="space-y-2">
                        {summary.key_insights.map((insight, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                                {insight}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Analyst Insight Panels */}
            {!!metrics?.analyst_insights && metrics.total_rows > 0 && (
                <AnalystInsightsPanel insights={metrics.analyst_insights} />
            )}

            {/* Business Summary */}
            {businessSummary && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Business Summary</h3>
                        {!businessSummary.profit_available && businessSummary.message && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">
                                {businessSummary.message}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                            <p className="text-xl font-semibold">{formatCurrency(businessSummary.total_revenue)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {businessSummary.revenue_column ? `from ${businessSummary.revenue_column}` : "Column not detected"}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Cost</p>
                            <p className="text-xl font-semibold">{formatCurrency(businessSummary.total_cost)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {businessSummary.cost_column ? `from ${businessSummary.cost_column}` : "Column not detected"}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Profit / Loss</p>
                            <p
                                className={`text-xl font-semibold ${businessSummary.total_profit !== null && businessSummary.total_profit < 0
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }`}
                            >
                                {formatCurrency(businessSummary.total_profit)}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {businessSummary.profit_available ? "computed from data" : "requires cost/profit column"}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Profit Margin</p>
                            <p className="text-xl font-semibold">
                                {businessSummary.profit_margin_pct === null ? "N/A" : `${businessSummary.profit_margin_pct.toFixed(2)}%`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {businessSummary.loss_rows ?? 0} loss rows / {businessSummary.profit_rows ?? 0} profit rows
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Rows"
                    value={metrics?.total_rows.toLocaleString() || "0"}
                    trend="Dataset Size"
                    trendUp={true}
                    icon={FileText}
                    color="blue"
                />
                <StatCard
                    title="Avg. Value"
                    value={revenueVal}
                    trend={revCol ? `Avg of ${revCol}` : "No numeric data"}
                    trendUp={true}
                    icon={DollarSign}
                    color="violet"
                />
                <StatCard
                    title="Avg. Units"
                    value={ordersVal}
                    trend={orderCol ? `Avg of ${orderCol}` : "No numeric data"}
                    trendUp={true}
                    icon={ShoppingCart}
                    color="rose"
                />
                <StatCard
                    title="Columns"
                    value={metrics?.total_columns.toString() || "0"}
                    trend={`${metrics?.numeric_columns.length ?? 0} Numeric`}
                    trendUp={true}
                    icon={Activity}
                    color="emerald"
                />
            </div>

            {/* Profit/Loss Breakdown */}
            {showProfitLoss && profitLossBreakdown && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4">
                        Profit/Loss Breakdown
                        {profitLossBreakdown.segment_column ? ` by ${profitLossBreakdown.segment_column}` : ""}
                    </h3>
                    {profitLossBreakdown.rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {profitLossBreakdown.message || "No profit/loss rows available."}
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs uppercase text-muted-foreground border-b border-border/60">
                                    <tr>
                                        <th className="text-left py-2 pr-4">Segment</th>
                                        <th className="text-right py-2 pr-4">Revenue</th>
                                        <th className="text-right py-2 pr-4">Cost</th>
                                        <th className="text-right py-2 pr-4">Profit/Loss</th>
                                        <th className="text-right py-2">Margin %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {profitLossBreakdown.rows.map((row) => (
                                        <tr key={row.segment} className="border-b border-border/30">
                                            <td className="py-2 pr-4">{row.segment}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(row.revenue)}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(row.cost)}</td>
                                            <td
                                                className={`py-2 pr-4 text-right font-medium ${row.profit < 0
                                                        ? "text-rose-600 dark:text-rose-400"
                                                        : "text-emerald-600 dark:text-emerald-400"
                                                    }`}
                                            >
                                                {formatCurrency(row.profit)}
                                            </td>
                                            <td className="py-2 text-right">
                                                {row.margin_pct === null ? "N/A" : `${row.margin_pct.toFixed(2)}%`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Charts Section */}
            {(metrics?.chart_data?.length || metrics?.analyst_insights?.simplified_trend?.points?.length) ? (
                <OverviewCharts
                    data={metrics.chart_data || []}
                    numericColumns={metrics.numeric_columns}
                    insights={metrics.analyst_insights}
                />
            ) : null}

            {/* Additional Overview Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Recent Activity
                    </h3>
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-4 text-sm">
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold">
                                    JD
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium">John Doe updated Q1 Sales Data</p>
                                    <p className="text-muted-foreground text-xs">2 hours ago</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-primary" />
                        Subscription Usage
                    </h3>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>AI Queries</span>
                                <span className="text-muted-foreground">850 / 1,000</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary w-[85%] rounded-full" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Storage</span>
                                <span className="text-muted-foreground">2.1 GB / 5 GB</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 w-[42%] rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
