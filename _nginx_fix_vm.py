#!/usr/bin/env python3

config = """server {
    listen 80;
    server_name mcpanel.rajrakshit.dev;
    
    root /home/rajrakshit838/McPanel/client/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
"""

with open('/tmp/nginx_fix.conf', 'w') as f:
    f.write(config)

print("Created /tmp/nginx_fix.conf")
