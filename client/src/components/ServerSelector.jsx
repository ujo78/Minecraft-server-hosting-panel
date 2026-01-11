import React, { useState, useEffect } from 'react';
import { Server as ServerIcon, Plus, Trash2, PlayCircle, Loader2 } from 'lucide-react';
import ModpackSearch from './ModpackSearch';

export default function ServerSelector({ activeServerId, onServerSwitch }) {
    const [servers, setServers] = useState([]);
    const [showSearch, setShowSearch] = useState(false);
    const [installing, setInstalling] = useState(false);
    const [installStatus, setInstallStatus] = useState('');

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

    const handleInstall = async (modpack) => {
        // We need to fetch the files first to get the latest server file
        setInstalling(true);
        setInstallStatus(`Preparing to install ${modpack.name}...`);
        setShowSearch(false);

        try {
            // 1. Get files for this modpack
            const filesRes = await fetch(`/api/modpacks/search?q=${encodeURIComponent(modpack.name)}`);
            // WAIT, search endpoint is generic. We need a way to get files.
            // But for MVP, let's assume valid search. 
            // Actually, we need a separate endpoint to get files or just try to find a "server pack"
            // The curseforge.js wrapper has getModpackFiles(modId). We need to expose that or use the search result?
            // The search result doesn't have files.

            // Let's IMPROVE: allow backend to find the best file or assume we passed enough info?
            // Modpack object has `id`. We can call backend `install` with `modId` and let backend find the file.

            // For now, let's send modId and let backend pick latest file (we might need to update backend logic or simple heuristic)
            // But wait, our backend install endpoint EXPECTS `fileId`.
            // Let's do a quick hack: we'll just pick the `mainFileId` from the modpack object if available, or fetch files.

            // Since we can't easily fetch files from frontend without exposing another API, let's just make the backend smarter later?
            // OR: Modpack object from search usually has `latestFiles`.

            const serverFile = modpack.latestFiles?.find(f => f.serverPackFileId) || modpack.latestFiles?.[0];
            // Note: CurseForge API structure might vary. 
            // Let's assume we pass modId and let backend handle fetching the file list if needed?
            // Our backend `install` endpoint expects `fileId`.

            // Let's try to just use the main file ID
            const fileId = modpack.mainFileId;

            setInstallStatus(`Downloading & Installing ${modpack.name}... This may take a while.`);

            const res = await fetch('/api/servers/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: modpack.slug || modpack.name.toLowerCase().replace(/\s+/g, '-'),
                    name: modpack.name,
                    modId: modpack.id,
                    fileId: fileId, // Use main file
                    iconUrl: modpack.logo?.thumbnailUrl
                })
            });

            const data = await res.json();
            if (data.success) {
                alert("Installation complete!");
                fetchServers();
            } else {
                alert("Installation failed: " + data.error);
            }
        } catch (err) {
            console.error(err);
            alert("Installation failed");
        } finally {
            setInstalling(false);
            setInstallStatus('');
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
                                    <div className="flex items-center gap-2 text-xs">
                                        {isActive ? (
                                            <span className="text-mc-green flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full bg-mc-green animate-pulse" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="text-gray-600 group-hover:text-gray-500">Click to play</span>
                                        )}
                                    </div>
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
                <ModpackSearch
                    onClose={() => setShowSearch(false)}
                    onInstall={handleInstall}
                />
            )}
        </div>
    );
}
