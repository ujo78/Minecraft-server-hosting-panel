const { ComputeManagementClient } = require('@azure/arm-compute');
const { DefaultAzureCredential } = require('@azure/identity');

// ─── VM Manager ───────────────────────────────────────────────
// Controls Game VM lifecycle via Azure Compute Resource Provider.
// Requires: AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, AZURE_VM_NAME, GAME_VM_IP
// Auth: Uses DefaultAzureCredential (pulls from AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)
// ──────────────────────────────────────────────────────────────

class VMManager {
    constructor() {
        this.subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
        this.resourceGroupName = process.env.AZURE_RESOURCE_GROUP || 'minecraft-rg';
        this.vmName = process.env.AZURE_VM_NAME || 'game-vm';
        this.gameAgentPort = process.env.GAME_AGENT_PORT || 4000;

        // Internal IP of the Game VM in the VNet
        this.gameVmIp = process.env.GAME_VM_IP || null;

        // Initialize Azure Compute Client using standard env variables
        const credential = new DefaultAzureCredential();
        this.client = new ComputeManagementClient(credential, this.subscriptionId);

        this._status = 'unknown'; // 'running', 'stopped', 'starting', 'stopping', 'unknown'
        this._agentReady = false;

        // Poll status periodically
        this._pollInterval = null;
    }

    get status() {
        return this._status;
    }

    get agentReady() {
        return this._agentReady;
    }

    get gameAgentUrl() {
        if (!this.gameVmIp) return null;
        return `http://${this.gameVmIp}:${this.gameAgentPort}`;
    }

    // ─── VM Status ────────────────────────────────────────────

    async getVMStatus() {
        try {
            // Get InstanceView to see the running state
            const instanceView = await this.client.virtualMachines.instanceView(
                this.resourceGroupName,
                this.vmName
            );

            // Azure power states look like 'PowerState/running', 'PowerState/deallocated', etc.
            const powerState = instanceView.statuses.find(s => s.code.startsWith('PowerState/'));
            const provisioningState = instanceView.statuses.find(s => s.code.startsWith('ProvisioningState/'));

            if (!powerState) {
                this._status = 'unknown';
                return this._status;
            }

            const stateCode = powerState.code;

            if (stateCode === 'PowerState/running') {
                this._status = 'running';
            } else if (stateCode === 'PowerState/deallocated' || stateCode === 'PowerState/stopped') {
                this._status = 'stopped';
                this._agentReady = false;
            } else if (stateCode === 'PowerState/starting') {
                this._status = 'starting';
            } else if (stateCode === 'PowerState/stopping') {
                this._status = 'stopping';
            } else {
                // If it's something else or updating, fall back to provisioning state
                if (provisioningState && provisioningState.code === 'ProvisioningState/Updating') {
                    // could be starting or stopping, we use unknown as safe default
                    this._status = 'unknown';
                } else {
                    this._status = 'unknown';
                }
            }

            return this._status;
        } catch (err) {
            console.error('Failed to get VM status:', err.message);
            this._status = 'unknown';
            return this._status;
        }
    }

    // ─── Start VM ─────────────────────────────────────────────

    async startVM() {
        try {
            console.log(`🟢 Starting Game VM "${this.vmName}" in Resource Group "${this.resourceGroupName}"...`);
            this._status = 'starting';
            this._agentReady = false;

            // This command initiates the start and waits for the operation to complete
            await this.client.virtualMachines.beginStartAndWait(
                this.resourceGroupName,
                this.vmName
            );

            // Operations wait can take a bit, double check status
            await this.getVMStatus();

            console.log(`✅ Game VM started. Waiting for Game Agent to come online...`);

            if (!this.gameVmIp) {
                console.warn('⚠️ WARNING: GAME_VM_IP is not set in .env. Cannot contact Game Agent.');
            }

            // Wait for the Game Agent to be ready
            const agentReady = await this.waitForAgent(120); // 2 min max

            if (agentReady) {
                console.log(`🎮 Game Agent is online at ${this.gameAgentUrl}`);
                this._status = 'running';
                this._agentReady = true;
            } else {
                console.warn('⚠️ Game VM started but Agent is not responding');
                this._status = 'running';
                this._agentReady = false;
            }

            return { success: true, status: this._status, agentReady: this._agentReady };
        } catch (err) {
            console.error('Failed to start VM:', err.message);
            this._status = 'stopped';
            return { success: false, error: err.message };
        }
    }

