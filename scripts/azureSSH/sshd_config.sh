#!/bin/sh
# Azure App Service SSH configuration
# This script generates the sshd_config file required for Azure SSH

cat > /etc/ssh/sshd_config <<EOF
Port 			2222
ListenAddress 		0.0.0.0
LoginGraceTime 		180
X11Forwarding 		yes
Ciphers aes128-cbc,3des-cbc,aes256-cbc,aes128-ctr,aes192-ctr,aes256-ctr
MACs hmac-sha1,hmac-sha1-96
StrictModes 		yes
SyslogFacility 		DAEMON
PasswordAuthentication 	yes
PermitEmptyPasswords 	no
PermitRootLogin 	yes
Subsystem sftp internal-sftp
EOF
