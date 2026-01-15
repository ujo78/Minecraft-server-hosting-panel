import React, { useState, useEffect } from 'react';
import { Plus, Server, AlertCircle, RefreshCw } from 'lucide-react';

export default function AddServerForm({ onClose, onInstall }) {
    const [formData, setFormData] = useState({
        name: '',
        templateId: '',
        memory: 2048,  // Default 2GB RAM
        serverAddress: ''  // Optional custom join address
    });
    const [templates, setTemplates] = useState([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const res = await fetch('/api/available-servers');
            if (res.ok) {
                const data = await res.json();
                setTemplates(data);
                if (data.length > 0) {
                    setFormData(prev => ({ ...prev, templateId: data[0].id }));
                }
            } else {
                throw new Error('Failed to load templates');
            }
        } catch (err) {
            console.error(err);
            setError("Could not availble servers. Ensure backend is running.");
        } finally {
            setLoadingTemplates(false);
        }
    };

    const generateId = (name) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        if (!formData.name.trim()) {
            setError('Server name is required');
            return;
        }
        if (!formData.templateId) {
            setError('Please select a server template');
            return;
        }

        const id = generateId(formData.name);
        if (!id) {
            setError('Server name must contain at least one alphanumeric character');
            return;
        }

        setInstalling(true);

        try {
            const response = await fetch('/api/servers/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    name: formData.name.trim(),
                    templateId: formData.templateId,
                    memory: formData.memory,
                    serverAddress: formData.serverAddress.trim() || null
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Installation failed');
            }

            // Success - notify parent
            onInstall();
        } catch (err) {
            console.error('Installation error:', err);
            setError(err.message || 'Failed to install server');
        } finally {
            setInstalling(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setError(null);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-2xl">
                <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="w-5 h-5 text-mc-green" />
                        Install New Server
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                            <span className="text-red-400 text-sm">{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Server Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="e.g., My Survival World"
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            disabled={installing}
                            autoFocus
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            ID: {generateId(formData.name) || '(auto-generated)'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Memory Allocation
                        </label>
                        <input
                            type="range"
                            min="512"
                            max="8192"
                            step="512"
                            value={formData.memory}
                            onChange={(e) => handleChange('memory', parseInt(e.target.value))}
                            className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-mc-green"
                            disabled={installing}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>512 MB</span>
                            <span className="text-mc-green font-bold text-sm">
                                {formData.memory} MB ({(formData.memory / 1024).toFixed(1)} GB)
                            </span>
                            <span>8 GB</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            💡 Recommended: 2GB for vanilla, 4GB+ for modpacks
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Server Join Address (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.serverAddress}
                            onChange={(e) => handleChange('serverAddress', e.target.value)}
                            placeholder="e.g., survival.myserver.com or play.example.com:25565"
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            disabled={installing}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            🌐 Custom domain/IP players can use to join. Leave empty to use default IP:port
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-2">
                                <Server className="w-4 h-4" />
                                Select Template *
                            </span>
                            <button
                                type="button"
                                onClick={fetchTemplates}
                                className="text-xs text-mc-green hover:underline flex items-center gap-1"
                                disabled={loadingTemplates}
                            >
                                <RefreshCw className={`w-3 h-3 ${loadingTemplates ? 'animate-spin' : ''}`} />
                                Refresh
                            </button>
                        </label>

                        {loadingTemplates ? (
                            <div className="w-full h-10 bg-dark-900 animate-pulse rounded-lg"></div>
                        ) : templates.length === 0 ? (
                            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-lg text-sm text-center">
                                No valid templates found in <code>available-servers/</code>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2">
                                {templates.map(template => (
                                    <div
                                        key={template.id}
                                        onClick={() => !installing && handleChange('templateId', template.id)}
                                        className={`
                                            cursor-pointer p-4 rounded-xl border transition-all flex items-center gap-4
                                            ${formData.templateId === template.id
                                                ? 'bg-mc-green/10 border-mc-green ring-1 ring-mc-green'
                                                : 'bg-dark-900 border-dark-600 hover:border-dark-500'
                                            }
                                        `}
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-dark-800 flex items-center justify-center flex-shrink-0 overflow-hidden border border-dark-700">
                                            {template.icon ? (
                                                <img src={template.icon} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <Server className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-white truncate">{template.name || template.id}</div>
                                            <div className="text-xs text-gray-400 truncate">{template.description}</div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center
                                            ${formData.templateId === template.id ? 'border-mc-green bg-mc-green' : 'border-gray-600'}
                                        `}>
                                            {formData.templateId === template.id && (
                                                <div className="w-2 h-2 rounded-full bg-black" />
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={installing}
                            className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={installing || !formData.templateId || templates.length === 0}
                            className="flex-1 px-4 py-2 bg-mc-green text-black rounded-lg font-bold hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {installing ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                    Installing...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" />
                                    Create Server
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
