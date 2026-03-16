import paramiko
import sys
import os

host = '20.193.152.52'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

local_file = sys.argv[1]
remote_file = sys.argv[2]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)
sftp = client.open_sftp()
sftp.put(local_file, remote_file)
sftp.close()
print(f"Uploaded {local_file} -> {remote_file}")
client.close()
