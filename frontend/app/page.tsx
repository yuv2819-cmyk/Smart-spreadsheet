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

export default function Home() {
    return (
        <div className="flex flex-col gap-6 h-full min-h-[calc(100vh-6rem)]">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <StatCard
                    title="Total Revenue"
                    value="$361,005"
                    trend="+12.5%"
                    trendUp={true}
                    icon={DollarSign}
                    color="blue"
                />
                <StatCard
                    title="Total Orders"
                    value="1,250"
                    trend="+8.2%"
                    trendUp={true}
                    icon={ShoppingCart}
                    color="violet"
                />
                <StatCard
                    title="Avg. Order Value"
                    value="$288"
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