    // ─── Stop VM ──────────────────────────────────────────────

    async stopVM() {
        try {
            console.log(`🔴 Stopping Game VM "${this.vmName}"...`);

            // First, tell the Game Agent to gracefully shut down Minecraft servers
            if (this._agentReady && this.gameAgentUrl) {
                try {
                    const response = await fetch(`${this.gameAgentUrl}/api/shutdown`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        signal: AbortSignal.timeout(35000) // 35s timeout (agent waits up to 30s for MC)
                    });
                    if (response.ok) {
                        console.log('Game Agent shutdown completed gracefully');
                    }
                } catch (agentErr) {
                    console.warn('Could not reach Game Agent for graceful shutdown:', agentErr.message);
                }
            }

            this._status = 'stopping';
            this._agentReady = false;

            // Deallocate stops the compute charge
            await this.client.virtualMachines.beginDeallocateAndWait(
                this.resourceGroupName,
                this.vmName
            );

            this._status = 'stopped';
            console.log('✅ Game VM stopped (deallocated)');

            return { success: true, status: 'stopped' };
        } catch (err) {
            console.error('Failed to stop VM:', err.message);
            return { success: false, error: err.message };
        }
    }

    // ─── Wait for Game Agent ──────────────────────────────────

    async waitForAgent(timeoutSeconds = 120) {
        const start = Date.now();
        const timeout = timeoutSeconds * 1000;

        if (!this.gameVmIp) {
            console.error('No Game VM IP available');
            return false;
        }

        while (Date.now() - start < timeout) {
            try {
                const response = await fetch(`${this.gameAgentUrl}/api/health`, {
                    signal: AbortSignal.timeout(3000) // 3s per attempt
                });

                if (response.ok) {
                    this._agentReady = true;
                    return true;
                }
            } catch (err) {
                // Agent not ready yet, keep polling
            }

            // Wait 3 seconds before next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        return false;
    }

    // ─── Ensure VM Running ────────────────────────────────────
    // Convenience method: starts VM if stopped, waits for agent.

    async ensureRunning() {
        await this.getVMStatus();

        if (this._status === 'running' && this._agentReady) {
            return { success: true, status: 'running', alreadyRunning: true };
        }

        if (this._status === 'running' && !this._agentReady) {
            // VM is running but agent isn't ready — try waiting
            const ready = await this.waitForAgent(60);
            return { success: ready, status: 'running', agentReady: ready };
        }

        if (this._status === 'starting') {
            // Already being started, just wait for agent
            const ready = await this.waitForAgent(120);
            return { success: ready, status: 'running', agentReady: ready };
        }

        if (this._status === 'stopping') {
            // Wait for it to stop, then restart
            await new Promise(resolve => setTimeout(resolve, 15000));
            return this.startVM();
        }

        // VM is stopped — start it
        return this.startVM();
    }

    // ─── Status Polling ───────────────────────────────────────

    startPolling(intervalMs = 30000) {
        this.stopPolling();
        this._pollInterval = setInterval(async () => {
            await this.getVMStatus();

            // If VM is running, check agent health
            if (this._status === 'running') {
                try {
                    const response = await fetch(`${this.gameAgentUrl}/api/health`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    this._agentReady = response.ok;
                } catch {
                    this._agentReady = false;
                }
            }
        }, intervalMs);

        // Initial check
        this.getVMStatus();
    }

    stopPolling() {
        if (this._pollInterval) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }

    // ─── Local Dev Mode ───────────────────────────────────────
    // For local development, skip Azure calls and assume the agent is on localhost

    static createLocal(port = 4000) {
        const vm = new VMManager();
        vm._status = 'running';
        vm._agentReady = true;
        vm.gameVmIp = '127.0.0.1';
        vm.gameAgentPort = port;

        // Override Azure methods to no-ops
        vm.getVMStatus = async () => 'running';
        vm.startVM = async () => ({ success: true, status: 'running' });
        vm.stopVM = async () => ({ success: true, status: 'stopped' });
        vm.startPolling = () => { };
        vm.stopPolling = () => { };
        vm.ensureRunning = async () => ({ success: true, status: 'running', alreadyRunning: true });

        return vm;
    }
}

module.exports = VMManager;
