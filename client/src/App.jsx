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
        // Refresh status/console by reconnecting socket? 
        // Socket events are global but backend emits based on current process.
        // Backend handles switching the process.
        // We might want to clear console or something, but basic switch is enough.
        setStatus('offline'); // Assume offline until status update
    };

    const renderContent = () => {
        // ... (existing switch)
        switch (activeTab) {
            case 'dashboard': return <Dashboard socket={socket} status={status} />;
            case 'console': return <Console socket={socket} />;
            case 'players': return <Players socket={socket} />;
            case 'mods': return <ModManager />;
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
                <nav className="p-4 space-y-2">
                    <SidebarItem icon={<Settings className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Terminal className="w-5 h-5" />} label="Console" active={activeTab === 'console'} onClick={() => { setActiveTab('console'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<Users className="w-5 h-5" />} label="Players" active={activeTab === 'players'} onClick={() => { setActiveTab('players'); setMobileMenuOpen(false); }} />
                    <SidebarItem icon={<HardDrive className="w-5 h-5" />} label="Mods" active={activeTab === 'mods'} onClick={() => { setActiveTab('mods'); setMobileMenuOpen(false); }} />
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
