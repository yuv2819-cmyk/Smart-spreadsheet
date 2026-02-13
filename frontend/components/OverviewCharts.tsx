"use client";

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line,
    Legend
} from "recharts";

type ChartDataPoint = Record<string, string | number | null>;

interface ChartComponentProps {
    data: ChartDataPoint[];
    numericColumns: string[];
}

export default function OverviewCharts({ data, numericColumns }: ChartComponentProps) {
    if (!data || data.length === 0 || numericColumns.length === 0) {
        return (
            <div className="p-6 border rounded-xl bg-card/50 text-center text-muted-foreground text-sm">
                No data available for visualization.
            </div>
        );
    }

    // Colors for bars/lines
    const colors = ["#3b82f6", "#10b981", "#f43f5e", "#8b5cf6"];

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
            {/* Bar Chart */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-6">Data Distribution (First 10 Rows)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#888' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#888' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            />
                            <Legend />
                            {numericColumns.slice(0, 2).map((col, index) => (
                                <Bar
                                    key={col}
                                    dataKey={col}
                                    fill={colors[index % colors.length]}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={50}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Line Chart (Trends) */}
            <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-6 shadow-sm">
                <h3 className="font-semibold mb-6">Trends Overview</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis
                                dataKey="name"
                                tick={{ fontSize: 12, fill: '#888' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#888' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            {numericColumns.map((col, index) => (
                                <Line
                                    key={col}
                                    type="monotone"
                                    dataKey={col}
                                    stroke={colors[index % colors.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
