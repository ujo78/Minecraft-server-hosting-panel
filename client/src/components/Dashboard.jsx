import React, { useState } from 'react';
import { Play, Square, RefreshCw, Power } from 'lucide-react';

export default function Dashboard({ socket, status }) {
    const [loading, setLoading] = useState(false);

    const sendControl = async (action) => {
        setLoading(true);
        try {
            await fetch(`http://${window.location.hostname}:3000/api/control`, {
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
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-lg">
                <h2 className="text-2xl font-bold mb-6 text-gray-100 flex items-center gap-3">
                    <Power className="w-6 h-6 text-mc-green" /> Server Controls
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-dark-900 p-6 rounded-xl border border-dark-700 flex flex-col items-center justify-center space-y-4">
                        <span className="text-gray-400">Current Status</span>
                        <div className={`text-4xl font-bold uppercase tracking-wider ${status === 'online' ? 'text-mc-green' :
                            status === 'offline' ? 'text-red-500' : 'text-yellow-500'
                            }`}>
                            {status}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <button
                            onClick={() => sendControl('start')}
                            disabled={status !== 'offline' || loading}
                            className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-lg transition-all ${status === 'offline'
                                ? 'bg-mc-green text-black hover:bg-[#44cc44] hover:scale-[1.02]'
                                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <Play fill="currentColor" /> Start Server
                        </button>

                        <button
                            onClick={() => sendControl('stop')}
                            disabled={status === 'offline' || loading}
                            className={`flex-1 flex items-center justify-center gap-3 p-4 rounded-xl font-bold text-lg transition-all ${status !== 'offline'
                                ? 'bg-red-500 text-white hover:bg-red-600 hover:scale-[1.02]'
                                : 'bg-dark-700 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <Square fill="currentColor" /> Stop Server
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
