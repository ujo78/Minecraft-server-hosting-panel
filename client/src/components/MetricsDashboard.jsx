import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Activity, Cpu, Database, Users } from 'lucide-react';
import { io } from "socket.io-client";

const socket = io();

export default function MetricsDashboard({ serverId }) {
    const [history, setHistory] = useState([]);
    const [current, setCurrent] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch initial history
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/servers/${serverId}/metrics/history`);
                const data = await res.json();

                // Transform data for recharts if needed, or assume it matches
                // Expected format: { timestamps: [], tps: [], cpu: [], ... }
                // Recharts needs array of objects: [{ time, tps, cpu }, ...]
                if (data.timestamps) {
                    const formatted = data.timestamps.map((ts, i) => ({
                        time: new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                        tps: data.tps[i],
                        cpu: data.cpu[i],
                        memory: data.memory[i].percent,
                        players: data.players[i]
                    }));
                    setHistory(formatted);
                }
                setLoading(false);
            } catch (err) {
                console.error("Failed to load metrics history", err);
                setLoading(false);
            }
        };

        fetchHistory();

        // Listen for live updates
        const handleMetrics = (metric) => {
            const timeStr = new Date(metric.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const point = {
                time: timeStr,
                tps: metric.tps,
                cpu: metric.cpu,
                memory: metric.memory.percent,
                players: metric.players
            };

            setCurrent(metric);

            setHistory(prev => {
                const newHistory = [...prev, point];
                if (newHistory.length > 50) newHistory.shift(); // Keep last 50 points window
                return newHistory;
            });
        };

        socket.on('metrics', handleMetrics);

        return () => {
            socket.off('metrics', handleMetrics);
        };
    }, [serverId]);

    if (loading) return <div className="text-center p-8 text-gray-400">Loading metrics...</div>;

    const MetricCard = ({ title, value, subtext, icon: Icon, color }) => (
        <div className="bg-dark-800 border border-dark-700 rounded-lg p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg bg-opacity-10 ${color.bg} ${color.text}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <h3 className="text-2xl font-bold text-white">{value}</h3>
                {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Cards Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    title="TPS"
                    value={current?.tps?.toFixed(2) || "20.00"}
                    icon={Activity}
                    color={{ bg: 'bg-green-500', text: 'text-green-500' }}
                />
                <MetricCard
                    title="CPU Usage"
                    value={`${current?.cpu || 0}%`}
                    icon={Cpu}
                    color={{ bg: 'bg-blue-500', text: 'text-blue-500' }}
                />
                <MetricCard
                    title="Memory"
                    value={`${current?.memory?.percent || 0}%`}
                    subtext={`${current?.memory?.used || 0} GB / ${current?.memory?.total || 0} GB`}
                    icon={Database}
                    color={{ bg: 'bg-purple-500', text: 'text-purple-500' }}
                />
                <MetricCard
                    title="Players"
                    value={current?.players || 0}
                    icon={Users}
                    color={{ bg: 'bg-yellow-500', text: 'text-yellow-500' }}
                />
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-4">Performance (CPU / RAM)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" stroke="#6B7280" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <YAxis stroke="#6B7280" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                                <Area type="monotone" dataKey="memory" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorMem)" name="Memory %" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                    <h3 className="text-white font-bold mb-4">TPS History</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <XAxis dataKey="time" stroke="#6B7280" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <YAxis domain={[0, 20]} stroke="#6B7280" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                                />
                                <Line type="monotone" dataKey="tps" stroke="#10B981" strokeWidth={2} dot={false} name="TPS" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
