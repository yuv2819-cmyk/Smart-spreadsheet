"use client";

import { FileText, Download, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const reports = [
    { id: 1, name: "Q1 Financial Summary", type: "Financial", date: "Mar 31, 2024", size: "1.2 MB", status: "Ready" },
    { id: 2, name: "User Growth Analysis", type: "Analytics", date: "Mar 15, 2024", size: "845 KB", status: "Ready" },
    { id: 3, name: "Inventory Status", type: "Operations", date: "Mar 01, 2024", size: "2.4 MB", status: "Ready" },
    { id: 4, name: "Sales Performance", type: "Sales", date: "Feb 28, 2024", size: "1.8 MB", status: "Processing" },
];

export default function ReportsPage() {
    return (
        <div className="flex flex-col gap-6 h-full animate-in fade-in zoom-in-95 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                    <p className="text-muted-foreground">Generate and view your business reports.</p>
                </div>
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Generate Report
                </button>
            </div>

            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm flex-1 min-h-0">
                <div className="p-4 border-b border-border/50 flex gap-2">
                    <button className="px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-md flex items-center gap-2">
                        <Filter className="w-3.5 h-3.5" />
                        Filter
                    </button>
                    <button className="px-3 py-1.5 text-sm font-medium bg-secondary text-secondary-foreground rounded-md flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        Last 30 Days
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                            <tr>
                                <th className="px-6 py-3">Report Name</th>
                                <th className="px-6 py-3">Type</th>
                                <th className="px-6 py-3">Date</th>
                                <th className="px-6 py-3">Size</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {reports.map((report) => (
                                <tr key={report.id} className="hover:bg-muted/50 transition-colors group">
                                    <td className="px-6 py-4 font-medium flex items-center gap-3">
                                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        {report.name}
                                    </td>
                                    <td className="px-6 py-4 text-muted-foreground">{report.type}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{report.date}</td>
                                    <td className="px-6 py-4 text-muted-foreground">{report.size}</td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "px-2 py-1 rounded-full text-xs font-medium",
                                            report.status === "Ready"
                                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                        )}>
                                            {report.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-muted-foreground hover:text-primary transition-colors p-2 hover:bg-secondary rounded-md" title="Download">
                                            <Download className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
