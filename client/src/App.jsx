import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import {
    Terminal, HardDrive, Play, Square, Settings, Menu, Users, BarChart2,
    Package, Save, FileText, List, LogOut, Power, Server, ChevronDown,
    X, Cpu, MemoryStick
} from 'lucide-react';
import Console from './components/Console';
import ModManager from './components/ModManager';
import Players from './components/Players';
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
    withCredentials: true
});

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('offline');
    const [activeTab, setActiveTab] = useState('console');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [activeServerId, setActiveServerId] = useState(null);
    const [vmStatus, setVmStatus] = useState('unknown');
    const [agentReady, setAgentReady] = useState(false);
    const [vmWarning, setVmWarning] = useState(null);
    const [servers, setServers] = useState([]);
    const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
    const [controlLoading, setControlLoading] = useState(false);

    // Auth check
    useEffect(() => {
        fetch('/auth/user')
            .then(res => {
                if (res.ok) return res.json();
                throw new Error('Not authenticated');
            })
            .then(data => { setUser(data.user); setLoading(false); })
            .catch(() => { setUser(null); setLoading(false); });
    }, []);

    // Socket + data
    useEffect(() => {
        if (!user) return;

        const fetchServers = async () => {
            try {
                const res = await fetch('/api/servers');
                const data = await res.json();
                setServers(data.servers || []);
                if (data.activeId) setActiveServerId(data.activeId);
            } catch (err) {
                console.error("Failed to fetch servers", err);
            }
        };
        fetchServers();

        socket.on('status', setStatus);
        socket.on('vmStatus', (data) => {
            setVmStatus(data.status);
            if (data.agentReady !== undefined) setAgentReady(data.agentReady);
            if (data.status === 'stopped') setVmWarning(null);
        });
        socket.on('vmWarning', setVmWarning);

        fetch('/api/vm/status').then(r => r.json()).then(data => {
            setVmStatus(data.vmStatus || 'unknown');
            setAgentReady(data.agentReady || false);
        }).catch(() => { });

        return () => {
            socket.off('status');
            socket.off('vmStatus');
            socket.off('vmWarning');
        };
    }, [user]);

    const activeServer = servers.find(s => s.id === activeServerId);

    const handleServerSwitch = async (id) => {
        if (id === activeServerId) { setServerDropdownOpen(false); return; }
        if (!confirm("Switch to this server? The current server will stop.")) return;
        try {
            const res = await fetch('/api/servers/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                setActiveServerId(data.activeId);
                setStatus('offline');
                // Refresh server list
                const srvRes = await fetch('/api/servers');
                const srvData = await srvRes.json();
                setServers(srvData.servers || []);
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert("Failed to switch server");
        }
        setServerDropdownOpen(false);
    };

    const sendControl = async (action) => {
        setControlLoading(true);
        try {
            const res = await fetch('/api/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            console.log('Control response:', data);
            if (!res.ok) {
                console.error('Control failed:', data);
                alert(`Failed: ${data.error || data.message || 'Unknown error'}`);
            } else if (data.executed === false) {
                console.warn('Command not executed:', data.reason);
            }
        } catch (error) {
            console.error('Failed to send control', error);
            alert('Failed to reach the server. Is the Game VM running?');
        } finally {
            setControlLoading(false);
        }
    };

    const handleStartVM = async () => {
        setVmStatus('starting');
        const res = await fetch('/api/vm/start', { method: 'POST' });
        const data = await res.json();
        if (data.success) { setVmStatus('running'); setAgentReady(data.agentReady); }
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

    const handleLogout = () => { window.location.href = '/auth/logout'; };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#0a0a0f] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    if (!user) return <Login onLogin={setUser} />;

    const navItems = [
        { id: 'console', icon: <Terminal className="w-4 h-4" />, label: 'Console' },
        { id: 'players', icon: <Users className="w-4 h-4" />, label: 'Players' },
        { id: 'metrics', icon: <BarChart2 className="w-4 h-4" />, label: 'Metrics' },
        { id: 'mods', icon: <HardDrive className="w-4 h-4" />, label: 'Mods' },
        { id: 'plugins', icon: <Package className="w-4 h-4" />, label: 'Plugins' },
        { id: 'files', icon: <FileText className="w-4 h-4" />, label: 'Files' },
        { id: 'resources', icon: <Cpu className="w-4 h-4" />, label: 'Resources' },
        { id: 'backups', icon: <Save className="w-4 h-4" />, label: 'Backups' },
        { id: 'whitelist', icon: <List className="w-4 h-4" />, label: 'Whitelist' },
        { id: 'settings', icon: <Settings className="w-4 h-4" />, label: 'Properties' },
    ];

    const renderContent = () => {
        switch (activeTab) {
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
            default: return <Console socket={socket} />;
        }
    };

    const statusColor = status === 'online' ? 'text-emerald-400' :
        status === 'offline' ? 'text-red-400' : 'text-amber-400';
    const statusDot = status === 'online' ? 'bg-emerald-400' :
        status === 'offline' ? 'bg-red-400' : 'bg-amber-400';

    return (
        <div className="flex flex-col h-screen bg-[#0a0a0f] text-white overflow-hidden">
            {/* VM Status Banner */}
            <VMStatusBanner
                vmStatus={vmStatus}
                agentReady={agentReady}
                warning={vmWarning}
                onStartVM={handleStartVM}
                onStopVM={handleStopVM}
            />

            {/* ── Top Header ── */}
            <header className="h-14 bg-[#111118] border-b border-[#1e1e2e] flex items-center px-4 gap-4 shrink-0 z-40">
                {/* Mobile menu toggle */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-gray-400 hover:text-white">
                    <Menu className="w-5 h-5" />
                </button>

                {/* Logo */}
                <div className="flex items-center gap-2 mr-4">
                    <Server className="w-5 h-5 text-emerald-500" />
                    <span className="font-bold text-sm tracking-wider text-emerald-500 hidden sm:inline">MC PANEL</span>
                </div>

                {/* Server Switcher Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                        className="flex items-center gap-2 bg-[#1a1a24] hover:bg-[#22222e] border border-[#2a2a3a] rounded-lg px-3 py-1.5 transition-colors"
                    >
                        {activeServer?.icon && (
                            <img src={activeServer.icon} alt="" className="w-5 h-5 rounded object-cover" />
                        )}
                        <span className="text-sm font-medium text-gray-200 max-w-[150px] truncate">
                            {activeServer?.name || 'No Server'}
                        </span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${serverDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {serverDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setServerDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-1 w-72 bg-[#15151f] border border-[#2a2a3a] rounded-xl shadow-2xl z-50 overflow-hidden">
                                <div className="p-2 border-b border-[#2a2a3a]">
                                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-2">Switch Server</span>
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1">
                                    {servers.map(srv => (
                                        <button
                                            key={srv.id}
                                            onClick={() => handleServerSwitch(srv.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${srv.id === activeServerId
                                                ? 'bg-emerald-500/10 text-emerald-400'
                                                : 'hover:bg-[#1e1e2e] text-gray-300'
                                                }`}
                                        >
                                            <img
                                                src={srv.icon || 'https://via.placeholder.com/32'}
                                                alt=""
                                                className={`w-8 h-8 rounded-lg object-cover ${srv.id !== activeServerId ? 'opacity-60' : ''}`}
                                            />
                                            <div className="flex-1 text-left min-w-0">
                                                <div className="text-sm font-medium truncate">{srv.name}</div>
                                                <div className="text-[11px] text-gray-500">
                                                    {srv.memory ? `${(srv.memory / 1024).toFixed(1)}GB RAM` : '2GB RAM'} • Port {srv.port || 25565}
                                                </div>
                                            </div>
                                            {srv.id === activeServerId && (
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Server Status + Controls */}
                <div className="flex items-center gap-3 ml-auto">
                    {/* Status indicator */}
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${statusDot} ${status === 'online' ? 'animate-pulse' : ''}`} />
                        <span className={`text-xs font-semibold uppercase tracking-wider ${statusColor}`}>
                            {status}
                        </span>
                    </div>

                    {/* Start/Stop buttons */}
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => sendControl('start')}
                            disabled={status !== 'offline' || controlLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'offline'
                                ? 'bg-emerald-500 text-black hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-[#1a1a24] text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            <Play className="w-3.5 h-3.5" fill="currentColor" /> Start
                        </button>
                        <button
                            onClick={() => sendControl('stop')}
                            disabled={status === 'offline' || controlLoading}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${status !== 'offline'
                                ? 'bg-red-500/90 text-white hover:bg-red-500 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-[#1a1a24] text-gray-600 cursor-not-allowed'
                                }`}
                        >
                            <Square className="w-3 h-3" fill="currentColor" /> Stop
                        </button>
                    </div>

                    {/* User + Logout */}
                    <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-[#2a2a3a]">
                        <span className="text-xs text-gray-500">{user.username}</span>
                        <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 transition-colors" title="Sign Out">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main Layout ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Navigation Tabs — horizontal on desktop, slide-in on mobile */}
                <nav className={`
                    fixed inset-y-0 left-0 z-30 w-56 bg-[#111118] border-r border-[#1e1e2e] transform transition-transform
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:static md:translate-x-0 md:w-48 shrink-0 flex flex-col
                `}>
                    {/* Mobile close button */}
                    <div className="md:hidden flex justify-between items-center p-4 border-b border-[#1e1e2e]">
                        <span className="text-sm font-bold text-emerald-500">Navigation</span>
                        <button onClick={() => setMobileMenuOpen(false)}>
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                        {navItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${activeTab === item.id
                                    ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a24]'
                                    }`}
                            >
                                {item.icon}
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Mobile logout */}
                    <div className="md:hidden p-3 border-t border-[#1e1e2e]">
                        <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-400 p-2 rounded-lg text-sm">
                            <LogOut className="w-4 h-4" /> Sign Out
                        </button>
                    </div>
                </nav>

                {/* Mobile overlay */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setMobileMenuOpen(false)} />
                )}

                {/* Content Area */}
                <main className="flex-1 overflow-y-auto">
                    {/* Active Server Info Bar */}
                    {activeServer && (
                        <div className="bg-[#111118] border-b border-[#1e1e2e] px-4 py-2 flex items-center gap-3">
                            <img src={activeServer.icon || 'https://via.placeholder.com/24'} alt="" className="w-6 h-6 rounded object-cover" />
                            <span className="text-sm font-medium text-gray-300">{activeServer.name}</span>
                            <span className="text-[11px] text-gray-600">•</span>
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <MemoryStick className="w-3 h-3" />
                                {activeServer.memory ? `${(activeServer.memory / 1024).toFixed(1)}GB` : '2GB'}
                            </span>
                            <span className="text-[11px] text-gray-600">•</span>
                            <span className="text-[11px] text-gray-500">Port {activeServer.port || 25565}</span>
                        </div>
                    )}

                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default App;
