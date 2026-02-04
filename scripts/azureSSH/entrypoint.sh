#!/bin/sh
set -e

# Start SSH if Azure SSH is enabled
if [ "${ENABLE_AZURE_SSH}" = "true" ]; then
    echo "Azure SSH enabled - starting SSH service..."

    # Generate SSH config
    if [ -f /scripts/azureSSH/sshd_config.sh ]; then
        /bin/sh /scripts/azureSSH/sshd_config.sh
    fi

    # Start SSH daemon in background
    /usr/sbin/sshd

    echo "SSH service started on port 2222"
fi

# Execute the original command
exec /bin/node "$@"
