#!/bin/sh
set -e

# Start SSH if Azure SSH is enabled
if [ "${ENABLE_AZURE_SSH}" = "true" ]; then
    echo "Azure SSH enabled - starting SSH service..."

    # Set root password (required by Azure: "Docker!")
    echo "root:Docker!" | /usr/sbin/chpasswd

    # Generate SSH config using the script
    if [ -f /scripts/azureSSH/sshd_config.sh ]; then
        /bin/sh /scripts/azureSSH/sshd_config.sh
    fi

    # Start SSH daemon in background
    /usr/sbin/sshd

    echo "SSH service started on port 2222"
fi

# Execute the original command
exec /bin/node "$@"
