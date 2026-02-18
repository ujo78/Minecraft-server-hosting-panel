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
        <div className="flex flex-col h-[calc(100vh-140px)] glass-panel overflow-hidden relative group">
            <div className="bg-black/40 p-3 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-[#52eb34]" />
                    <span className="font-['Fira_Code'] text-sm text-gray-400">root@minecraft-server:~#</span>
                </div>
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-['Fira_Code'] text-sm space-y-1 bg-black/80 custom-scrollbar relative">
                {/* CRT Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20"></div>

                {logs.length === 0 && <div className="text-gray-600 italic font-mono opacity-50">Waiting for logs...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="break-words text-gray-300 whitespace-pre-wrap relative z-0 pl-2 border-l-2 border-transparent hover:border-[#52eb34]/50 hover:bg-white/5 transition-colors">
                        <span className="text-gray-600 mr-3 select-none">[{new Date().toLocaleTimeString()}]</span>
                        <span dangerouslySetInnerHTML={{ __html: log.replace(/\u001b\[[0-9;]*m/g, '') }}></span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            <form onSubmit={sendCommand} className="p-3 bg-black/60 border-t border-white/5 flex gap-2 relative z-20">
                <div className="flex-1 relative group-focus-within:shadow-[0_0_15px_rgba(82,235,52,0.1)] transition-shadow rounded-md">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#52eb34] font-bold font-['VT323'] text-xl">{'>'}</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type a command..."
                        className="w-full bg-black/50 text-[#52eb34] rounded-md pl-8 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#52eb34] border border-white/10 placeholder-gray-700 font-mono transition-all"
                    />
                </div>
                <button
                    type="submit"
                    className="minecraft-btn minecraft-btn-primary !py-0 !px-4 flex items-center justify-center"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
