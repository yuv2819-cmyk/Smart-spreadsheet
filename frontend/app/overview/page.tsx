"use client";

import { useCallback, useEffect, useState } from "react";
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
import DataCleaningPanel from "@/components/DataCleaningPanel";
import BusinessInsightsSuite, {
    type AnalystInsightsExt,
    type BusinessSummary,
    type ProfitLossBreakdown,
} from "@/components/BusinessInsightsSuite";
import IndiaInsightsPanel, { type IndiaInsightsPayload } from "@/components/IndiaInsightsPanel";
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

interface WorkspaceSettingsLite {
    india_mode_enabled?: boolean;
}

export default function OverviewPage() {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<AISummary | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [showProfitLoss, setShowProfitLoss] = useState(false);
    const [insightsView, setInsightsView] = useState<"executive" | "analyst">("executive");
    const [indiaModeEnabled, setIndiaModeEnabled] = useState(false);
    const [indiaInsights, setIndiaInsights] = useState<IndiaInsightsPayload | null>(null);
    const [indiaLoading, setIndiaLoading] = useState(false);

    const fetchMetrics = useCallback(async () => {
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
    }, []);

    useEffect(() => {
        void fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const response = await apiFetch("/workspace/settings");
                if (!response.ok) return;
                const payload: WorkspaceSettingsLite = await response.json();
                setIndiaModeEnabled(Boolean(payload.india_mode_enabled));
            } catch {
                setIndiaModeEnabled(false);
            }
        };
        void loadSettings();
    }, []);

    useEffect(() => {
        const loadIndiaInsights = async () => {
            if (!indiaModeEnabled || !metrics?.dataset_id || (metrics?.total_rows ?? 0) <= 0) {
                setIndiaInsights(null);
                return;
            }
            setIndiaLoading(true);
            try {
                const response = await apiFetch(`/india/insights?dataset_id=${metrics.dataset_id}`);
                if (!response.ok) throw new Error("Failed to load India insights");
                const payload = await response.json();
                setIndiaInsights(payload as IndiaInsightsPayload);
            } catch {
                setIndiaInsights(null);
            } finally {
                setIndiaLoading(false);
            }
        };
        void loadIndiaInsights();
    }, [indiaModeEnabled, metrics?.dataset_id, metrics?.total_rows]);

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
            <div className="panel-surface flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading overview...
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
    const hasData = (metrics?.total_rows ?? 0) > 0;

    return (
        <div className="flex h-full flex-col gap-5 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="section-header">
                    <h1 className="section-title">Overview</h1>
                    <p className="section-subtitle">Business intelligence dashboard with analyst-grade diagnostics.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <CsvUpload onUploadSuccess={handleUploadSuccess} />
                    {hasData && (
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
                            className="rounded-lg border border-destructive/30 px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                        >
                            Clear Data
                        </button>
                    )}
                    <button
                        onClick={handleSummarize}
                        disabled={isSummarizing || !hasData}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                        {isSummarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Summarize
                    </button>
                    {!!profitLossBreakdown?.rows?.length && (
                        <button
                            onClick={() => setShowProfitLoss((prev) => !prev)}
                            className="rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
                        >
                            {showProfitLoss ? "Hide Profit/Loss" : "Show Profit/Loss"}
                        </button>
                    )}
                </div>
            </div>

            {!hasData && (
                <div className="panel-surface flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-semibold">No dataset loaded</h3>
                        <p className="text-sm text-muted-foreground">
                            Upload a CSV to unlock cleaning, AI summary, charts, and report generation.
                        </p>
                    </div>
                    <div className="status-badge status-badge--neutral">Waiting for data</div>
                </div>
            )}

            {summary && (
                <div className="panel-surface animate-in slide-in-from-top-4">
                    <h3 className="mb-2 flex items-center gap-2 font-semibold text-primary">
                        <Sparkles className="h-4 w-4" />
                        AI Summary
                    </h3>
                    <p className="mb-4 text-sm leading-relaxed">{summary.summary}</p>
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

            {!!metrics?.dataset_id && hasData && (
                <DataCleaningPanel
                    datasetId={metrics.dataset_id}
                    onApplied={handleUploadSuccess}
                />
            )}

            {!!insights && hasData && (
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
                        <div className="panel-surface">
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

            {indiaModeEnabled && (
                indiaLoading ? (
                    <div className="panel-surface inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading India insights...
                    </div>
                ) : (
                    <IndiaInsightsPanel insights={indiaInsights} />
                )
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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
