import React, { useState } from 'react';
import { Play, Square, Power } from 'lucide-react';

export default function Dashboard({ socket, status }) {
    const [loading, setLoading] = useState(false);

    const sendControl = async (action) => {
        setLoading(true);
        try {
            await fetch(`/api/control`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
        } catch (error) {
            console.error('Failed to send control', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 max-w-4xl mx-auto pixel-fade-in">
            {/* Title */}
            <div className="mc-panel p-4">
                <h2 className="text-sm mc-text-white flex items-center gap-2 mb-2">
                    <Power className="w-5 h-5" />
                    SERVER CONTROLS
                </h2>
            </div>

            {/* Status Display */}
            <div className="mc-panel p-6">
                <div className="text-center space-y-4">
                    <div className="text-[10px] mc-text-gray uppercase">Current Status</div>

                    {/* Large Status Indicator */}
                    <div className={`inline-block px-8 py-4 border-4 border-black ${status === 'online' ? 'bg-[#55ff55]' :
                            status === 'starting' ? 'bg-[#ffff55]' :
                                'bg-[#ff5555]'
                        }`} style={{
                            boxShadow: status === 'online'
                                ? 'inset -2px -2px 0 0 #155515, inset 2px 2px 0 0 #88ff88, 4px 4px 0 0 rgba(0,0,0,0.3)'
                                : status === 'starting'
                                    ? 'inset -2px -2px 0 0 #555515, inset 2px 2px 0 0 #ffff88, 4px 4px 0 0 rgba(0,0,0,0.3)'
                                    : 'inset -2px -2px 0 0 #551515, inset 2px 2px 0 0 #ff8888, 4px 4px 0 0 rgba(0,0,0,0.3)'
                        }}>
                        <div className={`text-2xl font-bold uppercase ${status === 'online' ? 'text-black' :
                                status === 'starting' ? 'text-black' :
                                    'text-white'
                            }`} style={{
                                textShadow: status === 'online'
                                    ? '2px 2px 0 #155515'
                                    : status === 'starting'
                                        ? '2px 2px 0 #555515'
                                        : '2px 2px 0 #551515'
                            }}>
                            {status}
                        </div>
                    </div>
                </div>
            </div>

            {/* Control Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Start Button */}
                <button
                    onClick={() => sendControl('start')}
                    disabled={status !== 'offline' || loading}
                    className={`mc-button p-6 text-sm flex flex-col items-center gap-3 ${status === 'offline'
                            ? 'bg-[#55ff55] text-black hover:brightness-110'
                            : 'bg-[#5a5a5a] text-[#2a2a2a]'
                        }`}
                >
                    <Play fill="currentColor" className="w-8 h-8" />
                    <span>START SERVER</span>
                </button>

                {/* Stop Button */}
                <button
                    onClick={() => sendControl('stop')}
                    disabled={status === 'offline' || loading}
                    className={`mc-button p-6 text-sm flex flex-col items-center gap-3 ${status !== 'offline'
                            ? 'bg-[#ff5555] text-white hover:brightness-110'
                            : 'bg-[#5a5a5a] text-[#2a2a2a]'
                        }`}
                >
                    <Square fill="currentColor" className="w-8 h-8" />
                    <span>STOP SERVER</span>
                </button>
            </div>

            {/* Info Panel */}
            <div className="mc-panel-dark p-4">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] mc-text-gray">READY TO PLAY</span>
                        <span className={`text-[10px] font-bold ${status === 'online' ? 'mc-text-green' : 'mc-text-red'
                            }`}>
                            {status === 'online' ? 'YES' : 'NO'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] mc-text-gray">LOADING</span>
                        <span className={`text-[10px] font-bold ${loading ? 'mc-text-yellow' : 'mc-text-gray'
                            }`}>
                            {loading ? 'YES' : 'NO'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
