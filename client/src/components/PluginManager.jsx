import React, { useState, useEffect } from 'react';
import { Power, Trash2, Settings, Download, AlertCircle } from 'lucide-react';

export default function PluginManager({ serverId }) {
    const [plugins, setPlugins] = useState([]);
    const [loading, setLoading] = useState(false);
    const [installUrl, setInstallUrl] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        if (serverId) {
            fetchPlugins();
        }
    }, [serverId]);

    const fetchPlugins = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/servers/${serverId}/plugins`);
            const data = await res.json();
            if (data.plugins) {
                setPlugins(data.plugins);
            }
        } catch (err) {
            console.error("Failed to fetch plugins", err);
            setError("Failed to load plugins.");
        } finally {
            setLoading(false);
        }
    };

    const togglePlugin = async (name, currentState) => {
        try {
            const res = await fetch(`/api/servers/${serverId}/plugins/${name}/toggle`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !currentState })
            });
            const data = await res.json();
            if (data.success) {
                fetchPlugins(); // Refresh list
            } else {
                alert("Failed to toggle plugin.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const deletePlugin = async (name, filename) => {
        if (!confirm(`Are you sure you want to delete ${name}? This cannot be undone.`)) return;

        try {
            // Frontend should hopefully send filename if available, or just name
            // The API handles looking up .jar or .jar.disabled
            const res = await fetch(`/api/servers/${serverId}/plugins/${name}?filename=${filename}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchPlugins();
            } else {
                alert("Failed to delete plugin.");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleInstall = async (e) => {
        e.preventDefault();
        if (!installUrl.trim()) return;

        // Try to guess filename from URL
        let filename = installUrl.split('/').pop();
        if (!filename.endsWith('.jar')) filename += '.jar';

        // Prompt user for filename to be safe
        const userFilename = prompt("Enter filename for plugin:", filename);
        if (!userFilename) return;

        try {
            const res = await fetch(`/api/servers/${serverId}/plugins/install`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: installUrl, filename: userFilename })
            });
            const data = await res.json();
            if (data.success) {
                setInstallUrl('');
                alert("Plugin installed successfully!");
                fetchPlugins();
            } else {
                alert("Installation failed.");
            }
        } catch (err) {
            console.error(err);
            alert("Error installing plugin.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="sci-fi-panel p-4">
                <div className="corner-accent corner-accent-tl" style={{width: '12px', height: '12px'}}></div>
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 font-['VT323'] uppercase">
                    <Download className="w-5 h-5 text-[#00f0ff]" /> Install Plugin
                </h3>
                <form onSubmit={handleInstall} className="flex gap-2">
                    <input
                        type="url"
                        value={installUrl}
                        onChange={(e) => setInstallUrl(e.target.value)}
                        placeholder="https://example.com/plugin.jar"
                        className="flex-1 bg-black/50 border border-[#00f0ff]/30 rounded px-4 py-2 text-white focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    />
                    <button type="submit" className="minecraft-btn minecraft-btn-primary">
                        Install
                    </button>
                </form>
                <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-[#fbbf24]" />
                    Ensure you trust the source URL. Only .jar files are supported.
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-white font-bold text-lg font-['VT323'] uppercase tracking-wide">Installed Plugins ({plugins.length})</h3>

                {loading ? (
                    <div className="text-[#00f0ff] animate-pulse">Loading plugins...</div>
                ) : plugins.length === 0 ? (
                    <div className="text-gray-500 italic">No plugins installed.</div>
                ) : (
                    <div className="grid grid-cols-1 gap-2">
                        {plugins.map(plugin => (
                            <div key={plugin.filename} className={`sci-fi-panel p-4 border-l-4 flex justify-between items-center ${plugin.enabled ? 'border-l-[#52eb34]' : 'border-l-red-500'}`}>
                                <div className="corner-accent corner-accent-tl" style={{width: '10px', height: '10px'}}></div>
                                <div>
                                    <h4 className={`font-bold font-['VT323'] text-lg ${plugin.enabled ? 'text-white' : 'text-gray-400'}`}>
                                        {plugin.name}
                                        {!plugin.enabled && <span className="ml-2 text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded">DISABLED</span>}
                                    </h4>
                                    <div className="text-xs text-gray-500 font-mono">
                                        {(plugin.size / 1024).toFixed(1)} KB • Modified: {new Date(plugin.modified).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => togglePlugin(plugin.name, plugin.enabled)}
                                        className={`p-2 rounded hover:bg-white/10 ${plugin.enabled ? 'text-[#52eb34]' : 'text-gray-400'}`}
                                        title={plugin.enabled ? "Disable" : "Enable"}
                                    >
                                        <Power className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => deletePlugin(plugin.name, plugin.filename)}
                                        className="p-2 rounded hover:bg-red-500/20 text-red-500"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
