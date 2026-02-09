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
import { cn } from "@/lib/utils";
import OverviewCharts from "@/components/OverviewCharts";
import CsvUpload from "@/components/CsvUpload";
import { API_URL } from "@/lib/api-config";

interface OverviewMetrics {
    dataset_id?: number;
    total_rows: number;
    total_columns: number;
    numeric_columns: string[];
    last_updated: string | null;
    basic_stats: Record<string, { min: number; max: number; avg: number }>;
    chart_data: any[];
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

    const fetchMetrics = async () => {
        try {
            const response = await fetch(`${API_URL}/overview/metrics`);
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
            const response = await fetch(`${API_URL}/ai/summarize`, {
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
                                        await fetch(`${API_URL}/datasets/clear`, { method: "DELETE" });
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
                    trend={metrics?.numeric_columns.length + " Numeric"}
                    trendUp={true}
                    icon={Activity}
                    color="emerald"
                />
            </div>

            {/* Charts Section */}
            {metrics?.chart_data && metrics.chart_data.length > 0 && (
                <OverviewCharts
                    data={metrics.chart_data}
                    numericColumns={metrics.numeric_columns}
                />
            )}

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
