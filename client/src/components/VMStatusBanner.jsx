import React from 'react';
import { Power, AlertTriangle, Loader2, Server, X } from 'lucide-react';

// ─── VM Status Banner ─────────────────────────────────────────
// Shows Game VM status at the top of the page:
//   🔴 Stopped  — "Start Game Server" button
//   🟡 Starting — "VM is booting up..." with spinner
//   🟢 Running  — hidden (or minimal indicator)
//   🟠 Warning  — "VM will shut down in N minutes"
//   ⏹ Stopping  — "VM is shutting down..."
// ──────────────────────────────────────────────────────────────

export default function VMStatusBanner({ vmStatus, agentReady, warning, onStartVM, onStopVM }) {
    const [dismissed, setDismissed] = React.useState(false);
    const [isStarting, setIsStarting] = React.useState(false);

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

    // Running & agent ready — show nothing (or minimal green dot)
    if (vmStatus === 'running' && agentReady && !warning) {
        return null;
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
