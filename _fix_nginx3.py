import paramiko
import sys
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

config = '''server {
    listen 80;
    server_name mcpanel.rajrakshit.dev;
    root /home/rajrakshit838/McPanel/client/dist;
    index index.html;
    
    location / {
        try_files $uri /index.html;
    }
    
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
    }
    
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
    }
}'''

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

stdin, stdout, stderr = client.exec_command("cat > /tmp/nginx_config << 'EOF'\n" + config + "\nEOF", timeout=30)
stdin, stdout, stderr = client.exec_command("sudo mv /tmp/nginx_config /etc/nginx/sites-available/mcpanel && sudo nginx -t", timeout=30)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print("NGINX TEST:", out, err)

stdin, stdout, stderr = client.exec_command("sudo systemctl reload nginx", timeout=30)
print("NGINX RELOADED")

# Test the site
stdin, stdout, stderr = client.exec_command("curl -s -o /dev/null -w '%{http_code}' http://localhost/", timeout=10)
out = stdout.read().decode('utf-8', errors='replace')
print("HTTP STATUS:", out)

client.close()
