"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Lightbulb, TrendingUp } from "lucide-react";

interface DataQualityIssue {
    column: string;
    missing_count: number;
    missing_pct: number;
}

interface DataQualitySummary {
    rows_analyzed: number;
    columns_analyzed: number;
    duplicate_rows: number;
    duplicate_pct: number;
    completeness_pct: number;
    high_missing_columns: DataQualityIssue[];
}

interface CorrelationInsight {
    column_x: string;
    column_y: string;
    correlation: number;
    strength: number;
    direction: "positive" | "negative";
}

interface SegmentRow {
    segment: string;
    sum: number;
    mean: number;
    count: number;
    share_pct: number;
}

interface SegmentInsight {
    segment_column: string;
    metric_column: string;
    top_segments: SegmentRow[];
}

interface TrendPoint {
    period: string;
    value: number;
}

interface TrendInsight {
    date_column: string;
    metric_column: string;
    latest_value: number;
    previous_value: number;
    growth_pct: number | null;
    direction: "up" | "down";
    points: TrendPoint[];
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

interface SimplifiedTrend {
    date_column: string;
    growth_metric: string | null;
    growth_pct: number | null;
    points: Array<Record<string, string | number | null>>;
}

export interface AnalystInsights {
    executive_summary: string;
    recommendations: string[];
    data_quality: DataQualitySummary;
    top_correlations: CorrelationInsight[];
    segments: SegmentInsight[];
    trend: TrendInsight | null;
    business_summary?: BusinessSummary;
    profit_loss_breakdown?: ProfitLossBreakdown;
    simplified_trend?: SimplifiedTrend | null;
    chart_explanations?: string[];
}

interface AnalystInsightsPanelProps {
    insights: AnalystInsights | null | undefined;
}

function formatValue(value: number): string {
    if (!Number.isFinite(value)) return "0";
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AnalystInsightsPanel({ insights }: AnalystInsightsPanelProps) {
    if (!insights) return null;

    const topCorrelation = insights.top_correlations?.[0];
    const topSegment = insights.segments?.[0];
    const topMissing = insights.data_quality?.high_missing_columns?.[0];
    const businessSummary = insights.business_summary;

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary">
                    <Lightbulb className="w-4 h-4" />
                    Analyst Summary
                </h3>
                <p className="text-sm leading-relaxed mb-4">{insights.executive_summary}</p>
                {businessSummary?.message && (
                    <p className="text-xs text-primary mb-3">{businessSummary.message}</p>
                )}
                <div className="space-y-2">
                    {insights.recommendations.slice(0, 5).map((item, index) => (
                        <div key={`${item}-${index}`} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                            <span>{item}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Data Quality
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                    <div className="rounded-lg bg-secondary/60 p-3">
                        <p className="text-muted-foreground">Completeness</p>
                        <p className="font-semibold">{insights.data_quality.completeness_pct}%</p>
                    </div>
                    <div className="rounded-lg bg-secondary/60 p-3">
                        <p className="text-muted-foreground">Duplicate Rows</p>
                        <p className="font-semibold">{insights.data_quality.duplicate_rows}</p>
                    </div>
                </div>
                {topMissing ? (
                    <p className="text-sm text-muted-foreground">
                        Highest missing field: <span className="font-medium text-foreground">{topMissing.column}</span>{" "}
                        ({topMissing.missing_pct}% missing)
                    </p>
                ) : (
                    <p className="text-sm text-muted-foreground">No major missing-data issues detected.</p>
                )}
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Key Relationships
                </h3>
                {topCorrelation ? (
                    <div className="space-y-2 text-sm">
                        <p>
                            Strongest pair:{" "}
                            <span className="font-medium">
                                {topCorrelation.column_x} vs {topCorrelation.column_y}
                            </span>
                        </p>
                        <p className="text-muted-foreground">
                            {topCorrelation.direction} correlation: {topCorrelation.correlation}
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Not enough numeric columns for correlation analysis.</p>
                )}
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Segment & Trend
                </h3>
                <div className="space-y-4 text-sm">
                    {topSegment?.top_segments?.[0] ? (
                        <p>
                            Top <span className="font-medium">{topSegment.segment_column}</span> segment is{" "}
                            <span className="font-medium">{topSegment.top_segments[0].segment}</span> with{" "}
                            {topSegment.top_segments[0].share_pct}% share of {topSegment.metric_column}.
                        </p>
                    ) : (
                        <p className="text-muted-foreground">No segment insights available from categorical dimensions.</p>
                    )}
                    {insights.trend ? (
                        <p>
                            Latest {insights.trend.metric_column}:{" "}
                            <span className="font-medium">{formatValue(insights.trend.latest_value)}</span>{" "}
                            ({insights.trend.growth_pct ?? 0}% vs previous period).
                        </p>
                    ) : (
                        <p className="text-muted-foreground">No reliable time-series trend detected.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
