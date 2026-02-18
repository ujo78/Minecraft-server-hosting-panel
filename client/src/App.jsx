import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Terminal, HardDrive, Play, Square, Settings, Menu, Users, BarChart2, Package, Save, FileText, List, LogOut } from 'lucide-react';
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
import Login from './components/Login';
import VMStatusBanner from './components/VMStatusBanner';

const socket = io({
    withCredentials: true // Important for cookies!
});

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('offline');
    const [activeTab, setActiveTab] = useState('dashboard');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeServerId, setActiveServerId] = useState(null);
    const [vmStatus, setVmStatus] = useState('unknown');
    const [agentReady, setAgentReady] = useState(false);
    const [vmWarning, setVmWarning] = useState(null);

    // Initial Auth Check
    useEffect(() => {
        fetch('/auth/user')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Not authenticated');
            })
            .then(data => {
                setUser(data.user);
                setLoading(false);
            })
            .catch(() => {
                setUser(null);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (!user) return; // Don't fetch if not logged in

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

        // VM lifecycle events
        socket.on('vmStatus', (data) => {
            setVmStatus(data.status);
            if (data.agentReady !== undefined) setAgentReady(data.agentReady);
            if (data.status === 'stopped') setVmWarning(null);
        });

        socket.on('vmWarning', (data) => {
            setVmWarning(data);
        });

        // Handle unauthorized socket event
        socket.on('connect_error', (err) => {
            console.log("Socket connection error", err);
        });

        // Fetch initial VM status
        fetch('/api/vm/status').then(r => r.json()).then(data => {
            setVmStatus(data.vmStatus || 'unknown');
            setAgentReady(data.agentReady || false);
        }).catch(() => { });

        return () => {
            socket.off('status');
            socket.off('vmStatus');
            socket.off('vmWarning');
            socket.off('connect_error');
        };
    }, [user]); // Re-run when user logs in

    const handleServerSwitch = (newId) => {
        setActiveServerId(newId);
        setStatus('offline');
    };

    const handleLogout = async () => {
        try {
            window.location.href = '/auth/logout';
        } catch (err) {
            console.error("Logout failed", err);
        }
    };

    const handleStartVM = async () => {
        setVmStatus('starting');
        const res = await fetch('/api/vm/start', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            setVmStatus('running');
            setAgentReady(data.agentReady);
        }
        return data;
    };

    const handleStopVM = async () => {
        setVmStatus('stopping');
        const res = await fetch('/api/vm/stop', { method: 'POST' });
        const data = await res.json();
        setVmStatus('stopped');
        setAgentReady(false);
        return data;
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-dark-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-green"></div>
            </div>
        );
    }

    if (!user) {
        return <Login onLogin={setUser} />;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard': return <Dashboard socket={socket} status={status} />;
            case 'console': return <Console socket={socket} />;
            case 'metrics': return <MetricsDashboard serverId={activeServerId} />;
            case 'players': return <Players socket={socket} />;
            case 'mods': return <ModManager serverId={activeServerId} />;
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
            <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-dark-800 border-r border-dark-700 transition-transform transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static flex flex-col`}>
                <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                    <h1 className="text-xl font-bold tracking-wider text-mc-green">MC PANEL</h1>
                    <button onClick={() => setMobileMenuOpen(false)} className="md:hidden">
                        <Menu className="w-6 h-6" />
                    </button>
                </div>

                <div className="px-6 py-2">
                    <p className="text-xs text-gray-500">Logged in as {user.username}</p>
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

                <div className="p-4 border-t border-dark-700">
                    <div className="mb-4">
                        <ServerSelector
                            activeServerId={activeServerId}
                            onServerSwitch={handleServerSwitch}
                        />
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-md transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 overflow-x-hidden overflow-y-auto bg-dark-900">
                <VMStatusBanner
                    vmStatus={vmStatus}
                    agentReady={agentReady}
                    warning={vmWarning}
                    onStartVM={handleStartVM}
                    onStopVM={handleStopVM}
                />
                <div className="md:hidden p-4 bg-dark-800 border-b border-dark-700 flex justify-between items-center">
                    <h1 className="text-lg font-bold text-white">
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                    </h1>
                    <button onClick={() => setMobileMenuOpen(true)}>
                        <Menu className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {renderContent()}
                </div>
            </main>
        </div>
    );
}

function SidebarItem({ icon, label, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-md transition-colors ${active
                ? 'bg-gradient-to-r from-mc-green/20 to-transparent text-mc-green border-r-2 border-mc-green'
                : 'text-gray-400 hover:bg-dark-700 hover:text-white'
                }`}
        >
            {icon}
            <span className="font-medium text-sm">{label}</span>
        </button>
    );
}

export default App;
