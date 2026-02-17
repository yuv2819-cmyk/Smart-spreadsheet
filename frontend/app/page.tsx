"use client";

import Spreadsheet from "@/components/Spreadsheet";
import AIAssistant from "@/components/AIAssistant";
import StatCard from "@/components/StatCard";
import {
    DollarSign,
    ShoppingCart,
    TrendingUp,
    Activity
} from "lucide-react";
import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

interface OverviewMetrics {
    total_rows: number;
    total_columns: number;
    numeric_columns: string[];
    basic_stats: Record<string, { min: number; max: number; avg: number }>;
    analyst_insights?: {
        trend?: { growth_pct?: number | null } | null;
        simplified_trend?: {
            growth_pct?: number | null;
            points?: Array<Record<string, string | number | null>>;
        } | null;
        business_summary?: {
            total_revenue?: number | null;
            total_profit?: number | null;
            profit_margin_pct?: number | null;
        } | null;
    } | null;
}

function formatCurrency(value: number | null | undefined): string {
    if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function pctChange(points: Array<Record<string, string | number | null>>, key: string): number | null {
    if (points.length < 2) return null;
    const last = points[points.length - 1]?.[key];
    const prev = points[points.length - 2]?.[key];
    if (typeof last !== "number" || typeof prev !== "number" || !Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) {
        return null;
    }
    return ((last - prev) / Math.abs(prev)) * 100;
}

export default function Home() {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await apiFetch("/overview/metrics");
                if (response.ok) {
                    const data = await response.json();
                    setMetrics(data);
                }
            } catch (error) {
                console.error("Failed to fetch metrics:", error);
            }
        };
        fetchMetrics();
    }, []);

    // Calculate dynamic stats from metrics
    const revenueCol = metrics?.numeric_columns.find(c => c.toLowerCase().includes("revenue") || c.toLowerCase().includes("sales"));

    const insights = metrics?.analyst_insights || null;
    const business = insights?.business_summary || null;

    const totalRevenue = typeof business?.total_revenue === "number"
        ? formatCurrency(business.total_revenue)
        : (revenueCol && metrics?.basic_stats?.[revenueCol])
            ? formatCurrency(metrics.basic_stats[revenueCol].avg * metrics.total_rows)
            : "N/A";

    const totalOrders = metrics?.total_rows ? metrics.total_rows.toLocaleString() : "0";

    const avgOrderValue = revenueCol && metrics?.basic_stats?.[revenueCol]
        ? formatCurrency(metrics.basic_stats[revenueCol].avg)
        : "N/A";

    const simplifiedPoints = (insights?.simplified_trend?.points || []) as Array<Record<string, string | number | null>>;
    const revenueMoM = pctChange(simplifiedPoints, "revenue");
    const growthRate = revenueMoM === null ? "N/A" : `${revenueMoM.toFixed(2)}%`;
    const growthBadge = revenueMoM === null ? "No trend" : `${revenueMoM >= 0 ? "+" : ""}${revenueMoM.toFixed(2)}%`;
    const growthUp = revenueMoM === null ? true : revenueMoM >= 0;

    return (
        <div className="flex flex-col gap-6 h-full min-h-[calc(100vh-6rem)]">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatCard
                    title="Total Revenue"
                    value={totalRevenue}
                    trend={revenueMoM === null ? "Current" : `${revenueMoM >= 0 ? "+" : ""}${revenueMoM.toFixed(2)}%`}
                    trendUp={revenueMoM === null ? true : revenueMoM >= 0}
                    icon={DollarSign}
                    color="blue"
                    trendContext={revenueMoM === null ? "" : "MoM"}
                />
                <StatCard
                    title="Total Orders"
                    value={totalOrders}
                    trend="Rows"
                    trendUp={true}
                    icon={ShoppingCart}
                    color="violet"
                    trendContext=""
                />
                <StatCard
                    title="Avg. Order Value"
                    value={avgOrderValue}
                    trend={revenueCol ? `Avg of ${revenueCol}` : "N/A"}
                    trendUp={true}
                    icon={Activity}
                    color="rose"
                    trendContext=""
                />
                <StatCard
                    title="Growth Rate"
                    value={growthRate}
                    trend={growthBadge}
                    trendUp={growthUp}
                    icon={TrendingUp}
                    color="emerald"
                    trendContext={revenueMoM === null ? "" : "MoM"}
                />
            </div>

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-0 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-backwards delay-100">
                {/* Spreadsheet Area (3/4 width) */}
                <div className="lg:col-span-3 h-[500px] lg:h-auto min-h-0 shadow-sm transition-all hover:shadow-md">
                    <Spreadsheet />
                </div>

                {/* AI Assistant (1/4 width) */}
                <div className="lg:col-span-1 h-[500px] lg:h-auto min-h-0 shadow-sm transition-all hover:shadow-md">
                    <AIAssistant />
                </div>
            </div>
        </div>
    );
}
