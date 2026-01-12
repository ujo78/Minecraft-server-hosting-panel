import React, { useState } from 'react';
import { Plus, Link, Image, AlertCircle } from 'lucide-react';

export default function AddServerForm({ onClose, onInstall }) {
    const [formData, setFormData] = useState({
        name: '',
        downloadUrl: '',
        iconUrl: ''
    });
    const [installing, setInstalling] = useState(false);
    const [error, setError] = useState(null);

    const generateId = (name) => {
        return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!formData.name.trim()) {
            setError('Server name is required');
            return;
        }
        if (!formData.downloadUrl.trim()) {
            setError('Download URL is required');
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
                    downloadUrl: formData.downloadUrl.trim(),
                    iconUrl: formData.iconUrl.trim() || undefined
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
                        Add Server Manually
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                            placeholder="e.g., My Custom Server"
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            disabled={installing}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            ID: {generateId(formData.name) || '(auto-generated)'}
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Link className="w-4 h-4" />
                            Download URL *
                        </label>
                        <input
                            type="url"
                            value={formData.downloadUrl}
                            onChange={(e) => handleChange('downloadUrl', e.target.value)}
                            placeholder="https://example.com/serverpack.zip"
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            disabled={installing}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Direct link to server pack ZIP file
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                            <Image className="w-4 h-4" />
                            Icon URL (Optional)
                        </label>
                        <input
                            type="url"
                            value={formData.iconUrl}
                            onChange={(e) => handleChange('iconUrl', e.target.value)}
                            placeholder="https://example.com/icon.png"
                            className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            disabled={installing}
                        />
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
                            disabled={installing}
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
                                    Install Server
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
