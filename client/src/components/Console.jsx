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
        <div className="flex flex-col h-[calc(100vh-140px)] bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden shadow-lg">
            <div className="bg-dark-900 p-4 border-b border-dark-700 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-gray-400" />
                <span className="font-mono text-sm text-gray-400">root@minecraft-server:~#</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 font-mono text-sm space-y-1 bg-black">
                {logs.length === 0 && <div className="text-gray-600 italic">No logs yet...</div>}
                {logs.map((log, i) => (
                    <div key={i} className="break-words text-gray-300 whitespace-pre-wrap">
                        <span className="text-gray-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                        {log}
                    </div>
                ))}
                <div ref={logsEndRef} />
            </div>

            <form onSubmit={sendCommand} className="p-4 bg-dark-900 border-t border-dark-700 flex gap-2">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-mc-green font-bold">{'>'}</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => setCommand(e.target.value)}
                        placeholder="Type a command..."
                        className="w-full bg-dark-800 text-white rounded-lg pl-8 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-mc-green border border-dark-700 placeholder-gray-600"
                    />
                </div>
                <button
                    type="submit"
                    className="bg-mc-green text-black p-3 rounded-lg hover:bg-[#44cc44] transition-colors"
                >
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
