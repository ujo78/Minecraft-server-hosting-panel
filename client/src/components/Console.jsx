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
        <div className="flex flex-col h-[calc(100vh-140px)] sci-fi-panel overflow-hidden relative group">
            {/* Corner Accents */}
            <div className="corner-accent corner-accent-tl"></div>
            <div className="corner-accent corner-accent-tr corner-accent-purple"></div>
            <div className="corner-accent corner-accent-bl"></div>
            <div className="corner-accent corner-accent-br corner-accent-purple"></div>

            <div className="bg-black/60 p-3 border-b border-[#00f0ff]/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Terminal className="w-5 h-5 text-[#00f0ff]" />
                    <span className="font-['Fira_Code'] text-sm text-[#00f0ff]/70">root@minecraft-server:~#</span>
                </div>
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]/20 border border-[#ef4444]/50"></div>
                    <div className="w-3 h-3 rounded-full bg-[#fbbf24]/20 border border-[#fbbf24]/50"></div>
                    <div className="w-3 h-3 rounded-full bg-[#00f0ff]/20 border border-[#00f0ff]/50 animate-pulse"></div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-['Fira_Code'] text-sm space-y-1 bg-black/80 custom-scrollbar relative">
                {/* CRT Scanline Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%] opacity-20"></div>

                {logs.length === 0 && <div className="text-[#00f0ff]/30 italic font-mono animate-pulse">&gt; Waiting for system logs...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="break-words text-gray-300 whitespace-pre-wrap relative z-0 pl-2 border-l-2 border-transparent hover:border-[#00f0ff]/50 hover:bg-white/5 transition-colors">
                        <span className="text-[#b829dd] mr-3 select-none">[{new Date().toLocaleTimeString()}]</span>
                        <span dangerouslySetInnerHTML={{ __html: log.replace(/\u001b\[[0-9;]*m/g, '') }}></span>
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            <form onSubmit={sendCommand} className="p-3 bg-black/60 border-t border-[#00f0ff]/20 flex gap-2 relative z-20">
                <div className="flex-1 relative group-focus-within:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-shadow rounded-md">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#00f0ff] font-bold font-['VT323'] text-xl">{'>'}</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type a command..."
                        className="w-full bg-black/50 text-[#00f0ff] rounded-md pl-8 pr-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00f0ff] border border-[#00f0ff]/20 placeholder-[#00f0ff]/30 font-mono transition-all"
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
