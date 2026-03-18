import paramiko
import sys
import os

os.environ['PYTHONIOENCODING'] = 'utf-8'

host = '4.186.29.209'
user = 'rajrakshit838'
pwd = 'Gst@42000%12'

cmd = sys.argv[1] if len(sys.argv) > 1 else 'echo hello'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=pwd, timeout=10)
stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
if out:
    sys.stdout.buffer.write(out.encode('utf-8', errors='replace'))
if err:
    sys.stderr.buffer.write(err.encode('utf-8', errors='replace'))
client.close()
sys.exit(stdout.channel.recv_exit_status())
