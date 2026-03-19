import paramiko

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

stdin, stdout, stderr = client.exec_command('ls -l /etc/nginx/sites-enabled/')
print("Active sites:")
print(stdout.read().decode())

stdin, stdout, stderr = client.exec_command('cat /etc/nginx/sites-enabled/*')
with open('c:/Users/rajra/Desktop/minecraft panel/nginx-remote.conf', 'w') as f:
    f.write(stdout.read().decode())

client.close()
print("Saved Nginx conf.")
