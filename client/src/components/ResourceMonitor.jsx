import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { HardDrive, Server } from 'lucide-react';

export default function ResourceMonitor({ serverId }) {
    const [usage, setUsage] = useState(null);
    const [breakdown, setBreakdown] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (serverId) {
            fetchResources();
        }
    }, [serverId]);

    const fetchResources = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/resources`);
            const data = await res.json();
            if (data.diskUsage) setUsage(data.diskUsage);
            if (data.breakdown) setBreakdown(data.breakdown);
        } catch (err) {
            console.error("Failed to load resources", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="text-gray-400 text-center p-8">Loading resource usage...</div>;

    const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280'];

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const pieData = breakdown ? [
        { name: 'World Data', value: breakdown.world },
        { name: 'Mods', value: breakdown.mods },
        { name: 'Plugins', value: breakdown.plugins },
        { name: 'Backups', value: breakdown.backups },
        { name: 'Logs', value: breakdown.logs },
        { name: 'Other', value: breakdown.other },
    ].filter(item => item.value > 0) : [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Disk Usage Overview */}
                <div className="bg-dark-800 p-6 rounded-lg border border-dark-700">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <HardDrive className="w-5 h-5 text-mc-green" /> Disk Usage
                    </h3>

                    {usage && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <span className="text-3xl font-bold text-white">{formatBytes(usage.used)}</span>
                                <span className="text-gray-400">of {formatBytes(usage.total)}</span>
                            </div>

                            <div className="w-full bg-dark-700 h-4 rounded-full overflow-hidden">
                                <div
                                    className="bg-mc-green h-full transition-all duration-500"
                                    style={{ width: `${usage.percent}%` }}
                                />
                            </div>
                            <div className="text-right text-sm text-mc-green font-bold">{usage.percent}% Used</div>
                        </div>
                    )}
                </div>

                {/* Server Directory Size */}
                <div className="bg-dark-800 p-6 rounded-lg border border-dark-700">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <Server className="w-5 h-5 text-blue-500" /> Server Folder
                    </h3>
                    {usage && (
                        <div className="text-center py-4">
                            <span className="text-4xl font-bold text-white block mb-2">{formatBytes(usage.serverSize)}</span>
                            <span className="text-gray-400 text-sm">Total Server Size</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Breakdown Chart */}
            <div className="bg-dark-800 p-6 rounded-lg border border-dark-700">
                <h3 className="text-white font-bold mb-6">Storage Breakdown</h3>

                <div className="h-80 w-full flex flex-col md:flex-row items-center">
                    <div className="w-full md:w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value) => formatBytes(value)}
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', color: '#fff' }}
                                />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="w-full md:w-1/2 space-y-4 mt-4 md:mt-0">
                        {pieData.map((item, index) => (
                            <div key={item.name} className="flex justify-between items-center p-3 bg-dark-900 rounded border border-dark-600">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                    <span className="text-gray-300">{item.name}</span>
                                </div>
                                <span className="text-white font-bold">{formatBytes(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
