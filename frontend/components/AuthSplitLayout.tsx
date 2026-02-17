"use client";

import { BarChart3, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

interface AuthSplitLayoutProps {
    children: React.ReactNode;
}

const featureHighlights = [
    {
        icon: BarChart3,
        title: "Clear Profit & Loss",
        description: "Instantly surface margin trends, revenue drops, and hidden cost leaks.",
    },
    {
        icon: TrendingUp,
        title: "Actionable Forecasts",
        description: "Convert spreadsheet history into practical next-step recommendations.",
    },
    {
        icon: ShieldCheck,
        title: "Secure Workspaces",
        description: "Tenant-scoped access keeps each team's business data isolated and safe.",
    },
    {
        icon: Sparkles,
        title: "AI Analyst Assistant",
        description: "Ask questions in plain language and get concise analyst-style insights.",
    },
];

export default function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
    return (
        <div className="relative min-h-screen overflow-hidden bg-[#060817] text-slate-100">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -left-20 top-12 h-56 w-56 rounded-full bg-cyan-500/20 blur-3xl" />
                <div className="absolute right-0 top-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
                <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-teal-400/10 blur-3xl" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="w-full lg:max-w-[530px]">{children}</section>

                <aside className="hidden flex-1 rounded-[32px] border border-white/10 bg-white/[0.03] p-10 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:block">
                    <p className="text-xs font-semibold uppercase tracking-[0.34em] text-cyan-300/80">Smartsheet</p>
                    <h1 className="mt-4 text-5xl font-black leading-tight tracking-tight text-white">
                        SmartSheet
                        <span className="block bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
                            Business Intelligence
                        </span>
                    </h1>
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                        Turn raw CSV files into decision-ready dashboards, analyst summaries, and fast business insights.
                    </p>

                    <div className="mt-10 grid grid-cols-2 gap-4">
                        {featureHighlights.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.title}
                                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                                >
                                    <Icon className="h-5 w-5 text-cyan-300" />
                                    <h3 className="mt-3 text-sm font-semibold text-white">{item.title}</h3>
                                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.description}</p>
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>
        </div>
    );
}
