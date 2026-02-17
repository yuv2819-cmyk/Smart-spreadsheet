"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, Sparkles, User, Bot, RefreshCw, Lightbulb, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/api-client";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface NLQChartSeries {
    key: string;
    label: string;
    color: string;
}

interface NLQChartPayload {
    chart_type: "composed";
    title: string;
    x_key: string;
    series: NLQChartSeries[];
    data: Array<Record<string, string | number | null>>;
}

interface NLQPayload {
    answer?: string;
    chart?: NLQChartPayload | null;
    explanation?: string[];
    target_period?: string | null;
    recommended_actions?: string[];
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    nlq?: NLQPayload | null;
}

const initialAssistantMessage: Message = {
    id: "1",
    role: "assistant",
    content: "Ask a question about your uploaded data and I will analyze it.",
};

export default function AIAssistant() {
    const [messages, setMessages] = useState<Message[]>([initialAssistantMessage]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

    const fetchLatestDatasetId = useCallback(async (): Promise<number | null> => {
        try {
            const latestRes = await apiFetch("/datasets/latest");
            if (!latestRes.ok) return null;
            const latest = await latestRes.json();
            return typeof latest.id === "number" ? latest.id : null;
        } catch {
            return null;
        }
    }, []);

    const fetchSuggestedQuestions = useCallback(async () => {
        const datasetId = await fetchLatestDatasetId();
        if (!datasetId) {
            setSuggestedQuestions([]);
            return;
        }
        try {
            const response = await apiFetch(`/ai/recommended-questions/${datasetId}`);
            if (!response.ok) {
                setSuggestedQuestions([]);
                return;
            }
            const data = await response.json();
            if (Array.isArray(data?.questions)) {
                setSuggestedQuestions(data.questions.slice(0, 4));
            } else {
                setSuggestedQuestions([]);
            }
        } catch {
            setSuggestedQuestions([]);
        }
    }, [fetchLatestDatasetId]);

    useEffect(() => {
        fetchSuggestedQuestions();
    }, [fetchSuggestedQuestions]);

    const handleSend = async (overridePrompt?: string) => {
        if (isTyping) return;

        const prompt = (overridePrompt ?? input).trim();
        if (!prompt) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: prompt };
        setMessages((prev) => [...prev, userMsg]);
        if (!overridePrompt) setInput("");
        setIsTyping(true);

        try {
            const datasetId = await fetchLatestDatasetId();
            if (!datasetId) {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: (Date.now() + 1).toString(),
                        role: "assistant",
                        content: "No dataset found. Upload a CSV file first.",
                    },
                ]);
                return;
            }

            const response = await apiFetch("/ai/query", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dataset_id: datasetId, prompt }),
            });

            if (!response.ok) {
                let detail = "AI query failed.";
                try {
                    const errorData = await response.json();
                    detail = errorData.detail || detail;
                } catch {
                    // keep default message
                }
                throw new Error(detail);
            }

            const data = await response.json();
            const generatedText = (data.generated_code || "").trim();
            const fallbackText = data?.result_data?.generated === false ? data?.result_data?.message : "";
            const nlqPayload: NLQPayload | null = data?.result_data?.nlq ?? null;
            const assistantText = (nlqPayload?.answer || generatedText || fallbackText || "I could not generate an answer for this question.").trim();

            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: assistantText,
                nlq: nlqPayload,
            };
            setMessages((prev) => [...prev, aiMsg]);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to contact AI service.";
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: `Request failed: ${message}`,
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleResetConversation = () => {
        if (isTyping) return;
        setMessages([initialAssistantMessage]);
        setInput("");
    };

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">AI Analyst</h3>
                </div>
                <button
                    onClick={handleResetConversation}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Reset conversation"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {suggestedQuestions.length > 0 && messages.length <= 1 && (
                    <div className="flex flex-wrap gap-2">
                        {suggestedQuestions.map((question) => (
                            <button
                                key={question}
                                onClick={() => handleSend(question)}
                                disabled={isTyping}
                                className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-secondary/60 hover:bg-secondary transition-colors text-left"
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((m) => {
                        const chartPayload = m.nlq?.chart;
                        const chartData = chartPayload?.data || [];
                        const chartSeries = chartPayload?.series || [];
                        const hasChart = !!chartPayload && chartData.length > 1 && chartSeries.length > 0;
                        const hasExplanation = !!m.nlq?.explanation?.length;
                        const hasActions = !!m.nlq?.recommended_actions?.length;

                        return (
                            <motion.div
                                key={m.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                className={cn("flex gap-3", m.role === "user" ? "flex-row-reverse" : "flex-row")}
                            >
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border",
                                    m.role === "user" ? "bg-secondary border-border" : "bg-primary/10 border-primary/20"
                                )}>
                                    {m.role === "user" ? <User className="w-4 h-4 text-muted-foreground" /> : <Bot className="w-4 h-4 text-primary" />}
                                </div>
                                <div className={cn(
                                    "p-3 rounded-2xl text-sm max-w-[92%] leading-relaxed shadow-sm",
                                    m.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-card border border-border rounded-tl-sm"
                                )}>
                                    <p className="whitespace-pre-wrap">{m.content}</p>

                                    {hasChart && (
                                        <div className="mt-3 rounded-lg border border-border/60 bg-secondary/40 p-3">
                                            <p className="text-xs font-semibold mb-2 text-foreground">
                                                {chartPayload.title}
                                            </p>
                                            <div className="h-44 w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={chartData}>
                                                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                                        <XAxis
                                                            dataKey={chartPayload.x_key}
                                                            tick={{ fontSize: 11, fill: "#888" }}
                                                            tickLine={false}
                                                            axisLine={false}
                                                        />
                                                        <YAxis tick={{ fontSize: 11, fill: "#888" }} tickLine={false} axisLine={false} />
                                                        <Tooltip />
                                                        <Legend />
                                                        {chartSeries
                                                            .filter((series) => series.key !== "profit")
                                                            .map((series) => (
                                                                <Bar
                                                                    key={series.key}
                                                                    dataKey={series.key}
                                                                    name={series.label}
                                                                    fill={series.color}
                                                                    radius={[3, 3, 0, 0]}
                                                                />
                                                            ))}
                                                        {chartSeries
                                                            .filter((series) => series.key === "profit")
                                                            .map((series) => (
                                                                <Line
                                                                    key={series.key}
                                                                    type="monotone"
                                                                    dataKey={series.key}
                                                                    name={series.label}
                                                                    stroke={series.color}
                                                                    strokeWidth={2.2}
                                                                    dot={false}
                                                                    activeDot={{ r: 5 }}
                                                                />
                                                            ))}
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    )}

                                    {hasExplanation && (
                                        <div className="mt-3 rounded-lg border border-border/50 bg-background/40 p-3">
                                            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-foreground">
                                                <TrendingDown className="w-3.5 h-3.5" />
                                                Explanation
                                            </div>
                                            <div className="space-y-1.5">
                                                {m.nlq?.explanation?.slice(0, 4).map((line, idx) => (
                                                    <p key={`${line}-${idx}`} className="text-xs text-muted-foreground">
                                                        - {line}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {hasActions && (
                                        <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                            <div className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-primary">
                                                <Lightbulb className="w-3.5 h-3.5" />
                                                Recommended Actions
                                            </div>
                                            <div className="space-y-1.5">
                                                {m.nlq?.recommended_actions?.slice(0, 3).map((line, idx) => (
                                                    <p key={`${line}-${idx}`} className="text-xs text-muted-foreground">
                                                        - {line}
                                                    </p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
                {isTyping && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex gap-3"
                    >
                        <div className="w-8 h-8 rounded-full bg-primary/10 border-primary/20 flex items-center justify-center shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                        </div>
                        <div className="bg-card border border-border rounded-2xl rounded-tl-sm p-3 shadow-sm flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </motion.div>
                )}
            </div>

            <div className="p-3 border-t border-border bg-card/30">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="relative"
                >
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask AI about your data..."
                        className="w-full bg-secondary/50 border border-transparent focus:border-border hover:bg-secondary focus:bg-background rounded-lg pl-4 pr-10 py-2.5 text-sm outline-none transition-all placeholder:text-muted-foreground/60 shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="absolute right-2 top-2 p-1 text-primary hover:bg-primary/10 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </form>
            </div>
        </div>
    );
}
