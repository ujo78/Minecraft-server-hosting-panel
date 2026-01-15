import React, { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, Home, Edit2, Save, X } from 'lucide-react';

export default function FileBrowser({ serverId }) {
    const [path, setPath] = useState('/');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingFile, setEditingFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (serverId) {
            loadDirectory(path);
        }
    }, [serverId, path]);

    const loadDirectory = async (dirPath) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/servers/${serverId}/files?path=${encodeURIComponent(dirPath)}`);
            const data = await res.json();
            setItems(data.items || []);
        } catch (err) {
            console.error('Failed to load directory:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleItemClick = async (item) => {
        if (item.type === 'directory') {
            const newPath = path === '/' ? `/${item.name}` : `${path}/${item.name}`;
            setPath(newPath);
        } else {
            // Edit file
            await loadFile(path === '/' ? item.name : `${path}/${item.name}`);
        }
    };

    const loadFile = async (filePath) => {
        try {
            const res = await fetch(`/api/servers/${serverId}/files/read?path=${encodeURIComponent(filePath)}`);
            const data = await res.json();
            if (data.content !== undefined) {
                setFileContent(data.content);
                setEditingFile(filePath);
            } else {
                alert(data.error || 'Cannot edit this file');
            }
        } catch (err) {
            alert('Failed to load file');
        }
    };

    const handleSaveFile = async () => {
        try {
            setSaving(true);
            const res = await fetch(`/api/servers/${serverId}/files/write`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: editingFile, content: fileContent })
            });

            const data = await res.json();
            if (data.success) {
                alert('✅ File saved!');
                setEditingFile(null);
            } else {
                alert(`❌ ${data.error}`);
            }
        } catch (err) {
            alert('Failed to save file');
        } finally {
            setSaving(false);
        }
    };

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    if (editingFile) {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Edit2 className="w-5 h-5 text-mc-green" />
                        Editing: {editingFile.split('/').pop()}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditingFile(null)}
                            className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600"
                        >
                            <X className="w-4 h-4 inline mr-1" />
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveFile}
                            disabled={saving}
                            className="px-4 py-2 bg-mc-green text-black rounded-lg font-bold hover:bg-green-500 disabled:opacity-50"
                        >
                            <Save className="w-4 h-4 inline mr-1" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>

                <textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    className="w-full h-[500px] bg-dark-900 border border-dark-600 rounded-lg p-4 text-white font-mono text-sm focus:outline-none focus:border-mc-green"
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Folder className="w-5 h-5 text-mc-green" />
                    File Browser
                </h2>
                {path !== '/' && (
                    <button
                        onClick={() => setPath('/')}
                        className="text-mc-green hover:underline flex items-center gap-1 text-sm"
                    >
                        <Home className="w-4 h-4" />
                        Root
                    </button>
                )}
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-lg p-3">
                <div className="text-gray-400 text-sm font-mono">{path}</div>
            </div>

            <div className="bg-dark-800 border border-dark-700 rounded-lg divide-y divide-dark-700">
                {loading ? (
                    <div className="text-center py-8 text-gray-400">Loading...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">Empty directory</div>
                ) : (
                    items.map((item, idx) => (
                        <div
                            key={idx}
                            onClick={() => handleItemClick(item)}
                            className="flex items-center justify-between p-3 hover:bg-dark-900 cursor-pointer transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {item.type === 'directory' ? (
                                    <Folder className="w-5 h-5 text-blue-400" />
                                ) : (
                                    <FileText className="w-5 h-5 text-gray-400" />
                                )}
                                <span className="text-white">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                                {item.type === 'file' && <span>{formatSize(item.size)}</span>}
                                {item.type === 'directory' && <ChevronRight className="w-4 h-4" />}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
