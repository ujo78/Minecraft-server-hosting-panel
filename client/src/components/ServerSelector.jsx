import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, Plus, Trash2, PlayCircle, Loader2, Copy, Check } from 'lucide-react';
import AddServerForm from './AddServerForm';

export default function ServerSelector({ activeServerId, onServerSwitch }) {
    const [servers, setServers] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installStatus, setInstallStatus] = useState('');
    const [copiedId, setCopiedId] = useState(null);

    const fetchServers = async () => {
        try {
            const res = await fetch('/api/servers');
            const data = await res.json();
            setServers(data.servers || []);
        } catch (err) {
            console.error("Failed to fetch servers", err);
        }
    };

    useEffect(() => {
        fetchServers();
    }, [activeServerId]); // Refresh when active changes

    const handleSwitch = async (id) => {
        if (id === activeServerId) return;

        if (!confirm("Start this server? This will stop the current server.")) return;

        try {
            const res = await fetch('/api/servers/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                onServerSwitch(data.activeId);
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Failed to switch server");
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this server? This cannot be undone.")) return;

        try {
            const res = await fetch(`/api/servers/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                fetchServers();
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Failed to delete server");
        }
    };

    const handleInstall = async () => {
        // Installation is handled by AddServerForm
        // Just refresh the server list and close the form
        setShowSearch(false);
        await fetchServers();
    };

    const handleCopyAddress = async (e, server) => {
        e.stopPropagation();
        const address = server.serverAddress || `your-server-ip:${server.port || 25565}`;
        try {
            await navigator.clipboard.writeText(address);
            setCopiedId(server.id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
                    <ServerIcon className="w-5 h-5 text-mc-green" />
                    Servers
                </h2>
                <button
                    onClick={() => setShowSearch(true)}
                    disabled={installing}
                    className="bg-mc-green/10 text-mc-green hover:bg-mc-green/20 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1 transition-colors border border-mc-green/50"
                >
                    <Plus className="w-4 h-4" /> Add Server
                </button>
            </div>

            {installing && (
                <div className="bg-dark-800 border border-mc-green rounded-xl p-4 mb-4 flex items-center gap-4 animate-pulse">
                    <Loader2 className="w-6 h-6 text-mc-green animate-spin" />
                    <div className="text-white font-medium">{installStatus}</div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {servers.map((server) => {
                    const isActive = server.id === activeServerId;
                    return (
                        <div
                            key={server.id}
                            onClick={() => handleSwitch(server.id)}
                            className={`
                                relative group overflow-hidden rounded-xl border transition-all cursor-pointer
                                ${isActive
                                    ? 'bg-dark-800 border-mc-green ring-1 ring-mc-green shadow-[0_0_15px_rgba(46,204,113,0.15)]'
                                    : 'bg-dark-900 border-dark-700 hover:bg-dark-800 hover:border-dark-600'
                                }
                            `}
                        >
                            <div className="p-3 flex items-center gap-3">
                                <img
                                    src={server.icon || 'https://via.placeholder.com/64'}
                                    alt={server.name}
                                    className={`w-12 h-12 rounded-lg object-cover ${!isActive && 'grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all'}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className={`font-bold truncate ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>
                                        {server.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        <span className={`${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {server.memory ? `${(server.memory / 1024).toFixed(1)}GB` : '1.0GB'}
                                        </span>
                                        <span className="text-gray-700">•</span>
                                        <span className={`${isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Port {server.port || 25565}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs mt-1">
                                        {isActive ? (
                                            <span className="text-mc-green flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-mc-green animate-pulse" />
                                                {server.status === 'online' ? 'Online' :
                                                    server.status === 'starting' ? 'Starting...' :
                                                        server.status === 'stopping' ? 'Stopping...' :
                                                            server.status === 'crashed' ? '⚠️ Crashed' : 'Active'}
                                            </span>
                                        ) : (
                                            <span className="text-gray-600 group-hover:text-gray-500">Click to play</span>
                                        )}
                                    </div>
                                    {(server.serverAddress || isActive) && (
                                        <div className="flex items-center gap-1 text-xs mt-2">
                                            <span className={`font-mono truncate ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
                                                {server.serverAddress || `your-server-ip:${server.port || 25565}`}
                                            </span>
                                            <button
                                                onClick={(e) => handleCopyAddress(e, server)}
                                                className={`p-1 rounded hover:bg-dark-700 transition-colors ${copiedId === server.id ? 'text-mc-green' : 'text-gray-500 hover:text-gray-300'
                                                    }`}
                                                title="Copy join address"
                                            >
                                                {copiedId === server.id ? (
                                                    <Check className="w-3 h-3" />
                                                ) : (
                                                    <Copy className="w-3 h-3" />
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isActive ? (
                                    <div className="text-mc-green">
                                        <PlayCircle className="w-6 h-6 fill-current opacity-20" />
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => handleDelete(e, server.id)}
                                        className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Server"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {showSearch && (
                <AddServerForm
                    onClose={() => setShowSearch(false)}
                    onInstall={handleInstall}
                />
            )}
        </div>
    );
}
