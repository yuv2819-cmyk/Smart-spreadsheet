"use client";

import {
    Home,
    Table2,
    BarChart3,
    Settings,
    Layers,
    ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { icon: Home, label: "Overview", href: "/overview" },
    { icon: Table2, label: "Spreadsheets", href: "/" },
    { icon: BarChart3, label: "Reports", href: "/reports" },
    { icon: Layers, label: "Integrations", href: "/integrations" },
    { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    return (
        <aside
            className={cn(
                "flex flex-col h-screen border-r border-border bg-card/50 backdrop-blur-xl transition-all duration-300 relative z-20",
                collapsed ? "w-16" : "w-64"
            )}
        >
            {/* Brand */}
            <div className="h-14 flex items-center px-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                        <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    {!collapsed && (
                        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            SmartSheet
                        </span>
                    )}
                </div>
            </div>

            {/* Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="absolute -right-3 top-16 bg-card border border-border p-1 rounded-full shadow-sm hover:bg-secondary transition-colors"
            >
                <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
            </button>

            {/* Navigation */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.label}
                            href={item.href}
                            className={cn(
                                "relative w-full sidebar-link group overflow-hidden block",
                                isActive && "active",
                                collapsed && "justify-center px-2"
                            )}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute inset-0 bg-secondary rounded-md"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-3 p-2">
                                <item.icon className={cn("w-4 h-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                                {!collapsed && <span>{item.label}</span>}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-3 border-t border-border/50">
                <button className={cn(
                    "flex items-center gap-3 w-full p-2 rounded-lg hover:bg-secondary/50 transition-colors",
                    collapsed && "justify-center"
                )}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
                        JD
                    </div>
                    {!collapsed && (
                        <div className="text-left overflow-hidden">
                            <p className="text-sm font-medium truncate">John Doe</p>
                            <p className="text-xs text-muted-foreground truncate">john@example.com</p>
                        </div>
                    )}
                </button>
            </div>
        </aside>
    );
}
