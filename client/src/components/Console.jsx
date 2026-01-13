import React, { useEffect, useRef, useState } from 'react';
import { Send, Terminal } from 'lucide-react';

export default function Console({ socket }) {
    const [logs, setLogs] = useState([]);
    const [command, setCommand] = useState('');
    const logsEndRef = useRef(null);

    useEffect(() => {
        socket.on('console', (data) => {
            setLogs((prev) => [...prev, data]);
        });

        return () => {
            socket.off('console');
        };
    }, [socket]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const sendCommand = (e) => {
        e.preventDefault();
        if (!command.trim()) return;

        socket.emit('command', command);
        setCommand('');
    };

    return (
        <div className="flex flex-col h-[calc(100vh-180px)] pixel-fade-in">
            {/* Terminal Header */}
            <div className="mc-panel p-3 mb-2">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 mc-text-green" />
                    <span className="text-[8px] mc-text-green">MINECRAFT CONSOLE</span>
                </div>
            </div>

            {/* Console Display */}
            <div className="flex-1 mc-panel-dark p-4 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-1 font-mono">
                    {logs.length === 0 && (
                        <div className="text-[10px] mc-text-gray">
                            &gt; Waiting for server output...
                        </div>
                    )}
                    {logs.map((log, i) => (
                        <div key={i} className="text-[10px] mc-text-white break-words whitespace-pre-wrap">
                            <span className="mc-text-green">[{new Date().toLocaleTimeString()}]</span> {log}
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>
            </div>

            {/* Command Input */}
            <form onSubmit={sendCommand} className="mt-2 flex gap-2">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#55ff55] font-bold text-sm z-10">
                        &gt;
                    </span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type command..."
                        className="w-full mc-input pl-8 text-[10px]"
                    />
                </div>
                <button
                    type="submit"
                    className="mc-button bg-[#55ff55] text-black px-6 py-3 flex items-center gap-2"
                >
                    <Send className="w-4 h-4" />
                    <span className="text-[10px]">SEND</span>
                </button>
            </form>
        </div>
    );
}
