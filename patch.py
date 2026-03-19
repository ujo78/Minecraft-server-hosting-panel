import paramiko
import sys
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

py_script = """
import sys
import re
with open('/etc/nginx/sites-available/minecraft-panel', 'r') as f:
    text = f.read()

# Remove the corrupted location /auth/ block if it exists
text = re.sub(r'\\s*location /auth/ \\{[^}]+\\}', '', text)

if 'location /auth/' not in text:
    text = text.replace('location /api/ {', '''    location /auth/ {
        proxy_pass http://127.0.0.1:5000/auth/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {''')
    with open('/etc/nginx/sites-available/minecraft-panel', 'w') as f:
        f.write(text)
"""

cmd = "sudo python3 - && sudo nginx -t && sudo systemctl reload nginx"

stdin, stdout, stderr = client.exec_command(cmd, timeout=12)
stdin.write(py_script)
stdin.channel.shutdown_write()

out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out:
    sys.stdout.write(out)
if err:
    sys.stderr.write(err)

client.close()
sys.exit(stdout.channel.recv_exit_status())
