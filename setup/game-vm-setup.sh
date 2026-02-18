#!/bin/bash
# ─── Game VM Setup ─────────────────────────────────────────────
# Run this on the Game VM (heavy, auto start/stop)
# Runs the Minecraft Game Agent and manages server processes
# ──────────────────────────────────────────────────────────────

set -e

echo "🎮 Setting up Game VM..."

# Install Java (required for Minecraft)
echo "☕ Installing Java 21..."
sudo apt-get update
sudo apt-get install -y openjdk-21-jre-headless

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
java -version
node -v
npm -v

# Go to project directory
cd /home/$(whoami)/minecraft-panel

# Install Game Agent dependencies
echo "📦 Installing Game Agent dependencies..."
cd game-server
npm install

echo ""
echo "✅ Game VM setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Put your Minecraft server files in directories alongside game-server/"
echo "     (or use the /api/refresh-servers endpoint to discover them)"
echo ""
echo "  2. Start the Game Agent:"
echo "     cd /home/$(whoami)/minecraft-panel/game-server && node gameAgent.js"
echo ""
echo "  3. (Optional) Set up as a systemd service:"
echo "     sudo cp /home/$(whoami)/minecraft-panel/setup/gamevm.service /etc/systemd/system/"
echo "     sudo systemctl enable gamevm && sudo systemctl start gamevm"
echo ""
echo "  4. Accept the EULA in your Minecraft server directory if not done already:"
echo "     echo 'eula=true' > /path/to/minecraft-server/eula.txt"
echo ""
