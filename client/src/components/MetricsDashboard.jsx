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

    if (loading) return (
        <div className="text-center p-8 text-[#00f0ff]">
            <div className="animate-spin w-8 h-8 border-2 border-[#00f0ff] border-t-transparent rounded-full mx-auto mb-4"></div>
            Loading metrics...
        </div>
    );

    const MetricCard = ({ title, value, subtext, icon: Icon, color }) => (
        <div className="sci-fi-panel p-4 flex items-center gap-4 relative overflow-hidden">
            <div className="corner-accent corner-accent-tl" style={{width: '12px', height: '12px'}}></div>
            <div className="corner-accent corner-accent-br corner-accent-purple" style={{width: '12px', height: '12px'}}></div>
            <div className={`p-3 rounded-lg bg-opacity-20 ${color.bg} ${color.text} border border-current border-opacity-30`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-gray-400 text-xs uppercase tracking-wider">{title}</p>
                <h3 className="text-2xl font-bold text-white font-['VT323']">{value}</h3>
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
                    color={{ bg: 'bg-[#00f0ff]', text: 'text-[#00f0ff]' }}
                />
                <MetricCard
                    title="CPU Usage"
                    value={`${current?.cpu || 0}%`}
                    icon={Cpu}
                    color={{ bg: 'bg-[#b829dd]', text: 'text-[#b829dd]' }}
                />
                <MetricCard
                    title="Memory"
                    value={`${current?.memory?.percent || 0}%`}
                    subtext={`${current?.memory?.used || 0} GB / ${current?.memory?.total || 0} GB`}
                    icon={Database}
                    color={{ bg: 'bg-[#fbbf24]', text: 'text-[#fbbf24]' }}
                />
                <MetricCard
                    title="Players"
                    value={current?.players || 0}
                    icon={Users}
                    color={{ bg: 'bg-[#52eb34]', text: 'text-[#52eb34]' }}
                />
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="sci-fi-panel p-4 relative">
                    <div className="corner-accent corner-accent-tl"></div>
                    <div className="corner-accent corner-accent-tr corner-accent-purple"></div>
                    <h3 className="text-[#00f0ff] font-['VT323'] text-xl mb-4 uppercase tracking-wide">Performance (CPU / RAM)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={history}>
                                <defs>
                                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#b829dd" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#b829dd" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" stroke="#374151" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <YAxis stroke="#374151" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid rgba(0, 240, 255, 0.3)', color: '#fff', borderRadius: '8px' }}
                                />
                                <Area type="monotone" dataKey="cpu" stroke="#b829dd" strokeWidth={2} fillOpacity={1} fill="url(#colorCpu)" name="CPU %" />
                                <Area type="monotone" dataKey="memory" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#colorMem)" name="Memory %" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="sci-fi-panel p-4 relative">
                    <div className="corner-accent corner-accent-tl"></div>
                    <div className="corner-accent corner-accent-tr corner-accent-purple"></div>
                    <h3 className="text-[#b829dd] font-['VT323'] text-xl mb-4 uppercase tracking-wide">TPS History</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <XAxis dataKey="time" stroke="#374151" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <YAxis domain={[0, 20]} stroke="#374151" fontSize={12} tick={{ fill: '#6B7280' }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0a0a0f', border: '1px solid rgba(184, 41, 221, 0.3)', color: '#fff', borderRadius: '8px' }}
                                />
                                <Line type="monotone" dataKey="tps" stroke="#00f0ff" strokeWidth={2} dot={false} name="TPS" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
