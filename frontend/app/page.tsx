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
import { API_URL } from "@/lib/api-config";

interface OverviewMetrics {
    total_rows: number;
    total_columns: number;
    numeric_columns: string[];
    basic_stats: Record<string, { min: number; max: number; avg: number }>;
}

export default function Home() {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await fetch(`${API_URL}/overview/metrics`);
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

    const totalRevenue = revenueCol && metrics?.basic_stats[revenueCol]
        ? `$${Math.round(metrics.basic_stats[revenueCol].avg * metrics.total_rows).toLocaleString()}`
        : "$361,005";
    const totalOrders = metrics?.total_rows ? metrics.total_rows.toLocaleString() : "1,250";
    const avgOrderValue = revenueCol && metrics?.basic_stats[revenueCol]
        ? `$${Math.round(metrics.basic_stats[revenueCol].avg)}`
        : "$288";

    return (
        <div className="flex flex-col gap-6 h-full min-h-[calc(100vh-6rem)]">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatCard
                    title="Total Revenue"
                    value={totalRevenue}
                    trend="+12.5%"
                    trendUp={true}
                    icon={DollarSign}
                    color="blue"
                />
                <StatCard
                    title="Total Orders"
                    value={totalOrders}
                    trend="+8.2%"
                    trendUp={true}
                    icon={ShoppingCart}
                    color="violet"
                />
                <StatCard
                    title="Avg. Order Value"
                    value={avgOrderValue}
                    trend="-2.4%"
                    trendUp={false}
                    icon={Activity}
                    color="rose"
                />
                <StatCard
                    title="Growth Rate"
                    value="24.5%"
                    trend="+4.1%"
                    trendUp={true}
                    icon={TrendingUp}
                    color="emerald"
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
