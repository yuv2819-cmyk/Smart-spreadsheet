"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, CheckCircle2, Download, FileText, Loader2, MessageSquare, RefreshCw, Share2, Trash2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { trackEvent } from "@/lib/analytics";

type ReportStatus = "Ready" | "Failed";
type ReportType = "Executive" | "Analyst" | "India Trend";
type DateRange = "7d" | "30d" | "all";
type ReportTypeFilter = "All" | "Executive" | "Analyst" | "India Trend";

interface GeneratedReport {
    id: number;
    name: string;
    type: ReportType;
    created_at: string;
    size_kb: string;
    status: ReportStatus;
    dataset_id: number;
    summary: string;
    key_insights: string[];
    recommendations: string[];
    risks: string[];
    drivers: string[];
    kpis: Record<string, string>;
}

interface OverviewResponse {
    dataset_id?: number;
    total_rows: number;
    total_columns: number;
    analyst_insights?: {
        executive_summary?: string;
        recommendations?: string[];
        alerts?: Array<{ title: string; description: string; severity: string }>;
        key_drivers?: {
            positive_drivers?: Array<{ driver: string; impact: number; metric: string }>;
            negative_drivers?: Array<{ driver: string; impact: number; metric: string }>;
        };
        business_summary?: {
            total_revenue?: number | null;
            total_cost?: number | null;
            total_profit?: number | null;
            profit_margin_pct?: number | null;
        };
    } | null;
}

interface AISummaryResponse {
    summary: string;
    key_insights: string[];
}

function normalizeReportType(value: unknown): ReportType {
    if (value === "Analyst") return "Analyst";
    if (value === "India Trend") return "India Trend";
    return "Executive";
}

function normalizeReport(raw: unknown): GeneratedReport | null {
    if (!raw || typeof raw !== "object") return null;
    const report = raw as Record<string, unknown>;

    const id = Number(report.id);
    const datasetId = Number(report.dataset_id);
    const name = typeof report.name === "string" ? report.name : "";
    const summary = typeof report.summary === "string" ? report.summary : "";

    if (!Number.isFinite(id) || !Number.isFinite(datasetId) || !name || !summary) {
        return null;
    }

    return {
        id,
        name,
        type: normalizeReportType(report.type),
        created_at:
            typeof report.created_at === "string"
                ? report.created_at
                : new Date().toISOString(),
        size_kb: typeof report.size_kb === "string" ? report.size_kb : "0.0 KB",
        status: report.status === "Failed" ? "Failed" : "Ready",
        dataset_id: datasetId,
        summary,
        key_insights: Array.isArray(report.key_insights) ? report.key_insights.map(String) : [],
        recommendations: Array.isArray(report.recommendations) ? report.recommendations.map(String) : [],
        risks: Array.isArray(report.risks) ? report.risks.map(String) : [],
        drivers: Array.isArray(report.drivers) ? report.drivers.map(String) : [],
        kpis:
            report.kpis && typeof report.kpis === "object"
                ? Object.fromEntries(
                    Object.entries(report.kpis as Record<string, unknown>).map(([key, value]) => [
                        key,
                        String(value),
                    ])
                )
                : {},
    };
}

