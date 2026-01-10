import React, { useState, useEffect } from 'react';
import { Users, Clock, X, MapPin, Heart, Skull, Gamepad2, TrendingUp } from 'lucide-react';

export default function Players({ socket }) {
    const [players, setPlayers] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [detailedData, setDetailedData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const fetchPlayerDetails = async (username) => {
        setLoadingDetails(true);
        try {
            const res = await fetch(`http://${window.location.hostname}:3000/api/players/${username}`);
            const data = await res.json();
            setDetailedData(data);
        } catch (err) {
            console.error("Failed to fetch player details", err);
            setDetailedData(null);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePlayerClick = (player) => {
        setSelectedPlayer(player);
        setDetailedData(null);
        fetchPlayerDetails(player.username);
    };

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

    const formatPlayTime = (ticks) => {
        if (!ticks) return '0m';
        const minutes = Math.floor(ticks / 1200);
        if (minutes < 60) return `${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    const formatDistance = (cm) => {
        if (!cm) return '0m';
        const meters = Math.floor(cm / 100);
        if (meters < 1000) return `${meters}m`;
        return `${(meters / 1000).toFixed(1)}km`;
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
                                onClick={() => handlePlayerClick(player)}
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
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={() => { setSelectedPlayer(null); setDetailedData(null); }}>
                    <div className="bg-dark-800 rounded-2xl border border-dark-700 p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-2xl font-bold text-white">Player Details</h3>
                            <button onClick={() => { setSelectedPlayer(null); setDetailedData(null); }} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {loadingDetails ? (
                            <div className="text-center py-12">
                                <div className="animate-spin w-12 h-12 border-4 border-mc-green border-t-transparent rounded-full mx-auto"></div>
                                <p className="text-gray-400 mt-4">Loading player data...</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col items-center">
                                    <img
                                        src={getAvatarUrl(selectedPlayer.username)}
                                        alt={selectedPlayer.username}
                                        className="w-32 h-32 rounded-xl border-4 border-mc-green"
                                        onError={(e) => {
                                            e.target.src = 'https://mc-heads.net/avatar/steve/128';
                                        }}
                                    />
                                    <h4 className="text-2xl font-bold text-mc-green mt-4">{selectedPlayer.username}</h4>
                                    <p className="text-gray-400">Session: {getTimeSince(selectedPlayer.joinedAt)}</p>
                                </div>

                                {detailedData?.playerData && (
                                    <div>
                                        <h5 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <MapPin className="w-5 h-5 text-mc-green" /> Current Status
                                        </h5>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Position</div>
                                                <div className="text-white font-mono text-sm">
                                                    {detailedData.playerData.position?.x}, {detailedData.playerData.position?.y}, {detailedData.playerData.position?.z}
                                                </div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Dimension</div>
                                                <div className="text-white capitalize">{detailedData.playerData.dimension}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Heart className="w-3 h-3" /> Health
                                                </div>
                                                <div className="text-mc-green font-bold">{detailedData.playerData.health?.toFixed(1)} / 20</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">XP Level</div>
                                                <div className="text-yellow-400 font-bold">{detailedData.playerData.xpLevel}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {detailedData?.statistics && (
                                    <div>
                                        <h5 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <TrendingUp className="w-5 h-5 text-mc-green" /> Statistics
                                        </h5>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Skull className="w-3 h-3" /> Deaths
                                                </div>
                                                <div className="text-red-400 font-bold text-lg">{detailedData.statistics.deaths}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Gamepad2 className="w-3 h-3" /> Play Time
                                                </div>
                                                <div className="text-white font-bold text-lg">{formatPlayTime(detailedData.statistics.playTime)}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Mob Kills</div>
                                                <div className="text-white">{detailedData.statistics.mobKills}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Distance Walked</div>
                                                <div className="text-white">{formatDistance(detailedData.statistics.distanceWalked)}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Damage Dealt</div>
                                                <div className="text-white">{(detailedData.statistics.damageDealt / 10).toFixed(1)}</div>
                                            </div>
                                            <div className="bg-dark-900 rounded-lg p-3 border border-dark-700">
                                                <div className="text-xs text-gray-400">Damage Taken</div>
                                                <div className="text-white">{(detailedData.statistics.damageTaken / 10).toFixed(1)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {detailedData?.ftb && detailedData.ftb.inTeam && (
                                    <div>
                                        <h5 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                                            <Users className="w-5 h-5 text-mc-green" /> FTB Team
                                        </h5>
                                        <div className="bg-dark-900 rounded-lg p-4 border border-dark-700 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="text-xs text-gray-400">Team Name</div>
                                                    <div className="text-white font-bold text-lg">{detailedData.ftb.teamName}</div>
                                                </div>
                                                {detailedData.ftb.isOwner && (
                                                    <div className="bg-mc-green text-black px-3 py-1 rounded-full text-xs font-bold">
                                                        OWNER
                                                    </div>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-dark-800 rounded p-3">
                                                    <div className="text-xs text-gray-400">Members</div>
                                                    <div className="text-white font-bold">{detailedData.ftb.memberCount}</div>
                                                </div>
                                                <div className="bg-dark-800 rounded p-3">
                                                    <div className="text-xs text-gray-400">Team ID</div>
                                                    <div className="text-gray-300 text-xs font-mono truncate">{detailedData.ftb.teamId?.slice(0, 8)}...</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!detailedData && !loadingDetails && (
                                    <div className="text-center py-6 text-gray-500">
                                        <p>No extended data available</p>
                                        <p className="text-sm">Player files may not exist yet</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
