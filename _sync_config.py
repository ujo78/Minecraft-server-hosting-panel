import paramiko
import os

host = '20.193.152.52'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)

sftp = client.open_sftp()
sftp.get('McPanel/game-server/config.json', 'c:/Users/rajra/Desktop/minecraft panel/game-server/config.json')
sftp.close()
client.close()
print("Downloaded config successfully.")
