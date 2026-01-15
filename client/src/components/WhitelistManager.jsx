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
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-mc-green" />
                    Whitelist
                </h2>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={enabled}
                        onChange={handleToggle}
                        className="w-5 h-5 rounded bg-dark-900 border-dark-600 text-mc-green focus:ring-mc-green"
                    />
                    <span className="text-white font-medium">Enabled</span>
                </label>
            </div>

            <form onSubmit={handleAdd} className="flex gap-2">
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username..."
                    className="flex-1 bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                    disabled={adding}
                />
                <button
                    type="submit"
                    disabled={adding || !username.trim()}
                    className="bg-mc-green text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-500 disabled:opacity-50"
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

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                <h3 className="text-white font-bold mb-3">Whitelisted Players ({whitelist.length})</h3>
                {loading ? (
                    <div className="text-center py-4 text-gray-400">Loading...</div>
                ) : whitelist.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 text-sm">No players whitelisted</div>
                ) : (
                    <div className="space-y-2">
                        {whitelist.map(player => (
                            <div
                                key={player.uuid}
                                className="flex items-center justify-between bg-dark-900 rounded-lg p-3"
                            >
                                <span className="text-white">👤 {player.name}</span>
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
