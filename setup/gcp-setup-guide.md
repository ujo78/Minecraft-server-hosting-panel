# GCP Setup Guide — 2-VM Minecraft Panel

## Architecture Overview

```
┌─────────────────────────────────┐        ┌──────────────────────────────────┐
│           WEB VM                │        │           GAME VM                │
│   (e2-micro, runs 24/7)        │        │  (e2-standard-4, auto start/stop)│
│                                 │  VPC   │                                  │
│  React Frontend  ──────────────────────► │  Game Agent (:4000)              │
│  Web Server (:3000)             │ proxy  │  Minecraft Server Processes      │
│  Google OAuth                   │        │  Metrics, Backups, Mods          │
│  VM Lifecycle (GCP API)         │        │                                  │
│  Inactivity Timer               │        │                                  │
└─────────────────────────────────┘        └──────────────────────────────────┘
```

---

## Step 1: Create a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or use an existing one
3. Note the **Project ID** (you'll need it for `.env`)
4. Enable the **Compute Engine API**:
   ```
   gcloud services enable compute.googleapis.com
   ```

---

## Step 2: Create the VMs

### Web VM (lightweight, 24/7)

```bash
gcloud compute instances create web-vm \
  --project=YOUR_PROJECT_ID \
  --zone=us-central1-a \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=20GB \
  --tags=http-server,https-server \
  --scopes=compute-rw
```

Key settings:
- **Machine type**: `e2-micro` (free tier eligible) — this is just a proxy
- **Scopes**: `compute-rw` — allows the Web VM to start/stop the Game VM
- **Tags**: `http-server` — for firewall rules

### Game VM (heavy, auto start/stop)

```bash
gcloud compute instances create game-vm \
  --project=YOUR_PROJECT_ID \
  --zone=us-central1-a \
  --machine-type=e2-standard-4 \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=50GB \
  --no-address
```

Key settings:
- **Machine type**: `e2-standard-4` (4 vCPUs, 16GB RAM) — good for Minecraft
- **`--no-address`**: No public IP — only accessible from Web VM via internal VPC
- This VM will be **stopped most of the time** to save costs

> **Note**: After creating, immediately stop the Game VM:
> ```
> gcloud compute instances stop game-vm --zone=us-central1-a
> ```

---

## Step 3: Set Up Firewall Rules

Allow HTTP traffic to Web VM only:

```bash
# Allow port 3000 (Web VM panel)
gcloud compute firewall-rules create allow-web-panel \
  --allow=tcp:3000 \
  --target-tags=http-server \
  --description="Allow Minecraft panel web access"

# Allow port 25565 from anywhere (Minecraft players connect here)
gcloud compute firewall-rules create allow-minecraft \
  --allow=tcp:25565 \
  --description="Allow Minecraft server connections"

# Allow internal communication between VMs (VPC default may already do this)
gcloud compute firewall-rules create allow-internal \
  --allow=tcp:4000 \
  --source-ranges=10.128.0.0/9 \
  --description="Allow Game Agent internal access"
```

---

## Step 4: Deploy the Code

### On the Web VM:

```bash
# SSH into Web VM
gcloud compute ssh web-vm --zone=us-central1-a

# Clone your repo
git clone YOUR_REPO_URL minecraft-panel
cd minecraft-panel

# Run setup script
chmod +x setup/web-vm-setup.sh
bash setup/web-vm-setup.sh
```

Then configure environment variables:
```bash
nano server/.env
```

Fill in:
```env
GCP_PROJECT_ID=your-project-id
GCP_ZONE=us-central1-a
GCP_VM_NAME=game-vm
GAME_VM_IP=       # Leave empty — auto-discovered on first start
GAME_AGENT_PORT=4000

GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-secret
SESSION_SECRET=your-random-secret
PORT=3000

INACTIVITY_TIMEOUT_MINUTES=30
INACTIVITY_WARNING_MINUTES=5
```

Set up GCP auth:
```bash
gcloud auth application-default login
```

Start as a service:
```bash
sudo cp setup/webvm.service /etc/systemd/system/
sudo systemctl enable webvm
sudo systemctl start webvm
```

### On the Game VM:

```bash
# SSH into Game VM (start it first if stopped)
gcloud compute instances start game-vm --zone=us-central1-a
gcloud compute ssh game-vm --zone=us-central1-a

# Clone your repo
git clone YOUR_REPO_URL minecraft-panel
cd minecraft-panel

# Run setup script
chmod +x setup/game-vm-setup.sh
bash setup/game-vm-setup.sh

# Set up as a service
sudo cp setup/gamevm.service /etc/systemd/system/
sudo systemctl enable gamevm
sudo systemctl start gamevm
```

Then **stop the Game VM** — it will be started automatically by the Web VM when needed:
```bash
gcloud compute instances stop game-vm --zone=us-central1-a
```

---

## Step 5: Verify

1. Open `http://WEB_VM_EXTERNAL_IP:3000` in your browser
2. Log in with Google
3. You should see a "Game server is offline" banner with a **Start Game Server** button
4. Click Start → Watch the VM boot up (1-2 minutes)
5. Once online, all panel features should work normally
6. After 30 minutes of inactivity (no web usage AND no players), the Game VM auto-stops

---

## Cost Estimate

| Component | Cost | When |
|-----------|------|------|
| Web VM (e2-micro) | ~$0/month | Always on (free tier) |
| Game VM (e2-standard-4) | ~$0.13/hour | Only when playing |
| Disk (50GB SSD) | ~$8/month | Always |

**Example**: If you play 4 hours/day → Game VM costs ~$16/month + $8 disk = **~$24/month total**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Game VM is starting" takes too long | GCP cold boot can take 60-90 seconds. Check `gcloud compute instances describe game-vm` |
| Agent not ready after VM starts | Ensure gamevm.service is enabled. SSH into Game VM and check `systemctl status gamevm` |
| "Permission denied" on VM start/stop | Ensure Web VM has `compute-rw` scope. Run `gcloud auth application-default login` |
| Minecraft players can't connect | Check firewall rule for port 25565. Ensure Game VM has external IP or port forwarding |
| OAuth redirect error | Update Google OAuth redirect URI to `http://WEB_VM_IP:3000/auth/google/callback` |