function buildReportMarkdown(report: GeneratedReport): string {
    const lines: string[] = [];
    lines.push(`# ${report.name}`);
    lines.push("");
    lines.push(`- Report ID: ${report.id}`);
    lines.push(`- Dataset ID: ${report.dataset_id}`);
    lines.push(`- Type: ${report.type}`);
    lines.push(`- Generated: ${new Date(report.created_at).toLocaleString()}`);
    lines.push("");
    lines.push("## Executive Summary");
    lines.push(report.summary || "No summary available.");
    lines.push("");
    lines.push("## Key Insights");
    if (report.key_insights.length === 0) {
        lines.push("- No insights available.");
    } else {
        report.key_insights.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
    lines.push("## KPI Snapshot");
    if (Object.keys(report.kpis).length === 0) {
        lines.push("- KPI snapshot unavailable.");
    } else {
        Object.entries(report.kpis).forEach(([key, value]) => lines.push(`- ${key}: ${value}`));
    }
    lines.push("");
    lines.push("## Risk Alerts");
    if (report.risks.length === 0) {
        lines.push("- No major risks detected.");
    } else {
        report.risks.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
    lines.push("## Driver Highlights");
    if (report.drivers.length === 0) {
        lines.push("- No key drivers available.");
    } else {
        report.drivers.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
    lines.push("## Recommendations");
    if (report.recommendations.length === 0) {
        lines.push("- No recommendations available.");
    } else {
        report.recommendations.forEach((item) => lines.push(`- ${item}`));
    }
    lines.push("");
    lines.push("---");
    lines.push("Generated by SmartSheet");
    return lines.join("\n");
}

function estimateSizeKb(text: string): string {
    const bytes = new Blob([text]).size;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function inRange(dateIso: string, range: DateRange): boolean {
    if (range === "all") return true;
    const now = Date.now();
    const created = new Date(dateIso).getTime();
    if (Number.isNaN(created)) return false;
    const days = range === "7d" ? 7 : 30;
    return (now - created) <= days * 24 * 60 * 60 * 1000;
}

export default function ReportsPage() {
    const [reports, setReports] = useState<GeneratedReport[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("All");
    const [dateRange, setDateRange] = useState<DateRange>("30d");
    const [indiaReportLanguage, setIndiaReportLanguage] = useState<"english" | "hindi" | "hinglish">("english");

    const loadReports = useCallback(async () => {
        setLoadingReports(true);
        try {
            const response = await apiFetch("/reports");
            if (!response.ok) {
                throw new Error("Unable to load reports.");
            }
            const payload = await response.json();
            if (!Array.isArray(payload)) {
                throw new Error("Invalid reports response.");
            }
            const normalized = payload
                .map((item) => normalizeReport(item))
                .filter((item): item is GeneratedReport => item !== null);
            setReports(normalized);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Unable to load reports.";
            setError(message);
            setReports([]);
        } finally {
            setLoadingReports(false);
        }
    }, []);

    useEffect(() => {
        void loadReports();
    }, [loadReports]);

    const filteredReports = useMemo(
        () =>
            reports.filter((report) => {
                const typeMatch = typeFilter === "All" || report.type === typeFilter;
                return typeMatch && inRange(report.created_at, dateRange);
            }),
        [reports, typeFilter, dateRange]
    );

    const generateReport = async () => {
        setGenerating(true);
        setError(null);
        try {
            const latestRes = await apiFetch("/datasets/latest");
            if (!latestRes.ok) {
                throw new Error("No dataset found. Upload a CSV first.");
            }
            const latest = await latestRes.json();
            const datasetId = Number(latest?.id);
            const datasetName = String(latest?.name || "Dataset");
            if (!Number.isFinite(datasetId)) {
                throw new Error("Invalid dataset id returned by API.");
            }

            const overviewRes = await apiFetch("/overview/metrics");
            if (!overviewRes.ok) {
                throw new Error("Unable to load overview metrics.");
            }
            const overview: OverviewResponse = await overviewRes.json();

            let summaryPayload: AISummaryResponse | null = null;
            const summaryRes = await apiFetch("/ai/summarize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_id: datasetId }),
            });
            if (summaryRes.ok) {
                summaryPayload = await summaryRes.json();
            }

            const summary = summaryPayload?.summary
                || overview?.analyst_insights?.executive_summary
                || "Summary unavailable.";
            const keyInsights = summaryPayload?.key_insights || [];
            const recommendations = overview?.analyst_insights?.recommendations || [];
            const risks = (overview?.analyst_insights?.alerts || [])
                .slice(0, 5)
                .map((alert) => `[${String(alert.severity).toUpperCase()}] ${alert.title}: ${alert.description}`);

            const positiveDrivers = overview?.analyst_insights?.key_drivers?.positive_drivers || [];
            const negativeDrivers = overview?.analyst_insights?.key_drivers?.negative_drivers || [];
            const drivers = [
                ...positiveDrivers.slice(0, 3).map(
                    (item) => `Positive: ${item.driver} (${item.metric} ${item.impact.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                ),
                ...negativeDrivers.slice(0, 3).map(
                    (item) => `Negative: ${item.driver} (${item.metric} ${item.impact.toLocaleString(undefined, { maximumFractionDigits: 2 })})`
                ),
            ];

            const business = overview?.analyst_insights?.business_summary;
            const kpis: Record<string, string> = {};
            if (typeof business?.total_revenue === "number") kpis["Total Revenue"] = business.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (typeof business?.total_cost === "number") kpis["Total Cost"] = business.total_cost.toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (typeof business?.total_profit === "number") kpis["Total Profit"] = business.total_profit.toLocaleString(undefined, { maximumFractionDigits: 0 });
            if (typeof business?.profit_margin_pct === "number") kpis["Profit Margin %"] = business.profit_margin_pct.toFixed(2);

            const draftReport = {
                name: `${datasetName} - ${new Date().toLocaleDateString()} Report`,
                type: "Executive",
                status: "Ready",
                dataset_id: datasetId,
                summary,
                key_insights: keyInsights,
                recommendations,
                risks,
                drivers,
                kpis,
            } satisfies Omit<GeneratedReport, "id" | "created_at" | "size_kb">;

            const markdown = buildReportMarkdown({
                id: -1,
                created_at: new Date().toISOString(),
                size_kb: "0.0 KB",
                ...draftReport,
            });
            const sizeKb = estimateSizeKb(markdown);

            const createRes = await apiFetch("/reports", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...draftReport,
                    size_kb: sizeKb,
                    content_markdown: markdown,
                }),
            });
            if (!createRes.ok) {
                let message = "Failed to save report.";
                try {
                    const body = await createRes.json();
                    message = body.detail || message;
                } catch {
                    // Ignore JSON parse errors.
                }
                throw new Error(message);
            }

            const createdRaw = await createRes.json();
            const created = normalizeReport(createdRaw);
            if (!created) {
                throw new Error("Backend returned invalid report payload.");
            }

            setReports((prev) => [created, ...prev]);
            await trackEvent("frontend_report_generated", { report_id: created.id, dataset_id: created.dataset_id });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to generate report.";
            setError(message);
            await trackEvent("frontend_report_generate_failed", {});
        } finally {
            setGenerating(false);
        }
    };

    const generateIndiaReport = async () => {
        setGenerating(true);
        setError(null);
        try {
            const latestRes = await apiFetch("/datasets/latest");
            if (!latestRes.ok) {
                throw new Error("No dataset found. Upload a CSV first.");
            }
            const latest = await latestRes.json();
            const datasetId = Number(latest?.id);
            if (!Number.isFinite(datasetId)) {
                throw new Error("Invalid dataset id returned by API.");
            }

            const response = await apiFetch("/india/report", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_id: datasetId, language: indiaReportLanguage }),
            });
            if (!response.ok) {
                let message = "Failed to generate India trend report.";
                try {
                    const body = await response.json();
                    message = body.detail || message;
                } catch {
                    // ignore
                }
                throw new Error(message);
            }

            const createdRaw = await response.json();
            const created = normalizeReport(createdRaw);
            if (!created) {
                throw new Error("Backend returned invalid India report payload.");
            }
            setReports((prev) => [created, ...prev]);
            await trackEvent("frontend_india_report_generated", {
                report_id: created.id,
                dataset_id: created.dataset_id,
                language: indiaReportLanguage,
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to generate India report.";
            setError(message);
            await trackEvent("frontend_india_report_generate_failed", { language: indiaReportLanguage });
        } finally {
            setGenerating(false);
        }
    };

    const downloadReport = (report: GeneratedReport) => {
        const markdown = buildReportMarkdown(report);
        const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        const safeName = report.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
        anchor.download = `${safeName || "report"}.md`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    };

    const downloadReportPdf = async (report: GeneratedReport) => {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const marginX = 48;
        const marginY = 56;
        const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;
        const maxHeight = doc.internal.pageSize.getHeight() - marginY;
        const lines = doc.splitTextToSize(buildReportMarkdown(report), maxWidth);

        let y = marginY;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        for (const line of lines) {
            if (y > maxHeight) {
                doc.addPage();
                y = marginY;
            }
            doc.text(String(line), marginX, y);
            y += 14;
        }

        const safeName = report.name.replace(/[^a-z0-9-_]+/gi, "_").toLowerCase();
        doc.save(`${safeName || "report"}.pdf`);
    };

    const deleteReport = async (reportId: number) => {
        try {
            const response = await apiFetch(`/reports/${reportId}`, { method: "DELETE" });
            if (!response.ok) {
                throw new Error("Failed to delete report.");
            }
            setReports((prev) => prev.filter((report) => report.id !== reportId));
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to delete report.";
            setError(message);
        }
    };

    const shareReport = async (reportId: number) => {
        try {
            const response = await apiFetch(`/reports/${reportId}/share`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ expires_in_hours: 168 }),
            });
            if (!response.ok) throw new Error("Failed to create share link.");
            const payload = await response.json();
            const absoluteUrl = `${window.location.origin}${String(payload.share_url || "")}`;
            await navigator.clipboard.writeText(absoluteUrl);
            setError(null);
            window.alert("Share link copied to clipboard.");
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to share report.";
            setError(message);
        }
    };

    const commentReport = async (reportId: number) => {
        const body = window.prompt("Add a comment for collaborators:");
        if (!body || !body.trim()) return;
        try {
            const response = await apiFetch(`/reports/${reportId}/comments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body: body.trim() }),
            });
            if (!response.ok) throw new Error("Failed to save comment.");
            setError(null);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to add comment.";
            setError(message);
        }
    };

    const approveReport = async (reportId: number) => {
        try {
            const response = await apiFetch(`/reports/${reportId}/approval`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved", note: "Approved from reports page." }),
            });
            if (!response.ok) throw new Error("Failed to approve report.");
            setError(null);
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to approve report.";
            setError(message);
        }
    };

    return (
        <div className="flex h-full flex-col gap-5 animate-in fade-in zoom-in-95 duration-500">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="section-header">
                    <h1 className="section-title">Reports</h1>
                    <p className="section-subtitle">Generate downloadable analyst reports from your latest CSV.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => void loadReports()}
                        disabled={loadingReports}
                        className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                        <RefreshCw className={cn("h-4 w-4", loadingReports && "animate-spin")} />
                        Refresh
                    </button>
                    <select
                        value={indiaReportLanguage}
                        onChange={(e) => setIndiaReportLanguage(e.target.value as "english" | "hindi" | "hinglish")}
                        className="rounded-lg border border-border/70 bg-secondary/60 px-3 py-2 text-sm font-medium"
                    >
                        <option value="english">India Report: English</option>
                        <option value="hindi">India Report: Hindi</option>
                        <option value="hinglish">India Report: Hinglish</option>
                    </select>
                    <button
                        onClick={generateReport}
                        disabled={generating}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                        {generating ? "Generating..." : "Generate Report"}
                    </button>
                    <button
                        onClick={generateIndiaReport}
                        disabled={generating}
                        className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-60"
                    >
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                        {generating ? "Generating..." : "Generate India Trend"}
                    </button>
                </div>
            </div>
            {error && (
                <div className="panel-surface-tight border-destructive/40 bg-destructive/10 text-sm text-destructive">
                    {error}
                </div>
            )}

            <div className="panel-surface flex min-h-0 flex-1 flex-col overflow-hidden p-0">
                <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value as ReportTypeFilter)}
                        className="rounded-md border border-border/60 bg-secondary px-3 py-1.5 text-sm"
                    >
                        <option value="All">All Types</option>
                        <option value="Executive">Executive</option>
                        <option value="Analyst">Analyst</option>
                        <option value="India Trend">India Trend</option>
                    </select>
                    <button
                        onClick={() => setDateRange(dateRange === "30d" ? "all" : "30d")}
                        className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground"
                    >
                        <Calendar className="h-3.5 w-3.5" />
                        {dateRange === "all" ? "All Time" : "Last 30 Days"}
                    </button>
                    <div className="ml-auto text-xs text-muted-foreground">
                        {filteredReports.length} result{filteredReports.length === 1 ? "" : "s"}
                    </div>
                </div>

                <div className="min-h-0 overflow-auto">
                    {loadingReports ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            <div className="inline-flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading reports...
                            </div>
                        </div>
                    ) : filteredReports.length === 0 ? (
                        <div className="p-8 text-center text-sm text-muted-foreground">
                            No reports found for the selected filter.
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 z-10 bg-secondary/80 text-xs uppercase text-muted-foreground backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-3">Report Name</th>
                                    <th className="px-6 py-3">Type</th>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3 text-right">Size</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {filteredReports.map((report, index) => (
                                    <tr
                                        key={report.id}
                                        className={cn(
                                            "transition-colors hover:bg-muted/50",
                                            index % 2 === 0 ? "bg-background/20" : "bg-background/50"
                                        )}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                                                    <FileText className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-medium">{report.name}</p>
                                                    <p className="text-xs text-muted-foreground">Dataset #{report.dataset_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-muted-foreground">{report.type}</td>
                                        <td className="px-6 py-4 text-muted-foreground">
                                            {new Date(report.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-right text-muted-foreground">{report.size_kb}</td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={cn(
                                                    "status-badge",
                                                    report.status === "Ready" ? "status-badge--success" : "status-badge--error"
                                                )}
                                            >
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-1">
                                                <button
                                                    onClick={() => downloadReport(report)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                                                    title="Download Markdown"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => downloadReportPdf(report)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                                                    title="Download PDF"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => void shareReport(report.id)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                                                    title="Create Share Link"
                                                >
                                                    <Share2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => void commentReport(report.id)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                                                    title="Add Comment"
                                                >
                                                    <MessageSquare className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => void approveReport(report.id)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-emerald-600"
                                                    title="Approve Report"
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => void deleteReport(report.id)}
                                                    className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
