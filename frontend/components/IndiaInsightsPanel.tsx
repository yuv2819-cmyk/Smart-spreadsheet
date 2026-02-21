"use client";

import { AlertTriangle, Landmark, MapPinned, ReceiptText, TrendingUp } from "lucide-react";

export interface IndiaInsightsPayload {
    dataset_id?: number;
    locale: string;
    currency: string;
    number_format: "international" | "indian" | string;
    fiscal_year_start_month: number;
    macro_overlay: Array<Record<string, string | number | null | string[]>>;
    fiscal_year_summary: Array<Record<string, string | number | null>>;
    festival_impact: Array<Record<string, string | number | null>>;
    state_performance: Array<Record<string, string | number | null>>;
    tier_performance: Array<Record<string, string | number | null>>;
    gst_summary: Record<string, string | number | null | string[]>;
    sector_benchmarks: Record<string, unknown>;
    compliance_alerts: Array<Record<string, string | number | null>>;
    localization: Record<string, unknown>;
    recommended_actions: string[];
}

function formatAmount(
    value: number | null | undefined,
    currency: string,
    numberFormat: string,
): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
    const locale = numberFormat === "indian" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency === "INR" ? "INR" : "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatNumber(value: number | null | undefined, numberFormat: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "N/A";
    const locale = numberFormat === "indian" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
}

export default function IndiaInsightsPanel({
    insights,
}: {
    insights: IndiaInsightsPayload | null;
}) {
    if (!insights) return null;

    const localizationSummary = String(insights.localization?.summary || "");
    const sector = String((insights.sector_benchmarks?.sector as string) || "general");

    return (
        <div className="panel-surface">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-semibold">India Insights Mode</h3>
                    <p className="text-sm text-muted-foreground">
                        India trends overlay, FY analysis, GST readiness, and compliance signals.
                    </p>
                </div>
                <span className="status-badge status-badge--neutral">
                    Sector benchmark: {sector}
                </span>
            </div>

            {localizationSummary && (
                <p className="mb-4 text-sm text-muted-foreground">{localizationSummary}</p>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="panel-surface-tight">
                    <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Macro + Business Overlay
                    </h4>
                    <div className="space-y-2">
                        {insights.macro_overlay.slice(-4).map((row, idx) => (
                            <div key={`${String(row.period)}-${idx}`} className="rounded-md border border-border/50 bg-background/50 p-2">
                                <p className="text-xs font-medium">{String(row.period)}</p>
                                <p className="text-xs text-muted-foreground">
                                    Revenue: {formatAmount(Number(row.revenue ?? null), insights.currency, insights.number_format)}
                                    {" | "}CPI: {formatNumber(Number(row.cpi_inflation_pct ?? null), insights.number_format)}%
                                    {" | "}Repo: {formatNumber(Number(row.repo_rate_pct ?? null), insights.number_format)}%
                                </p>
                            </div>
                        ))}
                        {insights.macro_overlay.length === 0 && (
                            <p className="text-xs text-muted-foreground">No macro overlay available yet.</p>
                        )}
                    </div>
                </div>

                <div className="panel-surface-tight">
                    <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                        <Landmark className="h-4 w-4 text-primary" />
                        Fiscal Year Summary (Apr-Mar ready)
                    </h4>
                    <div className="space-y-2">
                        {insights.fiscal_year_summary.slice(-3).map((row, idx) => (
                            <div key={`${String(row.fiscal_year)}-${idx}`} className="rounded-md border border-border/50 bg-background/50 p-2 text-xs">
                                <p className="font-medium">{String(row.fiscal_year)}</p>
                                <p className="text-muted-foreground">
                                    Revenue: {formatAmount(Number(row.revenue ?? null), insights.currency, insights.number_format)}
                                    {" | "}Profit: {formatAmount(Number(row.profit ?? null), insights.currency, insights.number_format)}
                                    {" | "}Margin: {formatNumber(Number(row.profit_margin_pct ?? null), insights.number_format)}%
                                </p>
                            </div>
                        ))}
                        {insights.fiscal_year_summary.length === 0 && (
                            <p className="text-xs text-muted-foreground">Fiscal-year summary will appear once dated data is available.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="panel-surface-tight">
                    <h4 className="mb-2 text-sm font-semibold">Festival Demand Lens</h4>
                    <div className="space-y-1">
                        {insights.festival_impact.slice(0, 5).map((item, idx) => (
                            <p key={`${String(item.festival)}-${idx}`} className="text-xs text-muted-foreground">
                                {String(item.festival)} ({String(item.period)}): {formatNumber(Number(item.mom_change_pct ?? null), insights.number_format)}% MoM
                            </p>
                        ))}
                        {insights.festival_impact.length === 0 && (
                            <p className="text-xs text-muted-foreground">No festival-linked trend found in this dataset period.</p>
                        )}
                    </div>
                </div>

                <div className="panel-surface-tight">
                    <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                        <MapPinned className="h-4 w-4 text-primary" />
                        State / Tier Performance
                    </h4>
                    <div className="space-y-1">
                        {insights.state_performance.slice(0, 4).map((item, idx) => (
                            <p key={`${String(item.location)}-${idx}`} className="text-xs text-muted-foreground">
                                {String(item.location)} ({String(item.tier)}): {formatAmount(Number(item.revenue ?? null), insights.currency, insights.number_format)}
                            </p>
                        ))}
                        {insights.state_performance.length === 0 && (
                            <p className="text-xs text-muted-foreground">No state/region column detected in the dataset.</p>
                        )}
                    </div>
                </div>

                <div className="panel-surface-tight">
                    <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                        <ReceiptText className="h-4 w-4 text-primary" />
                        GST Snapshot
                    </h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p>Net GST: {formatAmount(Number(insights.gst_summary?.net_gst_payable ?? null), insights.currency, insights.number_format)}</p>
                        <p>Return readiness: {formatNumber(Number(insights.gst_summary?.return_readiness_pct ?? null), insights.number_format)}%</p>
                        <p>Method: {String(insights.gst_summary?.estimation_method || "n/a")}</p>
                    </div>
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="panel-surface-tight">
                    <h4 className="mb-2 inline-flex items-center gap-2 text-sm font-semibold">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Compliance Alerts
                    </h4>
                    <div className="space-y-1">
                        {insights.compliance_alerts.slice(0, 4).map((item, idx) => (
                            <p key={`${String(item.name)}-${idx}`} className="text-xs text-muted-foreground">
                                {String(item.name)}: due in {String(item.due_in_days)} day(s)
                            </p>
                        ))}
                        {insights.compliance_alerts.length === 0 && (
                            <p className="text-xs text-muted-foreground">No compliance alert data available.</p>
                        )}
                    </div>
                </div>

                <div className="panel-surface-tight">
                    <h4 className="mb-2 text-sm font-semibold">Recommended Actions</h4>
                    <div className="space-y-1">
                        {insights.recommended_actions.slice(0, 5).map((action, idx) => (
                            <p key={`${action}-${idx}`} className="text-xs text-muted-foreground">
                                - {action}
                            </p>
                        ))}
                        {insights.recommended_actions.length === 0 && (
                            <p className="text-xs text-muted-foreground">No actions available yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
