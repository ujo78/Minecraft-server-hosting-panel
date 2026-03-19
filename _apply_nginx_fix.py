import paramiko

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

# Replace proxy_pass http://127.0.0.1:5000/; with proxy_pass http://127.0.0.1:5000;
command = """sudo sed -i 's|proxy_pass http://127.0.0.1:5000/;|proxy_pass http://127.0.0.1:5000;|g' /etc/nginx/sites-available/minecraft-panel && sudo systemctl reload nginx"""

stdin, stdout, stderr = client.exec_command(command)
out = stdout.read().decode()
err = stderr.read().decode()

print(f"Output: {out}")
print(f"Errors: {err}")

client.close()
print("Applied Nginx fix successfully.")
