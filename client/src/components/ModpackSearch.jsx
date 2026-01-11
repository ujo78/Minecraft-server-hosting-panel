import React, { useState } from 'react';
import { Search, Download, X, AlertCircle } from 'lucide-react';

export default function ModpackSearch({ onClose, onInstall }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setSearching(true);
        setError(null);
        try {
            const res = await fetch(`/api/modpacks/search?q=${encodeURIComponent(query)}`);
            const data = await res.json();

            // CurseForge API returns data.data for results
            setResults(data.data || []);
        } catch (err) {
            console.error(err);
            setError('Failed to search modpacks');
        } finally {
            setSearching(false);
        }
    };

    const handleInstall = async (modpack) => {
        // We need to find the latest server file
        // For MVP, we pass the modpack info to the parent or call API directly.
        // Let's call API directly but we need to fetch specific file info first.
        // Actually, let's trigger the install in parent or here? 
        // Let's do it here for simplicity, but we need extra info.

        // We'll pass the modpack object to the parent 'onInstall' which handles the heavy lifting/UI state
        onInstall(modpack);
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-700 w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <Search className="w-5 h-5 text-mc-green" />
                        Search Modpacks
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 border-b border-dark-700 bg-dark-900">
                    <form onSubmit={handleSearch} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search for modpacks (e.g. StoneBlock, RLCraft)..."
                            className="flex-1 bg-dark-800 border border-dark-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-mc-green"
                        />
                        <button
                            type="submit"
                            disabled={searching}
                            className="bg-mc-green text-black px-6 py-2 rounded-lg font-bold hover:bg-green-500 disabled:opacity-50"
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="text-red-400 mb-4 flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {results.map((modpack) => (
                            <div key={modpack.id} className="bg-dark-900 border border-dark-700 rounded-xl p-4 flex gap-4 hover:border-dark-500 transition-colors">
                                <img
                                    src={modpack.logo?.thumbnailUrl || 'https://via.placeholder.com/64'}
                                    alt={modpack.name}
                                    className="w-20 h-20 rounded-lg object-cover bg-dark-800"
                                />
                                <div className="flex-1 min-w-0 flex flex-col justify-between">
                                    <div>
                                        <h4 className="font-bold text-white truncate" title={modpack.name}>{modpack.name}</h4>
                                        <p className="text-xs text-gray-400 line-clamp-2 mt-1">{modpack.summary}</p>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <div className="text-xs text-gray-500">
                                            Downloads: {(modpack.downloadCount / 1000000).toFixed(1)}M
                                        </div>
                                        <button
                                            onClick={() => handleInstall(modpack)}
                                            disabled={loading}
                                            className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/50 rounded hover:bg-blue-600/30 text-sm font-bold flex items-center gap-1 transition-colors"
                                        >
                                            <Download className="w-4 h-4" /> Install
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {results.length === 0 && !searching && query && (
                            <div className="col-span-2 text-center text-gray-500 py-12">
                                No modpacks found
                            </div>
                        )}

                        {!query && results.length === 0 && (
                            <div className="col-span-2 text-center text-gray-500 py-12">
                                Search for a modpack to begin
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
