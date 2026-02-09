"use client";

import { useState, useMemo, useEffect } from "react";
import { DataGrid, type Column } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import { cn } from "@/lib/utils";
import {
    Plus,
    Filter,
    Download,
    MoreHorizontal,
    Loader2
} from "lucide-react";

interface Row {
    id: number;
    [key: string]: string | number | null;
}

export default function Spreadsheet() {
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState<Column<Row>[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Get latest dataset ID
                let datasetId = 1; // Default fallback
                try {
                    const latestRes = await fetch("http://127.0.0.1:8000/datasets/latest");
                    if (latestRes.ok) {
                        const latest = await latestRes.json();
                        datasetId = latest.id;
                    }
                } catch (e) {
                    console.warn("Could not fetch latest dataset ID, using default 1");
                }

                // 2. Fetch Data
                const response = await fetch(`http://127.0.0.1:8000/datasets/${datasetId}/data`);

                if (response.ok) {
                    const data = await response.json();
                    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                        // 1. Generate Columns dynamically from the first row
                        const firstRow = data.data[0];
                        const dynamicCols: Column<Row>[] = [
                            {
                                key: "id",
                                name: "#",
                                width: 50,
                                frozen: true,
                                renderCell: ({ row }) => <div className="text-center text-muted-foreground">{row.id + 1}</div>
                            }
                        ];

                        // Get all keys except 'id' (and exclude internal keys if any)
                        const keys = Object.keys(firstRow).filter(k => k !== "id");

                        keys.forEach(key => {
                            // Simple heuristic for width or formatting could go here
                            dynamicCols.push({
                                key: key,
                                name: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "), // Capitalize
                                resizable: true,
                                minWidth: 100,
                                renderCell: ({ row }) => {
                                    const val = row[key];
                                    if (val === null || val === undefined) return <span className="text-muted-foreground italic">Empty</span>;
                                    // Basic formatting for numbers
                                    if (typeof val === 'number') {
                                        return <span>{val.toLocaleString()}</span>;
                                    }
                                    return <span title={String(val)}>{String(val)}</span>;
                                }
                            });
                        });

                        setColumns(dynamicCols);

                        // 2. Map rows
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const mappedRows = data.data.map((r: any, index: number) => ({
                            id: index, // Ensure ID is controlled by frontend index for grid stability
                            ...r
                        }));
                        setRows(mappedRows);
                    } else {
                        // Handle empty data
                        setColumns([{ key: "info", name: "Info", width: 200 }]);
                        setRows([]);
                    }
                } else {
                    console.error("Failed to fetch data:", response.statusText);
                    // If 404/Not Found (because no data exists), standard empty state
                    setColumns([{ key: "info", name: "Info", width: 200 }]);
                    setRows([]);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
                setColumns([{ key: "error", name: "Error", width: 200 }]);
                setRows([]);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const rowKeyGetter = (row: Row) => row.id;

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl overflow-hidden shadow-sm">
            {/* Toolbar */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg tracking-tight">Spreadsheet Data</h3>
                    <span className="px-2 py-0.5 rounded-md bg-secondary text-xs text-muted-foreground font-medium">Synced</span>
                </div>
                <div className="flex items-center gap-2">
                    <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-md transition-colors">
                        <Filter className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-md transition-colors">
                        <Download className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 text-muted-foreground hover:bg-secondary rounded-md transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {/* Add Row hidden for MVP dynamic mode */}
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-hidden"
                style={{
                    "--rdg-background-color": "transparent",
                    "--rdg-header-background-color": "var(--secondary)",
                    "--rdg-row-hover-background-color": "var(--secondary)",
                    "--rdg-font-size": "13px",
                    "--rdg-border-color": "hsl(var(--border))",
                    "--rdg-color": "hsl(var(--foreground))"
                } as React.CSSProperties}>
                {rows.length > 0 ? (
                    <DataGrid
                        columns={columns}
                        rows={rows}
                        rowKeyGetter={rowKeyGetter}
                        className="rdg-light h-full border-0"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No data available
                    </div>
                )}
            </div>
        </div>
    );
}
