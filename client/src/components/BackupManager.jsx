import React, { useState, useEffect } from 'react';
import { Download, RotateCcw, Trash2, Plus, HardDrive, AlertCircle } from 'lucide-react';

export default function BackupManager({ serverId }) {
    const [backups, setBackups] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (serverId) {
            fetchBackups();
        }
    }, [serverId]);

    const fetchBackups = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/servers/${serverId}/backups`);
            const data = await res.json();
            setBackups(data.backups || []);
            setStats(data.stats || null);
        } catch (err) {
            console.error('Failed to fetch backups:', err);
            setError('Failed to load backups');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateBackup = async () => {
        const name = prompt('Enter backup name (optional):');
        if (name === null) return; // Cancelled

        try {
            setCreating(true);
            setError(null);
            const res = await fetch(`/api/servers/${serverId}/backups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim() })
            });

            const data = await res.json();
            if (data.success) {
                await fetchBackups();
            } else {
                setError(data.error || 'Failed to create backup');
            }
        } catch (err) {
            setError('Failed to create backup');
        } finally {
            setCreating(false);
        }
    };

    const handleRestore = async (backupId) => {
        if (!confirm('⚠️ This will replace all current server files with the backup. Server must be offline. Continue?')) {
            return;
        }

        try {
            const res = await fetch(`/api/servers/${serverId}/backups/${backupId}/restore`, {
                method: 'POST'
            });

            const data = await res.json();
            if (data.success) {
                alert('✅ Backup restored successfully!');
            } else {
                alert(`❌ ${data.error}`);
            }
        } catch (err) {
            alert('Failed to restore backup');
        }
    };

    const handleDelete = async (backupId) => {
        if (!confirm('Delete this backup? This cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`/api/servers/${serverId}/backups/${backupId}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                await fetchBackups();
            } else {
                alert(`Failed to delete: ${data.error}`);
            }
        } catch (err) {
            alert('Failed to delete backup');
        }
    };

    const handleDownload = (backupId) => {
        window.open(`/api/servers/${serverId}/backups/${backupId}/download`, '_blank');
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <HardDrive className="w-5 h-5 text-mc-green" />
                    Backups
                </h2>
                <button
                    onClick={handleCreateBackup}
                    disabled={creating}
                    className="bg-mc-green/10 text-mc-green hover:bg-mc-green/20 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors border border-mc-green/50 disabled:opacity-50"
                >
                    {creating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-mc-green border-t-transparent rounded-full animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4" />
                            Create Backup
                        </>
                    )}
                </button>
            </div>

            {stats && (
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-4">
                    <div className="flex gap-4 text-sm">
                        <div>
                            <span className="text-gray-400">Total Backups:</span>
                            <span className="text-white font-bold ml-2">{stats.totalBackups}</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Total Size:</span>
                            <span className="text-white font-bold ml-2">{stats.totalSizeFormatted}</span>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-red-400 text-sm">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-400">
                    <div className="w-8 h-8 border-2 border-mc-green border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading backups...
                </div>
            ) : backups.length === 0 ? (
                <div className="bg-dark-800 border border-dark-700 rounded-lg p-8 text-center">
                    <HardDrive className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 mb-1">No backups yet</p>
                    <p className="text-gray-500 text-sm">Create your first backup to protect your server data</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {backups.map((backup) => (
                        <div
                            key={backup.id}
                            className="bg-dark-800 border border-dark-700 hover:border-dark-600 rounded-lg p-4 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <h3 className="text-white font-bold">{backup.name}</h3>
                                    <div className="flex gap-3 text-xs text-gray-400 mt-1">
                                        <span>📅 {formatDate(backup.date)}</span>
                                        <span>💾 {formatSize(backup.size)}</span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleDownload(backup.id)}
                                        className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors"
                                        title="Download backup"
                                    >
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleRestore(backup.id)}
                                        className="p-2 text-mc-green hover:bg-mc-green/10 rounded-lg transition-colors"
                                        title="Restore backup"
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(backup.id)}
                                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                        title="Delete backup"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
