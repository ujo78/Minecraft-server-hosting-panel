import React, { useState, useEffect } from 'react';
import { Upload, Trash2, File, HardDrive } from 'lucide-react';

export default function ModManager() {
    const [mods, setMods] = useState([]);
    const [uploading, setUploading] = useState(false);

    const fetchMods = async () => {
        try {
            const res = await fetch(`/api/mods`);
            const data = await res.json();
            setMods(data.mods || []);
        } catch (err) {
            console.error("Failed to list mods", err);
        }
    };

    useEffect(() => {
        fetchMods();
    }, []);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!e.target.files) return;

        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('mod', file);

        setUploading(true);
        try {
            await fetch(`/api/upload-mod`, {
                method: 'POST',
                body: formData,
            });
            fetchMods(); // Refresh list
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };

    const deleteMod = async (filename) => {
        if (!confirm(`Delete ${filename}?`)) return;

        try {
            await fetch(`/api/delete-mod`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            fetchMods();
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-lg">
                <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center gap-3">
                    <HardDrive className="w-6 h-6 text-mc-green" /> Mod Manager
                </h2>

                <div className="mb-8">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-dark-600 rounded-xl cursor-pointer hover:bg-dark-700 hover:border-mc-green transition-all group">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-2 text-gray-400 group-hover:text-mc-green transition-colors" />
                            <p className="mb-1 text-sm text-gray-400"><span className="font-semibold text-gray-200">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-gray-500">.jar files only</p>
                        </div>
                        <input type="file" className="hidden" accept=".jar" onChange={handleUpload} disabled={uploading} />
                    </label>
                    {uploading && <p className="text-mc-green mt-2 text-center animate-pulse">Uploading...</p>}
                </div>

                <div className="bg-dark-900 rounded-xl border border-dark-700 overflow-hidden">
                    <div className="p-4 border-b border-dark-700 text-gray-400 text-sm font-semibold uppercase tracking-wider flex justify-between">
                        <span>Filename</span>
                        <span>Actions</span>
                    </div>
                    <div className="divide-y divide-dark-700">
                        {mods.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">No mods installed.</div>
                        ) : (
                            mods.map((mod, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-dark-800 transition-colors">
                                    <div className="flex items-center gap-3 text-gray-200">
                                        <File className="w-5 h-5 text-blue-400" />
                                        <span>{mod}</span>
                                    </div>
                                    <button
                                        onClick={() => deleteMod(mod)}
                                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
