import React, { useState, useEffect } from 'react';
import { Users, Clock, X, MapPin, Heart, Skull, Gamepad2, TrendingUp, Shield, Ban, DoorOpen } from 'lucide-react';

export default function Players({ socket }) {
    const [players, setPlayers] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [detailedData, setDetailedData] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    const fetchPlayerDetails = async (username) => {
        setLoadingDetails(true);
        try {
            const res = await fetch(`/api/players/${username}`);
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

    const handleAction = async (action) => {
        let reason = '';
        if (action === 'kick' || action === 'ban') {
            reason = prompt(`Enter reason for ${action}:`);
            if (reason === null) return;
        }

        if (!confirm(`Are you sure you want to ${action} ${selectedPlayer.username}?`)) return;

        try {
            await fetch('/api/players/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    username: selectedPlayer.username,
                    reason
                })
            });
            alert(`Executed ${action} on ${selectedPlayer.username}`);
        } catch (err) {
            console.error(err);
            alert(`Failed to execute ${action}`);
        }
    };

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                const res = await fetch(`/api/players`);
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
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="glass-panel p-6 opacity-95">
                <h2 className="text-3xl mb-6 text-white flex items-center gap-3 font-['VT323'] uppercase tracking-wide border-b border-white/5 pb-4">
                    <Users className="w-8 h-8 text-[#52eb34]" />
                    Online Players <span className="bg-[#52eb34]/20 text-[#52eb34] px-2 py-0.5 rounded text-xl ml-2">({players.length})</span>
                </h2>

                {players.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-black/20 rounded-lg border border-white/5 border-dashed">
                        <Users className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <p className="text-xl font-['VT323'] uppercase tracking-widest">No players online</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {players.map((player) => (
                            <div
                                key={player.username}
                                onClick={() => handlePlayerClick(player)}
                                className="bg-black/40 border border-white/10 rounded-lg p-4 hover:bg-white/5 hover:border-[#52eb34]/50 transition-all cursor-pointer group relative overflow-hidden"
                            >
                                {/* Hover Glow */}
                                <div className="absolute inset-0 bg-[#52eb34]/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="relative">
                                        <img
                                            src={getAvatarUrl(player.username)}
                                            alt={player.username}
                                            className="w-14 h-14 rounded-md border-2 border-black/50 group-hover:border-[#52eb34] transition-colors shadow-lg"
                                            onError={(e) => {
                                                e.target.src = 'https://mc-heads.net/avatar/steve/64';
                                            }}
                                        />
                                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#52eb34] rounded-sm border border-black shadow-[0_0_8px_#52eb34]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-['VT323'] text-2xl text-white truncate group-hover:text-[#52eb34] transition-colors leading-none">
                                            {player.username}
                                        </h3>
                                        <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1 font-mono uppercase tracking-wide">
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
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setSelectedPlayer(null); setDetailedData(null); }}>
                    <div className="glass-panel p-0 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-black/40">
                            <h3 className="text-3xl font-['VT323'] text-white uppercase tracking-wide">Player Details</h3>
                            <button onClick={() => { setSelectedPlayer(null); setDetailedData(null); }} className="text-gray-400 hover:text-white transition-colors hover:rotate-90">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="overflow-y-auto p-8 custom-scrollbar bg-black/20">
                            {loadingDetails ? (
                                <div className="text-center py-12">
                                    <div className="animate-spin w-12 h-12 border-4 border-[#52eb34] border-t-transparent rounded-full mx-auto shadow-[0_0_15px_rgba(82,235,52,0.3)]"></div>
                                    <p className="text-gray-400 mt-4 font-['VT323'] text-lg animate-pulse">Scanning Player Data...</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    <div className="flex flex-col items-center relative">
                                        {/* Avatar Halo */}
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-[#52eb34]/20 blur-3xl rounded-full pointer-events-none" />

                                        <img
                                            src={getAvatarUrl(selectedPlayer.username)}
                                            alt={selectedPlayer.username}
                                            className="w-32 h-32 rounded-lg border-4 border-[#52eb34] shadow-[0_0_20px_rgba(82,235,52,0.3)] relative z-10"
                                            onError={(e) => {
                                                e.target.src = 'https://mc-heads.net/avatar/steve/128';
                                            }}
                                        />
                                        <h4 className="text-4xl font-['VT323'] text-[#52eb34] mt-4 mb-1 tracking-wide relative z-10">{selectedPlayer.username}</h4>
                                        <p className="text-gray-400 font-mono text-xs uppercase tracking-widest relative z-10">Session: {getTimeSince(selectedPlayer.joinedAt)}</p>

                                        <div className="flex gap-3 mt-6 relative z-10">
                                            <button onClick={() => handleAction('op')} className="minecraft-btn border-yellow-600/50 text-yellow-500 hover:bg-yellow-600/10 text-sm py-1">
                                                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> OP</span>
                                            </button>
                                            <button onClick={() => handleAction('deop')} className="minecraft-btn border-gray-600 text-gray-400 hover:bg-gray-800 text-sm py-1">
                                                <span className="flex items-center gap-1.5"><Shield className="w-4 h-4" /> DEOP</span>
                                            </button>
                                            <button onClick={() => handleAction('kick')} className="minecraft-btn border-orange-600/50 text-orange-500 hover:bg-orange-600/10 text-sm py-1">
                                                <span className="flex items-center gap-1.5"><DoorOpen className="w-4 h-4" /> KICK</span>
                                            </button>
                                            <button onClick={() => handleAction('ban')} className="minecraft-btn border-red-600/50 text-red-500 hover:bg-red-600/10 text-sm py-1">
                                                <span className="flex items-center gap-1.5"><Ban className="w-4 h-4" /> BAN</span>
                                            </button>
                                        </div>
                                    </div>

                                    {detailedData?.playerData && (
                                        <div className="space-y-3">
                                            <h5 className="text-xl font-['VT323'] text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                                <MapPin className="w-5 h-5 text-[#52eb34]" /> LIVE DATA
                                            </h5>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="bg-black/40 rounded p-3 border border-white/5">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">Position</div>
                                                    <div className="text-[#52eb34] font-mono text-sm mt-1">
                                                        X:{detailedData.playerData.position?.x?.toFixed(0)} Y:{detailedData.playerData.position?.y?.toFixed(0)} Z:{detailedData.playerData.position?.z?.toFixed(0)}
                                                    </div>
                                                </div>
                                                <div className="bg-black/40 rounded p-3 border border-white/5">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">Dimension</div>
                                                    <div className="text-white capitalize font-['VT323'] text-lg leading-none mt-1">{detailedData.playerData.dimension?.replace('minecraft:', '')}</div>
                                                </div>
                                                <div className="bg-black/40 rounded p-3 border border-white/5">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                                        <Heart className="w-3 h-3 text-red-500" /> Health
                                                    </div>
                                                    <div className="text-red-400 font-bold font-mono mt-1">{detailedData.playerData.health?.toFixed(1)} <span className="text-gray-600 text-xs">/ 20</span></div>
                                                </div>
                                                <div className="bg-black/40 rounded p-3 border border-white/5">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest">XP Level</div>
                                                    <div className="text-yellow-400 font-bold font-['VT323'] text-2xl leading-none mt-1">{detailedData.playerData.xpLevel}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {detailedData?.statistics && (
                                        <div className="space-y-3">
                                            <h5 className="text-xl font-['VT323'] text-white flex items-center gap-2 border-b border-white/5 pb-2">
                                                <TrendingUp className="w-5 h-5 text-[#52eb34]" /> STATISTICS
                                            </h5>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-black/40 rounded p-2 border border-white/5 text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Deaths</div>
                                                    <div className="text-red-500 font-['VT323'] text-2xl">{detailedData.statistics.deaths}</div>
                                                </div>
                                                <div className="bg-black/40 rounded p-2 border border-white/5 text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Kills</div>
                                                    <div className="text-white font-['VT323'] text-2xl">{detailedData.statistics.mobKills}</div>
                                                </div>
                                                <div className="bg-black/40 rounded p-2 border border-white/5 text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Playtime</div>
                                                    <div className="text-[#52eb34] font-['VT323'] text-xl pt-0.5">{formatPlayTime(detailedData.statistics.playTime)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
