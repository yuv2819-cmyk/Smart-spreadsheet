"use client";

import { useState } from "react";
import { Send, Sparkles, User, Bot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export default function AIAssistant() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            role: "assistant",
            content: "Hello! I'm your data analyst. I see you're looking at Q1 Sales. Would you like me to forecast revenue for next month?",
        },
    ]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);

    const handleSend = () => {
        if (!input.trim()) return;

        const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsTyping(true);

        setTimeout(() => {
            const aiMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: "I've analyzed the trend. Based on the 12% growth in electronics, we can project a revenue increase of approximately $14,500 next month."
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsTyping(false);
        }, 1500);
    };

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">AI Analyst</h3>
                </div>
                <button className="text-muted-foreground hover:text-primary transition-colors">
                    <RefreshCw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <AnimatePresence initial={false}>
                    {messages.map((m) => (
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
                                "p-3 rounded-2xl text-sm max-w-[85%] leading-relaxed shadow-sm",
                                m.role === "user"
                                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                                    : "bg-card border border-border rounded-tl-sm"
                            )}>
                                {m.content}
                            </div>
                        </motion.div>
                    ))}
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

            {/* Input */}
            <div className="p-3 border-t border-border bg-card/30">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
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
