#!/bin/bash
# ─── Nginx + SSL Setup for mcpanel.rajrakshit.dev ─────────────
# Run this on the GCP Web VM as root or with sudo.
# ──────────────────────────────────────────────────────────────

set -e

DOMAIN="mcpanel.rajrakshit.dev"
EMAIL="rajrakshit@gmail.com"  # Change this to your email for Let's Encrypt

echo "🌐 Setting up Nginx + SSL for $DOMAIN"
echo ""

# ─── Step 1: Install Nginx ────────────────────────────────────
echo "📦 Installing Nginx..."
sudo apt-get update
sudo apt-get install -y nginx

# ─── Step 2: Install Certbot ──────────────────────────────────
echo "🔒 Installing Certbot..."
sudo apt-get install -y certbot python3-certbot-nginx

# ─── Step 3: Copy Nginx config (HTTP-only first) ──────────────
echo "📝 Setting up Nginx config..."
sudo tee /etc/nginx/sites-available/mcpanel > /dev/null <<'NGINX'
# Temporary HTTP-only config for Certbot verification
server {
    listen 80;
    server_name mcpanel.rajrakshit.dev;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    client_max_body_size 500M;
}
NGINX

# Enable the site, disable default
sudo ln -sf /etc/nginx/sites-available/mcpanel /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
sudo nginx -t
sudo systemctl reload nginx

echo "✅ Nginx is running on HTTP"
echo ""

# ─── Step 4: Get SSL Certificate ──────────────────────────────
echo "🔐 Obtaining SSL certificate from Let's Encrypt..."
echo ""
echo "⚠️  IMPORTANT: Before running this, make sure:"
echo "   1. Your domain $DOMAIN has an A record pointing to this VM's external IP"
echo "   2. Port 80 and 443 are open in GCP firewall"
echo ""
read -p "Is your DNS configured? (y/n): " dns_ready

if [ "$dns_ready" = "y" ] || [ "$dns_ready" = "Y" ]; then
    sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email $EMAIL --redirect

    echo ""
    echo "✅ SSL certificate obtained!"

    # ─── Step 5: Copy the full SSL config ──────────────────────
    echo "📝 Applying full Nginx config with SSL..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    sudo cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/mcpanel

    sudo nginx -t
    sudo systemctl reload nginx

    echo "✅ Full config with SSL applied!"
else
    echo ""
    echo "⏭️  Skipping SSL for now. Run this later when DNS is ready:"
    echo "   sudo certbot --nginx -d $DOMAIN --agree-tos --email $EMAIL --redirect"
    echo ""
    echo "   Then copy the full config:"
    echo "   sudo cp setup/nginx.conf /etc/nginx/sites-available/mcpanel"
    echo "   sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "───────────────────────────────────────────────"
echo "🎉 Setup complete!"
echo ""
echo "📋 Checklist:"
echo "   ✅ Nginx installed and configured"
echo "   ✅ Reverse proxy → localhost:3000"
echo "   ✅ WebSocket (Socket.IO) support"
echo "   ✅ 500MB upload limit for mods"
echo ""
echo "🌍 DNS: Add an A record for $DOMAIN → $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_VM_EXTERNAL_IP')"
echo ""
echo "🔄 Auto-renewal: Certbot renews SSL automatically via systemd timer"
echo "   Check: sudo systemctl status certbot.timer"
echo ""
