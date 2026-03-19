import React, { useState, useEffect } from 'react';
import { UserPlus, UserMinus, Shield, AlertCircle } from 'lucide-react';

export default function WhitelistManager({ serverId }) {
    const [whitelist, setWhitelist] = useState([]);
    const [enabled, setEnabled] = useState(false);
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (serverId) {
            fetchWhitelist();
        }
    }, [serverId]);

    const fetchWhitelist = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/servers/${serverId}/whitelist`);
            const data = await res.json();
            setWhitelist(data.whitelist || []);
            setEnabled(data.enabled || false);
        } catch (err) {
            setError('Failed to load whitelist');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        try {
            setAdding(true);
            setError(null);
            const res = await fetch(`/api/servers/${serverId}/whitelist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim() })
            });

            const data = await res.json();
            if (data.success) {
                setUsername('');
                await fetchWhitelist();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to add player');
        } finally {
            setAdding(false);
        }
    };

    const handleRemove = async (name) => {
        try {
            const res = await fetch(`/api/servers/${serverId}/whitelist/${name}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                await fetchWhitelist();
            }
        } catch (err) {
            alert('Failed to remove player');
        }
    };

    const handleToggle = async () => {
        try {
            const res = await fetch(`/api/servers/${serverId}/whitelist/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !enabled })
            });

            const data = await res.json();
            if (data.success) {
                setEnabled(data.enabled);
            }
        } catch (err) {
            alert('Failed to toggle whitelist');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2 font-['VT323'] uppercase">
                    <Shield className="w-5 h-5 text-[#00f0ff]" />
                    Whitelist
                </h2>
                <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={handleToggle}
                        className="w-5 h-5 rounded bg-black/50 border-[#00f0ff]/30 text-[#00f0ff] focus:ring-[#00f0ff] focus:ring-offset-0"
                    />
                    <span className="text-white font-medium uppercase text-sm tracking-wider group-hover:text-[#00f0ff] transition-colors">Enabled</span>
                </label>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username..."
                    className="flex-1 bg-black/50 border border-[#00f0ff]/30 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    disabled={adding}
                />
                <button
                    type="submit"
                    disabled={adding || !username.trim()}
                    className="minecraft-btn minecraft-btn-primary disabled:opacity-50"
                >
                    <UserPlus className="w-4 h-4" />
                    {adding ? 'Adding...' : 'Add'}
                </button>
            </form>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 text-sm">{error}</span>
                </div>
            )}

            <div className="sci-fi-panel p-4">
                <div className="corner-accent corner-accent-tl" style={{width: '12px', height: '12px'}}></div>
                <h3 className="text-white font-bold mb-3 font-['VT323'] text-xl">Whitelisted Players ({whitelist.length})</h3>
                {loading ? (
                    <div className="text-center py-4 text-[#00f0ff]">Loading...</div>
                ) : whitelist.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">No players whitelisted</div>
                ) : (
                    <div className="space-y-2">
                        {whitelist.map(player => (
                            <div
                                key={player.uuid}
                                className="flex items-center justify-between bg-black/40 rounded-lg p-3 border border-[#00f0ff]/10"
                            >
                                <span className="text-white font-mono">{player.name}</span>
                                <button
                                    onClick={() => handleRemove(player.name)}
                                    className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition-colors"
                                    title="Remove player"
                                >
                                    <UserMinus className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
