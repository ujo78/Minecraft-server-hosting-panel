import React from 'react';
import { Power, AlertTriangle, Loader2, Server, X, Clock, PauseCircle, PlayCircle } from 'lucide-react';

// ─── VM Status Banner ─────────────────────────────────────────
// Shows Game VM status at the top of the page:
//   🔴 Stopped  — "Start Game Server" button
//   🟡 Starting — "VM is booting up..." with spinner
//   🟢 Running  — shows "Game VM Running" and auto-shutdown toggle
//   🟠 Warning  — "VM will shut down in N minutes"
//   ⏹ Stopping  — "VM is shutting down..."
// ──────────────────────────────────────────────────────────────

export default function VMStatusBanner({ vmStatus, agentReady, warning, onStartVM, onStopVM, inactivityStatus }) {
    const [dismissed, setDismissed] = React.useState(false);
    const [isStarting, setIsStarting] = React.useState(false);
    const [toggling, setToggling] = React.useState(false);

    // Reset dismissed state when status changes
    React.useEffect(() => {
        setDismissed(false);
        if (vmStatus !== 'starting') setIsStarting(false);
    }, [vmStatus]);

    const handleStart = async () => {
        setIsStarting(true);
        try {
            await onStartVM();
        } catch {
            setIsStarting(false);
        }
    };

    const toggleInactivity = async () => {
        if (!inactivityStatus) return;
        setToggling(true);
        try {
            await fetch('/api/vm/inactivity/toggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !inactivityStatus.running })
            });
        } catch (err) {
            console.error(err);
        } finally {
            setToggling(false);
        }
    };

    // Running & agent ready — show minimal indicator with toggle
    if (vmStatus === 'running' && agentReady && !warning) {
        return (
            <div className="vm-banner flex items-center justify-between px-4 py-2 rounded-lg backdrop-blur-md shadow-lg border bg-emerald-900/50 border-emerald-500/30 text-emerald-50">
                <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <span className="text-sm font-semibold tracking-wide">Game VM Running</span>
                </div>
                {inactivityStatus && (
                    <div className="flex items-center gap-4">
                        <span className="text-xs font-medium text-emerald-200/80">
                            {inactivityStatus.running
                                ? `Auto-shutdown in ${inactivityStatus.timeUntilShutdownMinutes}m`
                                : 'Auto-shutdown paused'}
                        </span>
                        <button
                            onClick={toggleInactivity}
                            disabled={toggling}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all shadow-sm ${inactivityStatus.running
                                    ? 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/50'
                                    : 'bg-amber-900/80 hover:bg-amber-800 text-amber-100 border border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                                }`}
                        >
                            {toggling ? <Loader2 size={14} className="animate-spin" /> :
                                inactivityStatus.running ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                            {inactivityStatus.running ? 'Pause Timer' : 'Resume Timer'}
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Warning banner (VM about to shut down)
    if (warning && !dismissed) {
        return (
            <div className="vm-banner vm-banner-warning">
                <div className="vm-banner-content">
                    <AlertTriangle size={18} />
                    <span>{warning.message}</span>
                    <button className="vm-banner-dismiss" onClick={() => setDismissed(true)}>
                        <X size={14} />
                    </button>
                </div>
            </div>
        );
    }

    // Stopped
    if (vmStatus === 'stopped' || vmStatus === 'unknown') {
        return (
            <div className="vm-banner vm-banner-stopped">
                <div className="vm-banner-content">
                    <Server size={18} />
                    <span>Game server is offline</span>
                    <button
                        className="vm-banner-btn vm-banner-btn-start"
                        onClick={handleStart}
                        disabled={isStarting}
                    >
                        {isStarting ? (
                            <><Loader2 size={14} className="spin" /> Starting...</>
                        ) : (
                            <><Power size={14} /> Start Game Server</>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Starting
    if (vmStatus === 'starting') {
        return (
            <div className="vm-banner vm-banner-starting">
                <div className="vm-banner-content">
                    <Loader2 size={18} className="spin" />
                    <span>Game VM is starting up — this may take 1-2 minutes...</span>
                </div>
                <div className="vm-banner-progress">
                    <div className="vm-banner-progress-bar" />
                </div>
            </div>
        );
    }

    // Stopping
    if (vmStatus === 'stopping') {
        return (
            <div className="vm-banner vm-banner-stopping">
                <div className="vm-banner-content">
                    <Loader2 size={18} className="spin" />
                    <span>Game VM is shutting down...</span>
                </div>
            </div>
        );
    }

    // Running but agent not ready
    if (vmStatus === 'running' && !agentReady) {
        return (
            <div className="vm-banner vm-banner-starting">
                <div className="vm-banner-content">
                    <Loader2 size={18} className="spin" />
                    <span>Game VM is running — waiting for Game Agent to initialize...</span>
                </div>
            </div>
        );
    }

    return null;
}
