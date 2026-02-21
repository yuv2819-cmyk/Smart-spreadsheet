"use client";

import { useEffect, useMemo, useState } from "react";
import { Eraser, Eye, History, Loader2, RotateCcw, Sparkles, Wrench } from "lucide-react";

import { apiFetch } from "@/lib/api-client";

interface CleaningRuleSuggestion {
    id: string;
    label: string;
    description: string;
    rule_type: string;
    column: string | null;
    confidence: number;
    severity: string;
    affected_rows: number;
}

interface CleaningProfileResponse {
    dataset_id: number;
    row_count: number;
    column_count: number;
    duplicate_rows: number;
    total_missing_cells: number;
    missing_pct: number;
    suggestions: CleaningRuleSuggestion[];
}

interface CleaningRuleImpact {
    rule_id: string;
    changed_cells: number;
    rows_removed: number;
    note?: string | null;
}

interface CleaningPreviewResponse {
    dataset_id: number;
    selected_rule_ids: string[];
    rows_before: number;
    rows_after: number;
    total_cells_changed: number;
    total_rows_removed: number;
    rule_impacts: CleaningRuleImpact[];
    sample_diffs: Array<Record<string, unknown>>;
}

interface CleaningTransformationResponse {
    id: number;
    source_dataset_id: number;
    output_dataset_id: number;
    rule_ids: string[];
    summary: Record<string, unknown>;
    created_at: string;
}

interface DataCleaningPanelProps {
    datasetId: number | undefined;
    onApplied: () => void;
}

function formatConfidence(value: number): string {
    return `${Math.round(value * 100)}%`;
}

function pickDefaultRuleIds(suggestions: CleaningRuleSuggestion[]): string[] {
    const highConfidence = suggestions.filter((rule) => rule.confidence >= 0.6).map((rule) => rule.id);
    if (highConfidence.length > 0) return highConfidence;
    return suggestions.map((rule) => rule.id);
}

