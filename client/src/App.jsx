import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Terminal, HardDrive, Play, Square, Settings, Menu, Users, BarChart2, Package, Save, FileText, List } from 'lucide-react';
import Dashboard from './components/Dashboard';
import Console from './components/Console';
import ModManager from './components/ModManager';
import Players from './components/Players';
import ServerSelector from './components/ServerSelector';
import MetricsDashboard from './components/MetricsDashboard';
import PluginManager from './components/PluginManager';
import ResourceMonitor from './components/ResourceMonitor';
import BackupManager from './components/BackupManager';
import PropertiesEditor from './components/PropertiesEditor';
import WhitelistManager from './components/WhitelistManager';
import FileBrowser from './components/FileBrowser';

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
        // Refresh status/console by reconnecting socket? 
        // Socket events are global but backend emits based on current process.
        // Backend handles switching the process.
        // We might want to clear console or something, but basic switch is enough.
        setStatus('offline'); // Assume offline until status update
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard socket={socket} status={status} />;
            case 'console': return <Console socket={socket} />;
            case 'metrics': return <MetricsDashboard serverId={activeServerId} />;
            case 'players': return <Players socket={socket} />;
            case 'mods': return <ModManager serverId={activeServerId} />; // Pass serverId!
            case 'plugins': return <PluginManager serverId={activeServerId} />;
            case 'files': return <FileBrowser serverId={activeServerId} />;
            case 'resources': return <ResourceMonitor serverId={activeServerId} />;
            case 'backups': return <BackupManager serverId={activeServerId} />;
            case 'whitelist': return <WhitelistManager serverId={activeServerId} />;
            case 'settings': return <PropertiesEditor serverId={activeServerId} />;
            default: return <Dashboard socket={socket} status={status} />;
        }
    };

    return (
        <div className="flex h-screen bg-dark-900 text-white overflow-hidden">
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-700 transition-transform transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static`}>
                <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                    <h1 className="text-xl font-bold tracking-wider text-mc-green">MC PANEL</h1>
                    <button onClick={() => setMobileMenuOpen(false)} className="md:hidden">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
                <nav className="p-4 space-y-1 overflow-y-auto flex-1 custom-scrollbar">
                    <SidebarItem icon={<Settings className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Terminal className="w-5 h-5" />} label="Console" active={activeTab === 'console'} onClick={() => { setActiveTab('console'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<BarChart2 className="w-5 h-5" />} label="Metrics" active={activeTab === 'metrics'} onClick={() => { setActiveTab('metrics'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Users className="w-5 h-5" />} label="Players" active={activeTab === 'players'} onClick={() => { setActiveTab('players'); setMobileMenuOpen(false); }} />

                    <div className="pt-4 pb-1">
                        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</p>
                    </div>
                    <SidebarItem icon={<HardDrive className="w-5 h-5" />} label="Mods" active={activeTab === 'mods'} onClick={() => { setActiveTab('mods'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Package className="w-5 h-5" />} label="Plugins" active={activeTab === 'plugins'} onClick={() => { setActiveTab('plugins'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<FileText className="w-5 h-5" />} label="Files" active={activeTab === 'files'} onClick={() => { setActiveTab('files'); setMobileMenuOpen(false); }} />

                    <div className="pt-4 pb-1">
                        <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">System</p>
                    </div>
                    <SidebarItem icon={<BarChart2 className="w-5 h-5" />} label="Resources" active={activeTab === 'resources'} onClick={() => { setActiveTab('resources'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Save className="w-5 h-5" />} label="Backups" active={activeTab === 'backups'} onClick={() => { setActiveTab('backups'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<List className="w-5 h-5" />} label="Whitelist" active={activeTab === 'whitelist'} onClick={() => { setActiveTab('whitelist'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Settings className="w-5 h-5" />} label="Properties" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setMobileMenuOpen(false); }} />
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t border-dark-700">
                    <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${status === 'online' ? 'bg-mc-green' : status === 'starting' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                        <span className="capitalize font-medium text-gray-400">{status}</span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full relative">
                <div className="md:hidden p-4 bg-dark-800 border-b border-dark-700 flex justify-between items-center">
                    <h1 className="text-lg font-bold">MC Panel</h1>
                    <button onClick={() => setMobileMenuOpen(true)}>
                        <Menu className="w-6 h-6" />
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-6">
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

const SidebarItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-mc-green text-black font-semibold' : 'text-gray-400 hover:bg-dark-700 hover:text-white'}`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

export default App;
