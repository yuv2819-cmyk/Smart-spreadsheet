import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: LucideIcon;
    color: "blue" | "emerald" | "violet" | "rose";
}

const colorMap = {
    blue: "from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400",
    emerald: "from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400",
    violet: "from-violet-500/20 to-fuchsia-500/20 text-violet-600 dark:text-violet-400",
    rose: "from-rose-500/20 to-pink-500/20 text-rose-600 dark:text-rose-400",
};

export default function StatCard({ title, value, trend, trendUp, icon: Icon, color }: StatCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -5 }}
            transition={{ duration: 0.3 }}
            className="bg-card/50 backdrop-blur-sm border border-border/50 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 group"
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">{value}</h3>
                </div>
                <div className={cn("p-2 rounded-lg bg-gradient-to-br", colorMap[color])}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="mt-3 flex items-center text-xs font-medium">
                <span className={cn(
                    "px-1.5 py-0.5 rounded-full mr-2",
                    trendUp
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}>
                    {trend}
                </span>
                <span className="text-muted-foreground">vs last month</span>
            </div>
        </motion.div>
    );
}