export default function DataCleaningPanel({ datasetId, onApplied }: DataCleaningPanelProps) {
    const [profile, setProfile] = useState<CleaningProfileResponse | null>(null);
    const [history, setHistory] = useState<CleaningTransformationResponse[]>([]);
    const [selectedRuleIds, setSelectedRuleIds] = useState<string[]>([]);
    const [preview, setPreview] = useState<CleaningPreviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewing, setPreviewing] = useState(false);
    const [applying, setApplying] = useState(false);
    const [rollingBackId, setRollingBackId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const hasSuggestions = (profile?.suggestions.length || 0) > 0;
    const selectedCount = selectedRuleIds.length;

    const selectedRules = useMemo(() => {
        if (!profile) return [];
        const ids = new Set(selectedRuleIds);
        return profile.suggestions.filter((rule) => ids.has(rule.id));
    }, [profile, selectedRuleIds]);

    const refreshData = async () => {
        if (!datasetId) {
            setProfile(null);
            setHistory([]);
            setSelectedRuleIds([]);
            setPreview(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const [profileRes, historyRes] = await Promise.all([
                apiFetch(`/cleaning/profile/${datasetId}`),
                apiFetch(`/cleaning/history?dataset_id=${datasetId}`),
            ]);

            if (!profileRes.ok) {
                throw new Error("Failed to load cleaning profile.");
            }
            const profilePayload = await profileRes.json();
            setProfile(profilePayload);
            setSelectedRuleIds(pickDefaultRuleIds(profilePayload.suggestions || []));

            if (historyRes.ok) {
                const historyPayload = await historyRes.json();
                if (Array.isArray(historyPayload)) {
                    setHistory(historyPayload);
                } else {
                    setHistory([]);
                }
            } else {
                setHistory([]);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load data cleaning insights.");
            setProfile(null);
            setHistory([]);
            setSelectedRuleIds([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPreview(null);
        setMessage(null);
        refreshData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datasetId]);

    const toggleRule = (ruleId: string) => {
        setSelectedRuleIds((prev) =>
            prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
        );
    };

    const handlePreview = async () => {
        if (!datasetId || selectedRuleIds.length === 0) return;
        setPreviewing(true);
        setError(null);
        setMessage(null);
        try {
            const response = await apiFetch("/cleaning/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataset_id: datasetId,
                    rule_ids: selectedRuleIds,
                }),
            });
            if (!response.ok) {
                let detail = "Failed to preview cleaning rules.";
                try {
                    const body = await response.json();
                    detail = body.detail || detail;
                } catch {
                    // Ignore JSON parsing errors.
                }
                throw new Error(detail);
            }
            const payload = await response.json();
            setPreview(payload);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to preview cleaning.");
            setPreview(null);
        } finally {
            setPreviewing(false);
        }
    };

    const handleApply = async () => {
        if (!datasetId || selectedRuleIds.length === 0) return;
        setApplying(true);
        setError(null);
        setMessage(null);
        try {
            const response = await apiFetch("/cleaning/apply", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    dataset_id: datasetId,
                    rule_ids: selectedRuleIds,
                }),
            });
            if (!response.ok) {
                let detail = "Failed to apply cleaning rules.";
                try {
                    const body = await response.json();
                    detail = body.detail || detail;
                } catch {
                    // Ignore JSON parsing errors.
                }
                throw new Error(detail);
            }

            const payload = await response.json();
            setMessage(payload.message || "Cleaning completed successfully.");
            setPreview(null);
            onApplied();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to apply cleaning.");
        } finally {
            setApplying(false);
        }
    };

    const handleRollback = async (transformationId: number) => {
        setRollingBackId(transformationId);
        setError(null);
        setMessage(null);
        try {
            const response = await apiFetch(`/cleaning/rollback/${transformationId}`, {
                method: "POST",
            });
            if (!response.ok) {
                let detail = "Failed to rollback transformation.";
                try {
                    const body = await response.json();
                    detail = body.detail || detail;
                } catch {
                    // Ignore JSON parsing errors.
                }
                throw new Error(detail);
            }
            const payload = await response.json();
            setMessage(payload.message || "Rollback completed.");
            onApplied();
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to rollback cleaning.");
        } finally {
            setRollingBackId(null);
        }
    };

    if (!datasetId) return null;

    return (
        <section className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-primary" />
                        Data Clean Engine
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Profile messy data, preview fixes, then apply versioned cleaning rules.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={handlePreview}
                        disabled={previewing || applying || selectedRuleIds.length === 0 || loading}
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                        Preview
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={applying || previewing || selectedRuleIds.length === 0 || loading}
                        className="px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Apply Cleaning
                    </button>
                    <button
                        onClick={() => refreshData()}
                        disabled={loading || applying || previewing}
                        className="px-3 py-2 rounded-lg text-sm font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}
            {message && (
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                    {message}
                </div>
            )}

            {loading ? (
                <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading cleaning profile...
                </div>
            ) : profile ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">Rows</p>
                            <p className="text-base font-semibold">{profile.row_count.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">Columns</p>
                            <p className="text-base font-semibold">{profile.column_count.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">Duplicate Rows</p>
                            <p className="text-base font-semibold">{profile.duplicate_rows.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-border/60 bg-background/40 p-3">
                            <p className="text-xs text-muted-foreground">Missing Cells</p>
                            <p className="text-base font-semibold">
                                {profile.total_missing_cells.toLocaleString()} ({profile.missing_pct}%)
                            </p>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <h4 className="font-medium">Suggested Cleaning Rules</h4>
                            <p className="text-xs text-muted-foreground">
                                Selected {selectedCount} of {profile.suggestions.length}
                            </p>
                        </div>
                        <div className="mt-2 space-y-2">
                            {!hasSuggestions ? (
                                <p className="text-sm text-muted-foreground">
                                    No major cleaning issues detected for this dataset.
                                </p>
                            ) : (
                                profile.suggestions.map((rule) => (
                                    <label
                                        key={rule.id}
                                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 p-3 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedRuleIds.includes(rule.id)}
                                            onChange={() => toggleRule(rule.id)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium">{rule.label}</p>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase">
                                                    {rule.severity}
                                                </span>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                    confidence {formatConfidence(rule.confidence)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Affected rows: {rule.affected_rows.toLocaleString()}
                                            </p>
                                        </div>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>

                    {preview && (
                        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                            <h4 className="font-medium mb-2">Preview Impact</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                <div className="rounded-md border border-border/50 bg-background/50 p-2">
                                    <p className="text-xs text-muted-foreground">Rows Before</p>
                                    <p className="text-sm font-semibold">{preview.rows_before.toLocaleString()}</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-background/50 p-2">
                                    <p className="text-xs text-muted-foreground">Rows After</p>
                                    <p className="text-sm font-semibold">{preview.rows_after.toLocaleString()}</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-background/50 p-2">
                                    <p className="text-xs text-muted-foreground">Cells Changed</p>
                                    <p className="text-sm font-semibold">{preview.total_cells_changed.toLocaleString()}</p>
                                </div>
                                <div className="rounded-md border border-border/50 bg-background/50 p-2">
                                    <p className="text-xs text-muted-foreground">Rows Removed</p>
                                    <p className="text-sm font-semibold">{preview.total_rows_removed.toLocaleString()}</p>
                                </div>
                            </div>

                            {preview.rule_impacts.length > 0 && (
                                <div className="space-y-1">
                                    {preview.rule_impacts.map((impact) => (
                                        <p key={impact.rule_id} className="text-xs text-muted-foreground">
                                            - {impact.rule_id}: {impact.changed_cells} cells changed, {impact.rows_removed} rows removed
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {history.length > 0 && (
                        <div>
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                                <History className="w-4 h-4 text-primary" />
                                Cleaning History
                            </h4>
                            <div className="space-y-2">
                                {history.slice(0, 5).map((item) => (
                                    <div
                                        key={item.id}
                                        className="rounded-lg border border-border/60 bg-background/40 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"
                                    >
                                        <div>
                                            <p className="text-sm font-medium">Run #{item.id}</p>
                                            <p className="text-xs text-muted-foreground">
                                                Source #{item.source_dataset_id} {"->"} Output #{item.output_dataset_id} | {new Date(item.created_at).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Rules: {item.rule_ids.join(", ")}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleRollback(item.id)}
                                            disabled={rollingBackId === item.id}
                                            className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-secondary/60 hover:bg-secondary transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                                        >
                                            {rollingBackId === item.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <RotateCcw className="w-3.5 h-3.5" />
                                            )}
                                            Rollback
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <p className="text-sm text-muted-foreground">No dataset available for cleaning.</p>
            )}

            {selectedRules.length > 0 && (
                <p className="text-xs text-muted-foreground">
                    Selected rules: {selectedRules.map((rule) => rule.label).join(" | ")}
                </p>
            )}
        </section>
    );
}
