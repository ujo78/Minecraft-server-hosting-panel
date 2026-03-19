import paramiko
import sys
import os

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

sftp = client.open_sftp()
try:
    sftp.get('/home/rajrakshit838/.pm2/logs/mcpanel-api-error.log', 'c:/Users/rajra/Desktop/minecraft panel/mcpanel-api-error.log')
    sftp.get('/home/rajrakshit838/.pm2/logs/mcpanel-api-out.log', 'c:/Users/rajra/Desktop/minecraft panel/mcpanel-api-out.log')
    print("Downloaded logs successfully.")
except Exception as e:
    print(f"Error downloading: {e}")

sftp.close()
client.close()
