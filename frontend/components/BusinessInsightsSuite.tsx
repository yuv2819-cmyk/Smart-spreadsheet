"use client";

import { useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    ArrowDownRight,
    ArrowUpRight,
    SlidersHorizontal,
    Target,
} from "lucide-react";

export interface BusinessSummary {
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

export interface ProfitLossBreakdownRow {
    segment: string;
    revenue: number | null;
    cost: number | null;
    profit: number;
    margin_pct: number | null;
    status: "profit" | "loss";
}

export interface ProfitLossBreakdown {
    segment_column: string | null;
    rows: ProfitLossBreakdownRow[];
    top_profit_segments: Array<{ segment: string; profit: number }>;
    top_loss_segments: Array<{ segment: string; profit: number }>;
    message: string | null;
}

export interface KeyDriver {
    driver: string;
    metric: string;
    impact: number;
    direction: "positive" | "negative";
    source: string;
}

export interface InsightAlert {
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    action: string;
}

export interface SimplifiedTrendPoint {
    period: string;
    revenue?: number | null;
    cost?: number | null;
    profit?: number | null;
}

export interface SimplifiedTrend {
    date_column: string;
    growth_metric: string | null;
    growth_pct: number | null;
    points: SimplifiedTrendPoint[];
}

export interface DataQualityCategoryIssue {
    column: string;
    canonical: string;
    variant_count: number;
    affected_rows: number;
    examples: string[];
}

export interface DataQualitySummary {
    rows_analyzed: number;
    columns_analyzed: number;
    duplicate_rows: number;
    duplicate_pct: number;
    completeness_pct: number;
    high_missing_columns: Array<{
        column: string;
        missing_count: number;
        missing_pct: number;
    }>;
    inconsistent_categories?: DataQualityCategoryIssue[];
}

export interface AnalystInsightsExt {
    executive_summary: string;
    recommendations: string[];
    data_quality: DataQualitySummary;
    business_summary?: BusinessSummary;
    profit_loss_breakdown?: ProfitLossBreakdown;
    simplified_trend?: SimplifiedTrend | null;
    key_drivers?: {
        positive_drivers: KeyDriver[];
        negative_drivers: KeyDriver[];
    };
    alerts?: InsightAlert[];
}

interface GoalTargets {
    revenue: number;
    profit: number;
    margin: number;
}

interface BusinessInsightsSuiteProps {
    insights: AnalystInsightsExt | null;
    businessSummary: BusinessSummary | null;
    metrics: { total_rows: number } | null;
    showProfitLoss: boolean;
}

const GOALS_STORAGE_KEY = "smartsheet_goal_targets_v1";

function formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatPct(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
    return `${value.toFixed(2)}%`;
}

function computeTrendPct(points: SimplifiedTrendPoint[], key: "revenue" | "cost" | "profit"): number | null {
    if (points.length < 2) return null;
    const current = points[points.length - 1]?.[key];
    const previous = points[points.length - 2]?.[key];
    if (typeof current !== "number" || typeof previous !== "number" || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

function progressPct(actual: number | null | undefined, target: number): number {
    if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(actual ?? null)) return 0;
    const raw = ((actual ?? 0) / target) * 100;
    return Math.max(0, Math.min(100, raw));
}

function severityClasses(severity: InsightAlert["severity"]): string {
    if (severity === "critical") return "border-rose-500/40 bg-rose-500/10 text-rose-400";
    if (severity === "warning") return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    return "border-blue-500/30 bg-blue-500/10 text-blue-300";
}

export default function BusinessInsightsSuite({
    insights,
    businessSummary,
    metrics,
    showProfitLoss,
}: BusinessInsightsSuiteProps) {
    const [scenario, setScenario] = useState({ pricePct: 0, costPct: 0, volumePct: 0 });
    const [goalTargets, setGoalTargets] = useState<GoalTargets | null>(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = localStorage.getItem(GOALS_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as GoalTargets;
            if (
                Number.isFinite(parsed?.revenue)
                && Number.isFinite(parsed?.profit)
                && Number.isFinite(parsed?.margin)
            ) {
                return parsed;
            }
            return null;
        } catch {
            return null;
        }
    });

    const simplifiedTrendPoints = useMemo(
        () => (insights?.simplified_trend?.points || []) as SimplifiedTrendPoint[],
        [insights?.simplified_trend?.points]
    );
    const trendRevenue = useMemo(() => computeTrendPct(simplifiedTrendPoints, "revenue"), [simplifiedTrendPoints]);
    const trendCost = useMemo(() => computeTrendPct(simplifiedTrendPoints, "cost"), [simplifiedTrendPoints]);
    const trendProfit = useMemo(() => computeTrendPct(simplifiedTrendPoints, "profit"), [simplifiedTrendPoints]);
    const defaultGoalTargets = useMemo<GoalTargets | null>(() => {
        if (!businessSummary) return null;
        return {
            revenue: Math.max(1, (businessSummary.total_revenue || 0) * 1.1),
            profit: Math.max(1, (businessSummary.total_profit || 0) * 1.1),
            margin: Math.max(1, (businessSummary.profit_margin_pct || 0) + 3),
        };
    }, [businessSummary]);
    const effectiveGoalTargets = goalTargets || defaultGoalTargets;

    useEffect(() => {
        if (!goalTargets || typeof window === "undefined") return;
        localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goalTargets));
    }, [goalTargets]);

    if (!insights || !metrics) return null;

    const alerts = insights.alerts || [];
    const keyDrivers = insights.key_drivers || { positive_drivers: [], negative_drivers: [] };
    const quality = insights.data_quality;
    const profitLoss = insights.profit_loss_breakdown;

    const baselineRevenue = businessSummary?.total_revenue ?? 0;
    const baselineCost = businessSummary?.total_cost ?? Math.max(0, baselineRevenue - (businessSummary?.total_profit ?? 0));
    const baselineProfit = businessSummary?.total_profit ?? (baselineRevenue - baselineCost);
    const projectedRevenue = baselineRevenue * (1 + scenario.pricePct / 100) * (1 + scenario.volumePct / 100);
    const projectedCost = baselineCost * (1 + scenario.costPct / 100) * (1 + scenario.volumePct / 100);
    const projectedProfit = projectedRevenue - projectedCost;
    const projectedMargin = projectedRevenue === 0 ? null : (projectedProfit / projectedRevenue) * 100;
    const projectedProfitDelta = projectedProfit - baselineProfit;

    return (
        <>
            {businessSummary && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-lg">Profit & Loss Snapshot</h3>
                        {!businessSummary.profit_available && businessSummary.message && (
                            <span className="text-xs text-amber-600 dark:text-amber-400">{businessSummary.message}</span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                            <p className="text-xl font-semibold">{formatCurrency(businessSummary.total_revenue)}</p>
                            <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
                                {trendRevenue === null ? "No trend yet" : (
                                    <>
                                        {trendRevenue >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />}
                                        {Math.abs(trendRevenue).toFixed(2)}% vs previous month
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Cost</p>
                            <p className="text-xl font-semibold">{formatCurrency(businessSummary.total_cost)}</p>
                            <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
                                {trendCost === null ? "No trend yet" : (
                                    <>
                                        {trendCost <= 0 ? <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />}
                                        {Math.abs(trendCost).toFixed(2)}% vs previous month
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Profit / Loss</p>
                            <p className={`text-xl font-semibold ${businessSummary.total_profit !== null && businessSummary.total_profit < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                                {formatCurrency(businessSummary.total_profit)}
                            </p>
                            <p className="text-xs mt-1 text-muted-foreground flex items-center gap-1">
                                {trendProfit === null ? "No trend yet" : (
                                    <>
                                        {trendProfit >= 0 ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />}
                                        {Math.abs(trendProfit).toFixed(2)}% vs previous month
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                            <p className="text-xs text-muted-foreground mb-1">Profit Margin</p>
                            <p className="text-xl font-semibold">{formatPct(businessSummary.profit_margin_pct)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {(businessSummary.loss_rows ?? 0)} loss rows / {(businessSummary.profit_rows ?? 0)} profit rows
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4">Key Driver Breakdown</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-emerald-400 mb-2">Top Positive Drivers</p>
                            <div className="space-y-2">
                                {keyDrivers.positive_drivers.slice(0, 5).map((driver, idx) => (
                                    <div key={`${driver.driver}-${idx}`} className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-sm">
                                        <p className="font-medium">{driver.driver}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {driver.metric}: {driver.impact.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                ))}
                                {keyDrivers.positive_drivers.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No positive drivers detected yet.</p>
                                )}
                            </div>
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide text-rose-400 mb-2">Top Negative Drivers</p>
                            <div className="space-y-2">
                                {keyDrivers.negative_drivers.slice(0, 5).map((driver, idx) => (
                                    <div key={`${driver.driver}-${idx}`} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5 text-sm">
                                        <p className="font-medium">{driver.driver}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {driver.metric}: {driver.impact.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                ))}
                                {keyDrivers.negative_drivers.length === 0 && (
                                    <p className="text-sm text-muted-foreground">No negative drivers detected yet.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Alerts Panel
                    </h3>
                    <div className="space-y-3">
                        {alerts.map((alert, idx) => (
                            <div key={`${alert.title}-${idx}`} className={`rounded-lg border p-3 ${severityClasses(alert.severity)}`}>
                                <p className="text-sm font-semibold">{alert.title}</p>
                                <p className="text-xs mt-1 text-muted-foreground">{alert.description}</p>
                                <p className="text-xs mt-2">Action: {alert.action}</p>
                            </div>
                        ))}
                        {alerts.length === 0 && (
                            <p className="text-sm text-muted-foreground">No active alerts. Your core health signals look stable.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4 text-primary" />
                        Goal Tracking
                    </h3>
                    {effectiveGoalTargets ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="text-xs text-muted-foreground">
                                    Revenue Target
                                    <input
                                        type="number"
                                        value={effectiveGoalTargets.revenue}
                                        onChange={(e) => setGoalTargets((prev) => ({
                                            ...(prev || effectiveGoalTargets),
                                            revenue: Number(e.target.value) || 0,
                                        }))}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </label>
                                <label className="text-xs text-muted-foreground">
                                    Profit Target
                                    <input
                                        type="number"
                                        value={effectiveGoalTargets.profit}
                                        onChange={(e) => setGoalTargets((prev) => ({
                                            ...(prev || effectiveGoalTargets),
                                            profit: Number(e.target.value) || 0,
                                        }))}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </label>
                                <label className="text-xs text-muted-foreground">
                                    Margin Target %
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={effectiveGoalTargets.margin}
                                        onChange={(e) => setGoalTargets((prev) => ({
                                            ...(prev || effectiveGoalTargets),
                                            margin: Number(e.target.value) || 0,
                                        }))}
                                        className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                                    />
                                </label>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Revenue Progress</span>
                                        <span>{formatCurrency(businessSummary?.total_revenue)} / {formatCurrency(effectiveGoalTargets.revenue)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPct(businessSummary?.total_revenue, effectiveGoalTargets.revenue)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Profit Progress</span>
                                        <span>{formatCurrency(businessSummary?.total_profit)} / {formatCurrency(effectiveGoalTargets.profit)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${progressPct(businessSummary?.total_profit, effectiveGoalTargets.profit)}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span>Margin Progress</span>
                                        <span>{formatPct(businessSummary?.profit_margin_pct)} / {formatPct(effectiveGoalTargets.margin)}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${progressPct(businessSummary?.profit_margin_pct, effectiveGoalTargets.margin)}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Targets will appear once core metrics are available.</p>
                    )}
                </div>

                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        Scenario Simulator
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span>Price Change</span>
                                <span>{scenario.pricePct}%</span>
                            </div>
                            <input type="range" min={-40} max={40} value={scenario.pricePct} onChange={(e) => setScenario((prev) => ({ ...prev, pricePct: Number(e.target.value) }))} className="w-full" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span>Cost Change</span>
                                <span>{scenario.costPct}%</span>
                            </div>
                            <input type="range" min={-40} max={40} value={scenario.costPct} onChange={(e) => setScenario((prev) => ({ ...prev, costPct: Number(e.target.value) }))} className="w-full" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-sm mb-1">
                                <span>Volume Change</span>
                                <span>{scenario.volumePct}%</span>
                            </div>
                            <input type="range" min={-40} max={40} value={scenario.volumePct} onChange={(e) => setScenario((prev) => ({ ...prev, volumePct: Number(e.target.value) }))} className="w-full" />
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="rounded-lg border border-border/60 p-3">
                                <p className="text-xs text-muted-foreground">Projected Revenue</p>
                                <p className="font-semibold">{formatCurrency(projectedRevenue)}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                                <p className="text-xs text-muted-foreground">Projected Cost</p>
                                <p className="font-semibold">{formatCurrency(projectedCost)}</p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                                <p className="text-xs text-muted-foreground">Projected Profit</p>
                                <p className={`font-semibold ${projectedProfit < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                                    {formatCurrency(projectedProfit)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-border/60 p-3">
                                <p className="text-xs text-muted-foreground">Projected Margin</p>
                                <p className="font-semibold">{formatPct(projectedMargin)}</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Profit impact vs baseline:{" "}
                            <span className={projectedProfitDelta < 0 ? "text-rose-400" : "text-emerald-400"}>
                                {formatCurrency(projectedProfitDelta)}
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-4">Data Quality Health</h3>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs text-muted-foreground">Completeness</p>
                        <p className="text-xl font-semibold">{quality.completeness_pct.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs text-muted-foreground">Duplicate Rows</p>
                        <p className="text-xl font-semibold">{quality.duplicate_rows}</p>
                        <p className="text-xs text-muted-foreground">{quality.duplicate_pct.toFixed(2)}%</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-4">
                        <p className="text-xs text-muted-foreground">Inconsistent Categories</p>
                        <p className="text-xl font-semibold">{quality.inconsistent_categories?.length || 0}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                    <div>
                        <p className="text-sm font-medium mb-2">Top Missing Fields</p>
                        <div className="space-y-2">
                            {quality.high_missing_columns.slice(0, 5).map((item) => (
                                <div key={item.column} className="text-sm rounded-md border border-border/50 px-3 py-2 flex justify-between">
                                    <span>{item.column}</span>
                                    <span className="text-muted-foreground">{item.missing_pct}% missing</span>
                                </div>
                            ))}
                            {quality.high_missing_columns.length === 0 && (
                                <p className="text-sm text-muted-foreground">No high-missing columns detected.</p>
                            )}
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium mb-2">Category Normalization Issues</p>
                        <div className="space-y-2">
                            {(quality.inconsistent_categories || []).slice(0, 5).map((item) => (
                                <div key={`${item.column}-${item.canonical}`} className="text-sm rounded-md border border-border/50 px-3 py-2">
                                    <p className="font-medium">{item.column}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {item.variant_count} variants, examples: {item.examples.join(", ")}
                                    </p>
                                </div>
                            ))}
                            {(quality.inconsistent_categories || []).length === 0 && (
                                <p className="text-sm text-muted-foreground">No inconsistent category labels found.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showProfitLoss && profitLoss && (
                <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                    <h3 className="font-semibold mb-4">
                        Profit/Loss Breakdown
                        {profitLoss.segment_column ? ` by ${profitLoss.segment_column}` : ""}
                    </h3>
                    {profitLoss.rows.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {profitLoss.message || "No profit/loss rows available."}
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
                                    {profitLoss.rows.map((row) => (
                                        <tr key={row.segment} className="border-b border-border/30">
                                            <td className="py-2 pr-4">{row.segment}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(row.revenue)}</td>
                                            <td className="py-2 pr-4 text-right">{formatCurrency(row.cost)}</td>
                                            <td className={`py-2 pr-4 text-right font-medium ${row.profit < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
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
        </>
    );
}
