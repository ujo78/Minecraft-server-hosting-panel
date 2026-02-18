#!/bin/bash
# ─── Web VM Setup ──────────────────────────────────────────────
# Run this on the Web VM (lightweight, runs 24/7)
# Serves the React frontend and proxies API to Game VM
# ──────────────────────────────────────────────────────────────

set -e

echo "🌐 Setting up Web VM..."

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v
npm -v

# Go to project directory
cd /home/$(whoami)/minecraft-panel

# Install server (Web VM) dependencies
echo "📦 Installing Web VM dependencies..."
cd server
npm install

# Build the React client
echo "🔨 Building React frontend..."
cd ../client
npm install
npm run build

echo ""
echo "✅ Web VM setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Copy the .env file and fill in your GCP + OAuth credentials:"
echo "     nano /home/$(whoami)/minecraft-panel/server/.env"
echo ""
echo "  2. Set up Application Default Credentials for GCP:"
echo "     gcloud auth application-default login"
echo ""
echo "  3. Start the Web VM server:"
echo "     cd /home/$(whoami)/minecraft-panel/server && node index.js"
echo ""
echo "  4. (Optional) Set up as a systemd service:"
echo "     sudo cp /home/$(whoami)/minecraft-panel/setup/webvm.service /etc/systemd/system/"
echo "     sudo systemctl enable webvm && sudo systemctl start webvm"
echo ""
