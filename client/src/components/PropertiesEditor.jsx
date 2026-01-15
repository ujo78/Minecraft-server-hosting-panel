import React, { useState, useEffect } from 'react';
import { Settings, Save, AlertCircle } from 'lucide-react';

export default function PropertiesEditor({ serverId }) {
    const [properties, setProperties] = useState({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (serverId) {
            fetchProperties();
        }
    }, [serverId]);

    const fetchProperties = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/servers/${serverId}/properties`);
            const data = await res.json();
            setProperties(data.properties || {});
        } catch (err) {
            setError('Failed to load properties');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError(null);
            const res = await fetch(`/api/servers/${serverId}/properties`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ properties })
            });

            const data = await res.json();
            if (data.success) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to save properties');
        } finally {
            setSaving(false);
        }
    };

    const updateProperty = (key, value) => {
        setProperties(prev => ({ ...prev, [key]: value }));
    };

    const commonProps = [
        { key: 'motd', label: 'MOTD', type: 'text' },
        { key: 'max-players', label: 'Max Players', type: 'number' },
        { key: 'difficulty', label: 'Difficulty', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
        { key: 'gamemode', label: 'Game Mode', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
        { key: 'pvp', label: 'PvP', type: 'boolean' },
        { key: 'online-mode', label: 'Online Mode', type: 'boolean' },
        { key: 'view-distance', label: 'View Distance', type: 'number' },
    ];

    if (loading) {
        return <div className="text-center py-8 text-gray-400">Loading...</div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-mc-green" />
                    Server Properties
                </h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-mc-green text-black px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-green-500 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 text-sm">{error}</span>
                </div>
            )}

            {success && (
                <div className="bg-mc-green/10 border border-mc-green/50 rounded-lg p-3 text-mc-green text-sm">
                    ✅ Properties saved successfully!
                </div>
            )}

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-6 space-y-4">
                {commonProps.map(prop => (
                    <div key={prop.key}>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            {prop.label}
                        </label>
                        {prop.type === 'text' || prop.type === 'number' ? (
                            <input
                                type={prop.type}
                                value={properties[prop.key] || ''}
                                onChange={(e) => updateProperty(prop.key, e.target.value)}
                                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            />
                        ) : prop.type === 'select' ? (
                            <select
                                value={properties[prop.key] || prop.options[0]}
                                onChange={(e) => updateProperty(prop.key, e.target.value)}
                                className="w-full bg-dark-900 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                            >
                                {prop.options.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : prop.type === 'boolean' ? (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={properties[prop.key] === 'true'}
                                    onChange={(e) => updateProperty(prop.key, e.target.checked ? 'true' : 'false')}
                                    className="w-5 h-5 rounded bg-dark-900 border-dark-600 text-mc-green focus:ring-mc-green"
                                />
                                <span className="text-gray-400 text-sm">Enabled</span>
                            </label>
                        ) : null}
                    </div>
                ))}
            </div>
        </div>
    );
}
