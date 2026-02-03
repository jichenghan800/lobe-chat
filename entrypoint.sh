#!/bin/sh
set -e

# Start SSH service
/usr/sbin/sshd

# Start the application
# We use exec so that the application receives signals (like SIGTERM)
exec /bin/node /app/startServer.js
