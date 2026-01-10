import React, { useState, useEffect } from 'react';
import { Users, Clock, X } from 'lucide-react';

export default function Players({ socket }) {
    const [players, setPlayers] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:3000/api/players`);
                const data = await res.json();
                setPlayers(data.players || []);
            } catch (err) {
                console.error("Failed to fetch players", err);
            }
        };

        fetchPlayers();

        socket.on('players', (newPlayers) => {
            setPlayers(newPlayers);
        });

        return () => {
            socket.off('players');
        };
    }, [socket]);

    const getAvatarUrl = (username) => {
        return `https://mc-heads.net/avatar/${username}/64`;
    };

    const getTimeSince = (joinedAt) => {
        const ms = new Date() - new Date(joinedAt);
        const minutes = Math.floor(ms / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-lg">
                <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center gap-3">
                    <Users className="w-6 h-6 text-mc-green" />
                    Online Players ({players.length})
                </h2>

                {players.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-lg">No players online</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {players.map((player) => (
                            <div
                                key={player.username}
                                onClick={() => setSelectedPlayer(player)}
                                className="bg-dark-900 border border-dark-700 rounded-xl p-4 hover:bg-dark-700 hover:border-mc-green transition-all cursor-pointer group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <img
                                            src={getAvatarUrl(player.username)}
                                            alt={player.username}
                                            className="w-16 h-16 rounded-lg border-2 border-dark-600 group-hover:border-mc-green transition-colors"
                                            onError={(e) => {
                                                e.target.src = 'https://mc-heads.net/avatar/steve/64';
                                            }}
                                        />
                                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-mc-green rounded-full border-2 border-dark-900"></div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white truncate group-hover:text-mc-green transition-colors">
                                            {player.username}
                                        </h3>
                                        <p className="text-sm text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {getTimeSince(player.joinedAt)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedPlayer && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPlayer(null)}>
                    <div className="bg-dark-800 rounded-2xl border border-dark-700 p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-2xl font-bold text-white">Player Details</h3>
                            <button onClick={() => setSelectedPlayer(null)} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex flex-col items-center space-y-6">
                            <img
                                src={getAvatarUrl(selectedPlayer.username)}
                                alt={selectedPlayer.username}
                                className="w-32 h-32 rounded-xl border-4 border-mc-green"
                                onError={(e) => {
                                    e.target.src = 'https://mc-heads.net/avatar/steve/128';
                                }}
                            />

                            <div className="w-full space-y-4">
                                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                                    <div className="text-sm text-gray-400 mb-1">Username</div>
                                    <div className="text-xl font-bold text-mc-green">{selectedPlayer.username}</div>
                                </div>

                                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                                    <div className="text-sm text-gray-400 mb-1">Joined At</div>
                                    <div className="text-white">{new Date(selectedPlayer.joinedAt).toLocaleString()}</div>
                                </div>

                                <div className="bg-dark-900 rounded-lg p-4 border border-dark-700">
                                    <div className="text-sm text-gray-400 mb-1">Session Duration</div>
                                    <div className="text-white">{getTimeSince(selectedPlayer.joinedAt)}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
