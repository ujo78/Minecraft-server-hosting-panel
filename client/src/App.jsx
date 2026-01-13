import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Terminal, HardDrive, Play, Square, Settings, Menu, Users } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Console from './components/Console';
import ModManager from './components/ModManager';
import Players from './components/Players';
import ServerSelector from './components/ServerSelector';

const socket = io();

function App() {
    const [status, setStatus] = useState('offline');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeServerId, setActiveServerId] = useState(null);

    useEffect(() => {
        // Fetch initial active server
        fetch('/api/servers')
            .then(res => res.json())
            .then(data => {
                if (data.activeId) setActiveServerId(data.activeId);
            })
            .catch(err => console.error("Failed to fetch active server", err));

        socket.on('status', (newStatus) => {
            setStatus(newStatus);
        });

        return () => {
            socket.off('status');
        };
    }, []);

    const handleServerSwitch = (newId) => {
        setActiveServerId(newId);
        setStatus('offline');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard socket={socket} status={status} />;
            case 'console': return <Console socket={socket} />;
            case 'players': return <Players socket={socket} />;
            case 'mods': return <ModManager />;
            default: return <Dashboard socket={socket} status={status} />;
        }
    };

    return (
        <div className="flex h-screen overflow-hidden">
            {/* Minecraft-style Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 mc-panel-dark transition-transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
                {/* Logo Header */}
                <div className="p-4 border-b-4 border-black bg-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#55ff55] border-2 border-black flex items-center justify-center" style={{
                            boxShadow: 'inset -1px -1px 0 0 #155515, inset 1px 1px 0 0 #88ff88'
                        }}>
                            <span className="text-black font-bold text-xs">M</span>
                        </div>
                        <h1 className="text-xs mc-text-green">MC PANEL</h1>
                    </div>
                    <button onClick={() => setMobileMenuOpen(false)} className="md:hidden absolute top-4 right-4 text-white">
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Navigation Buttons */}
                <nav className="p-3 space-y-2">
                    <NavButton
                        icon={<Settings className="w-4 h-4" />}
                        label="Dashboard"
                        active={activeTab === 'dashboard'}
                        onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
                    />
                    <NavButton
                        icon={<Terminal className="w-4 h-4" />}
                        label="Console"
                        active={activeTab === 'console'}
                        onClick={() => { setActiveTab('console'); setMobileMenuOpen(false); }}
                    />
                    <NavButton
                        icon={<Users className="w-4 h-4" />}
                        label="Players"
                        active={activeTab === 'players'}
                        onClick={() => { setActiveTab('players'); setMobileMenuOpen(false); }}
                    />
                    <NavButton
                        icon={<HardDrive className="w-4 h-4" />}
                        label="Mods"
                        active={activeTab === 'mods'}
                        onClick={() => { setActiveTab('mods'); setMobileMenuOpen(false); }}
                    />
                </nav>

                {/* Status Footer */}
                <div className="absolute bottom-0 w-full p-3 border-t-4 border-black bg-[#2a2a2a]">
                    <div className="mc-panel p-2">
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 border-2 border-black ${status === 'online' ? 'bg-[#55ff55]' :
                                    status === 'starting' ? 'bg-[#ffff55]' :
                                        'bg-[#ff5555]'
                                }`} style={{
                                    boxShadow: status === 'online'
                                        ? 'inset -1px -1px 0 0 #155515, inset 1px 1px 0 0 #88ff88'
                                        : status === 'starting'
                                            ? 'inset -1px -1px 0 0 #555515, inset 1px 1px 0 0 #ffff88'
                                            : 'inset -1px -1px 0 0 #551515, inset 1px 1px 0 0 #ff8888'
                                }}></div>
                            <div>
                                <div className={`text-[8px] font-bold uppercase ${status === 'online' ? 'mc-text-green' :
                                        status === 'starting' ? 'mc-text-yellow' :
                                            'mc-text-red'
                                    }`}>{status}</div>
                                <div className="text-[6px] mc-text-gray">Server</div>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* Mobile Header */}
                <div className="md:hidden mc-panel-dark p-3 border-b-4 border-black flex justify-between items-center">
                    <h1 className="text-xs mc-text-white">MC Panel</h1>
                    <button onClick={() => setMobileMenuOpen(true)} className="mc-button bg-[#8b8b8b] text-white px-3 py-2">
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    <ServerSelector
                        activeServerId={activeServerId}
                        onServerSwitch={handleServerSwitch}
                    />
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}

// Minecraft-style Navigation Button
const NavButton = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-2 px-3 py-3 text-[8px] font-bold uppercase mc-button ${active
                ? 'bg-[#55ff55] text-black'
                : 'bg-[#8b8b8b] text-white hover:bg-[#a0a0a0]'
            }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

export default App;
