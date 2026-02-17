"use client";

import { useEffect, useState } from "react";
import {
    Activity,
    DollarSign,
    FileText,
    Loader2,
    ShoppingCart,
    Sparkles,
} from "lucide-react";

import CsvUpload from "@/components/CsvUpload";
import OverviewCharts from "@/components/OverviewCharts";
import StatCard from "@/components/StatCard";
import AnalystInsightsPanel, { type AnalystInsights } from "@/components/AnalystInsightsPanel";
import BusinessInsightsSuite, {
    type AnalystInsightsExt,
    type BusinessSummary,
    type ProfitLossBreakdown,
} from "@/components/BusinessInsightsSuite";
import { apiFetch } from "@/lib/api-client";

interface OverviewMetrics {
    dataset_id?: number;
    total_rows: number;
    total_columns: number;
    numeric_columns: string[];
    last_updated: string | null;
    basic_stats: Record<string, { min: number; max: number; avg: number }>;
    chart_data: Array<Record<string, string | number | null>>;
    analyst_insights?: AnalystInsightsExt | null;
}

interface AISummary {
    summary: string;
    key_insights: string[];
}

export default function OverviewPage() {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AISummary | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showProfitLoss, setShowProfitLoss] = useState(false);
    const [insightsView, setInsightsView] = useState<"executive" | "analyst">("executive");

    const fetchMetrics = async () => {
        try {
            const response = await apiFetch("/overview/metrics");
            if (response.ok) {
                const data = await response.json();
                setMetrics(data);
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
        setSummary(null);
        setShowProfitLoss(false);
        fetchMetrics();
    };

    const handleSummarize = async () => {
        if (!metrics?.dataset_id) return;
        setIsSummarizing(true);
        try {
            const response = await apiFetch("/ai/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_id: metrics.dataset_id }),
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

    const insights = (metrics?.analyst_insights || null) as AnalystInsightsExt | null;
    const businessSummary = (insights?.business_summary || null) as BusinessSummary | null;
    const profitLossBreakdown = (insights?.profit_loss_breakdown || null) as ProfitLossBreakdown | null;

    const numCols = metrics?.numeric_columns || [];
    const revCol = numCols.find((c) => c.toLowerCase().includes("revenue") || c.toLowerCase().includes("sales")) || numCols[0];
    const orderCol = numCols.find((c) => c !== revCol && (c.toLowerCase().includes("quantity") || c.toLowerCase().includes("units")));
    const revenueVal = revCol && metrics?.basic_stats[revCol] ? `$${metrics.basic_stats[revCol].avg.toFixed(0)}` : "N/A";
    const ordersVal = orderCol && metrics?.basic_stats[orderCol] ? Math.round(metrics.basic_stats[orderCol].avg).toString() : "N/A";

    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
                    <p className="text-muted-foreground">Business intelligence dashboard with analyst-grade diagnostics.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <CsvUpload onUploadSuccess={handleUploadSuccess} />
                    {metrics && metrics.total_rows > 0 && (
                        <button
                            onClick={async () => {
                                if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                                    setLoading(true);
                                    try {
                                        await apiFetch("/datasets/clear", { method: "DELETE" });
                                        handleUploadSuccess();
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
                    {!!profitLossBreakdown?.rows?.length && (
                        <button
                            onClick={() => setShowProfitLoss((prev) => !prev)}
                            className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors shadow-sm"
                        >
                            {showProfitLoss ? "Hide Profit/Loss" : "Show Profit/Loss"}
                        </button>
                    )}
                </div>
            </div>

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

            {!!insights && (metrics?.total_rows ?? 0) > 0 && (
                <>
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-lg">Summary View</h3>
                        <div className="inline-flex rounded-lg border border-border/60 bg-card/60 p-1">
                            <button
                                onClick={() => setInsightsView("executive")}
                                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${insightsView === "executive" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                                    }`}
                            >
                                Executive View
                            </button>
                            <button
                                onClick={() => setInsightsView("analyst")}
                                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${insightsView === "analyst" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                                    }`}
                            >
                                Analyst View
                            </button>
                        </div>
                    </div>

                    {insightsView === "executive" ? (
                        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                            <h4 className="font-semibold mb-2">Executive Summary</h4>
                            <p className="text-sm leading-relaxed">{insights.executive_summary}</p>
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                {insights.recommendations.slice(0, 6).map((item, idx) => (
                                    <p key={`${item}-${idx}`} className="text-sm text-muted-foreground">
                                        - {item}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <AnalystInsightsPanel insights={insights as AnalystInsights} />
                    )}
                </>
            )}

            <BusinessInsightsSuite
                insights={insights}
                businessSummary={businessSummary}
                metrics={metrics}
                showProfitLoss={showProfitLoss}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Rows"
                    value={metrics?.total_rows.toLocaleString() || "0"}
                    trend="Dataset Size"
                    trendUp={true}
                    icon={FileText}
                    color="blue"
                    trendContext=""
                />
                <StatCard
                    title="Avg. Value"
                    value={revenueVal}
                    trend={revCol ? `Avg of ${revCol}` : "No numeric data"}
                    trendUp={true}
                    icon={DollarSign}
                    color="violet"
                    trendContext=""
                />
                <StatCard
                    title="Avg. Units"
                    value={ordersVal}
                    trend={orderCol ? `Avg of ${orderCol}` : "No numeric data"}
                    trendUp={true}
                    icon={ShoppingCart}
                    color="rose"
                    trendContext=""
                />
                <StatCard
                    title="Columns"
                    value={metrics?.total_columns.toString() || "0"}
                    trend={`${metrics?.numeric_columns.length ?? 0} Numeric`}
                    trendUp={true}
                    icon={Activity}
                    color="emerald"
                    trendContext=""
                />
            </div>

            {(metrics?.chart_data?.length || metrics?.analyst_insights?.simplified_trend?.points?.length) ? (
                <OverviewCharts
                    data={metrics.chart_data || []}
                    numericColumns={metrics.numeric_columns}
                    insights={metrics.analyst_insights as unknown as {
                        simplified_trend?: {
                            date_column: string;
                            growth_metric: string | null;
                            growth_pct: number | null;
                            points: Array<Record<string, string | number | null>>;
                        } | null;
                        chart_explanations?: string[];
                    }}
                />
            ) : null}
        </div>
    );
}
