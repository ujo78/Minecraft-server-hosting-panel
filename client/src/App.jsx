import React, { useState, useEffect, Suspense } from 'react';
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
import TargetCursor from './components/ReactBits/TargetCursor';
import BounceCards from './components/ReactBits/BounceCards';



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
    const [inactivityStatus, setInactivityStatus] = useState(null);
    const [servers, setServers] = useState([]);
    const [serverDropdownOpen, setServerDropdownOpen] = useState(false);
    const [controlLoading, setControlLoading] = useState(false);
    const [switchLoading, setSwitchLoading] = useState(false);
    const [pendingSwitch, setPendingSwitch] = useState(null); // { id, name }

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
            if (data.status === 'stopped') {
                setVmWarning(null);
                setInactivityStatus(prev => prev ? { ...prev, running: false } : null);
            }
        });
        socket.on('vmWarning', setVmWarning);
        socket.on('inactivityStatus', setInactivityStatus);

        // Fetch live status via REST (catches externally started servers)
        const seedStatus = async () => {
            try {
                const [vmRes, gameRes] = await Promise.all([
                    fetch('/api/vm/status'),
                    fetch('/api/status')
                ]);
                if (vmRes.ok) {
                    const d = await vmRes.json();
                    setVmStatus(d.vmStatus || 'unknown');
                    setAgentReady(d.agentReady || false);
                    if (d.inactivity) setInactivityStatus(d.inactivity);
                }
                if (gameRes.ok) {
                    const d = await gameRes.json();
                    if (d.status) setStatus(d.status);
                }
            } catch { /* ignore */ }
        };
        seedStatus();

        return () => {
            socket.off('status');
            socket.off('vmStatus');
            socket.off('vmWarning');
            socket.off('inactivityStatus');
        };
    }, [user]);

    const activeServer = servers.find(s => s.id === activeServerId);

    // Step 1: gate by status, then open the confirmation modal
    const handleServerSwitch = (id) => {
        if (id === activeServerId || switchLoading) return;
        const serverName = servers.find(s => s.id === id)?.name || id;
        setServerDropdownOpen(false);

        // Block during transitional states — no modal, just a toast-style alert
        if (status === 'starting' || status === 'stopping') {
            alert('Please wait for the current server to finish working.');
            return;
        }

        // Block if server is running — tell user to stop first
        if (status === 'online') {
            alert('Please stop the current server before switching.');
            return;
        }

        // Server is offline/crashed — show confirmation modal
        setPendingSwitch({ id, name: serverName });
    };

    // Step 2: user confirmed in the modal — now do the actual switch
    const confirmSwitch = async () => {
        if (!pendingSwitch) return;
        const { id } = pendingSwitch;
        setPendingSwitch(null);
        setSwitchLoading(true);
        try {
            const res = await fetch('/api/servers/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setActiveServerId(data.activeId);
                setStatus('offline');
                const srvRes = await fetch('/api/servers');
                const srvData = await srvRes.json();
                setServers(srvData.servers || []);
            } else {
                alert(data.error || `Switch failed (${res.status})`);
            }
        } catch (err) {
            alert(`Network error: ${err.message}`);
        } finally {
            setSwitchLoading(false);
        }
    };


    const sendControl = (action) => {
        setControlLoading(true);
        console.log('Sending command via socket:', action);
        socket.emit('command', action);
        // Status updates come back via the 'status' socket event
        setTimeout(() => setControlLoading(false), 2000);
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

    const statusColor = status === 'online' ? 'text-[#00f0ff]' :
        status === 'offline' ? 'text-[#ef4444]' : 'text-[#fbbf24]';
    const statusDot = status === 'online' ? 'bg-[#00f0ff]' :
        status === 'offline' ? 'bg-[#ef4444]' : 'bg-[#fbbf24]';

    return (
        <div className="flex flex-col h-screen text-gray-200 overflow-hidden font-sans selection:bg-[#00f0ff]/30">
            {/* Global Target Cursor - PRESERVED */}
            <TargetCursor 
              spinDuration={2}
              hideDefaultCursor={true}
              parallaxOn={true}
              hoverDuration={0.2}
            />



            {/* VM Status Banner - Floating & Glass */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl pointer-events-none">
                <div className="pointer-events-auto">
                    <VMStatusBanner
                        vmStatus={vmStatus}
                        agentReady={agentReady}
                        warning={vmWarning}
                        inactivityStatus={inactivityStatus}
                        onStartVM={handleStartVM}
                        onStopVM={handleStopVM}
                    />
                </div>
            </div>

            {/* ── Top Header ── */}
            <header className="h-16 flex items-center px-6 gap-6 shrink-0 z-40 relative">
                {/* Sci-Fi Panel Background */}
                <div className="absolute inset-x-4 top-4 bottom-0 sci-fi-panel opacity-95 z-[-1]">
                    <div className="corner-accent corner-accent-tl"></div>
                    <div className="corner-accent corner-accent-tr"></div>
                    <div className="corner-accent corner-accent-bl"></div>
                    <div className="corner-accent corner-accent-br"></div>
                </div>

                {/* Mobile menu toggle */}
                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-gray-400 hover:text-white">
                    <Menu className="w-6 h-6" />
                </button>

                {/* Logo */}
                <div className="flex items-center gap-3 mr-4">
                    <div className="hex-icon w-10 h-10 transform rotate-0 shadow-[0_0_15px_rgba(0,240,255,0.3)]">
                        <Server className="w-5 h-5 text-[#00f0ff]" strokeWidth={2} />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-['VT323'] text-2xl leading-none text-white tracking-widest drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
                            MC<span className="text-[#00f0ff]">PANEL</span>
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Control Center</span>
                    </div>
                </div>

                {/* Server Switcher Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setServerDropdownOpen(!serverDropdownOpen)}
                        className="flex items-center gap-3 bg-black/40 hover:bg-black/60 border border-[#00f0ff]/30 rounded px-4 py-2 transition-all group backdrop-blur-sm hover:border-[#00f0ff]/60 hover:shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                    >
                        {activeServer?.icon ? (
                            <img src={activeServer.icon} alt="" className="w-6 h-6 rounded object-cover ring-2 ring-white/10 group-hover:ring-[#00f0ff]/50 transition-all" />
                        ) : (
                            <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center border border-[#00f0ff]/20">
                                <Server className="w-3 h-3 text-[#00f0ff]" />
                            </div>
                        )}
                        <span className="text-sm font-bold text-gray-200 uppercase tracking-wide max-w-[150px] truncate font-['Rajdhani']">
                            {activeServer?.name || 'No Server'}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-[#00f0ff] transition-transform ${serverDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {serverDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center cursor-default" onClick={() => setServerDropdownOpen(false)}>
                                <h3 className="text-4xl font-['VT323'] text-[#00f0ff] mb-12 uppercase tracking-widest drop-shadow-[0_0_15px_rgba(0,240,255,0.8)]">Select Server</h3>
                                <div onClick={(e) => e.stopPropagation()} className="relative flex justify-center w-full max-w-4xl px-4">
                                    {servers.length > 0 ? (
                                        <BounceCards
                                            className="custom-bounceCards scale-110 sm:scale-125 md:scale-150"
                                            images={servers.map(s => s.icon || `https://via.placeholder.com/400/0a0a0f/00f0ff?text=${encodeURIComponent(s.name)}`)}
                                            containerWidth={600}
                                            containerHeight={300}
                                            animationDelay={0.1}
                                            animationStagger={0.08}
                                            easeType="elastic.out(1, 0.5)"
                                            transformStyles={
                                                servers.map((_, i) => {
                                                    const baseOffset = (i - Math.floor(servers.length / 2)) * 80;
                                                    const rot = (i - Math.floor(servers.length / 2)) * 4;
                                                    return `rotate(${rot}deg) translate(${baseOffset}px)`;
                                                })
                                            }
                                            enableHover={true}
                                            onCardClick={(idx) => handleServerSwitch(servers[idx].id)}
                                        />
                                    ) : (
                                        <div className="text-gray-400 font-mono">No servers available.</div>
                                    )}
                                </div>
                                <div className="absolute bottom-10 animate-bounce text-[#00f0ff] text-sm font-mono tracking-widest">CLICK ANYWHERE TO DISMISS</div>
                            </div>
                        </>
                    )}
                </div>

                {/* Controls Area */}
                <div className="flex items-center gap-4 ml-auto">
                    {/* Status Badge */}
                    <div className={`
                        flex items-center gap-2.5 px-3 py-1.5 rounded bg-black/40 border backdrop-blur-md
                        ${status === 'online' ? 'border-[#00f0ff]/30 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'border-white/10'}
                    `}>
                        <div className={`w-2.5 h-2.5 rounded-sm rotate-45 ${statusDot} ${status === 'online' ? 'shadow-[0_0_8px_#00f0ff] animate-pulse' : ''}`} />
                        <span className={`text-sm font-bold uppercase tracking-wider font-['VT323'] text-lg ${statusColor}`}>
                            {status}
                        </span>
                    </div>

                    {/* Start/Stop Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => sendControl('start')}
                            disabled={status !== 'offline' || controlLoading}
                            className={`minecraft-btn ${status === 'offline' ? 'minecraft-btn-primary hover:scale-105' : 'opacity-50 grayscale cursor-not-allowed'}`}
                        >
                            <span className="flex items-center gap-2 text-sm">
                                <Play className="w-4 h-4 fill-current" /> START
                            </span>
                        </button>

                        <button
                            onClick={() => sendControl('stop')}
                            disabled={status === 'offline' || controlLoading}
                            className={`minecraft-btn ${status !== 'offline' ? 'minecraft-btn-danger hover:scale-105' : 'opacity-50 grayscale cursor-not-allowed'}`}
                        >
                            <span className="flex items-center gap-2 text-sm">
                                <Square className="w-4 h-4 fill-current" /> STOP
                            </span>
                        </button>
                    </div>

                    {/* User Profile */}
                    <div className="hidden sm:flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                        <div className="text-right hidden lg:block">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Operator</div>
                            <div className="text-sm font-medium text-white leading-none mt-0.5">{user.username}</div>
                        </div>
                        <button onClick={handleLogout} className="p-2 hover:bg-red-500/10 hover:text-red-400 rounded transition-colors group relative" title="Sign Out">
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main Layout ── */}
            <div className="flex flex-1 overflow-hidden pt-6 pb-4 px-4 gap-4">
                {/* Navigation Sidebar - Glass Panel */}
                <nav className={`
                    fixed inset-y-0 left-0 z-30 w-64 bg-[#0a0a0f] border-r border-[#1e1e2e] transform transition-transform duration-300
                    ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:static md:translate-x-0 md:bg-transparent md:border-none md:w-60 md:shrink-0 flex flex-col glass-panel opacity-90
                `}>
                    {/* Mobile header */}
                    <div className="md:hidden flex justify-between items-center p-4 border-b border-white/10">
                        <span className="text-lg font-['VT323'] text-[#52eb34]">MENU</span>
                        <button onClick={() => setMobileMenuOpen(false)}>
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>

                    <div className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
                        {navItems.map(item => {
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                                    className={`
                                        w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative overflow-hidden
                                        ${isActive ? 'nav-active' : 'text-gray-400 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    {/* Active Background Glow */}
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff]/20 to-transparent border-l-3 border-[#00f0ff]" />
                                    )}

                                    <div className={`relative z-10 transition-transform group-hover:scale-110 ${isActive ? 'text-[#00f0ff]' : 'text-gray-500 group-hover:text-gray-300'}`}>
                                        {item.icon}
                                    </div>
                                    <span className={`relative z-10 text-sm font-bold uppercase tracking-wider font-['Rajdhani'] ${isActive ? 'translate-x-1 text-white' : ''} transition-transform`}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Server Stats Footer */}
                    {activeServer && (
                        <div className="p-4 border-t border-white/5 bg-black/20">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-2 font-mono">
                                <span>SYSTEM STATUS</span>
                                <span className="text-[#00f0ff]">{status === 'online' ? 'ONLINE' : 'STANDBY'}</span>
                            </div>
                            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden border border-[#00f0ff]/20">
                                <div className={`h-full bg-gradient-to-r from-[#00f0ff] to-[#b829dd] transition-all duration-1000 ${status === 'online' ? 'w-2/3 animate-pulse' : 'w-1/4'}`} />
                            </div>
                            <div className="mt-3 text-[10px] text-gray-600 flex justify-between font-mono">
                                <span>PORT: {activeServer.port}</span>
                                <span>v1.20.1</span>
                            </div>
                        </div>
                    )}
                </nav>

                {/* Content Area - Sci-Fi Panel */}
                <main className="flex-1 sci-fi-panel opacity-95 flex flex-col overflow-hidden relative">
                    {/* Corner Accents */}
                    <div className="corner-accent corner-accent-tl"></div>
                    <div className="corner-accent corner-accent-tr corner-accent-purple"></div>
                    <div className="corner-accent corner-accent-bl corner-accent-purple"></div>
                    <div className="corner-accent corner-accent-br"></div>

                    {/* Inner Content Shadow */}
                    <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none z-10" />

                    {/* Header Info */}
                    <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/10 backdrop-blur-sm relative z-20">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-[#00f0ff]/10 rounded border border-[#00f0ff]/20">
                                {navItems.find(i => i.id === activeTab)?.icon}
                            </div>
                            <div>
                                <h2 className="text-xl font-['VT323'] text-[#00f0ff] leading-none uppercase tracking-wide">
                                    {navItems.find(i => i.id === activeTab)?.label}
                                </h2>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">
                                    {activeServer ? `${activeServer.name} / ${activeTab.toUpperCase()}` : 'Select a server'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar relative">
                        {renderContent()}
                    </div>
                </main>
            </div>

            {/* Background Overlay for Depth */}
            <div className="fixed inset-0 bg-black/50 pointer-events-none z-0" />

            {/* ── Server Switch Confirmation Modal ── */}
            {pendingSwitch && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="sci-fi-panel p-6 max-w-sm w-full mx-4 space-y-4">
                        <div className="corner-accent corner-accent-tl"></div>
                        <div className="corner-accent corner-accent-tr corner-accent-purple"></div>
                        <h3 className="font-['VT323'] text-2xl text-white uppercase tracking-wide">
                            Switch Server?
                        </h3>
                        <p className="text-sm text-gray-300">
                            Switch the active server to <span className="text-[#00f0ff] font-bold">{pendingSwitch.name}</span>?
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setPendingSwitch(null)}
                                className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-white rounded border border-white/10 transition-all font-bold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSwitch}
                                className="flex-1 py-2 minecraft-btn minecraft-btn-primary !py-2 transition-all"
                            >
                                Confirm Switch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
