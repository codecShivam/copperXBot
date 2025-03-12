#!/bin/bash

# This script starts the bot and restarts it if it crashes
# Usage: ./scripts/start-bot.sh

# Navigate to project root (assuming this script is in the scripts folder)
cd "$(dirname "$0")/.." || exit 1

echo "Ensuring no other bot instances are running..."
pkill -f 'node.*copperXBot' || true
sleep 2

echo "Building project..."
npm run build

echo "Starting bot..."
while true; do
  node dist/index.js
  
  # If the bot exits with code 0 (normal shutdown), exit this script
  if [ $? -eq 0 ]; then
    echo "Bot shut down normally. Exiting."
    break
  fi
  
  # If the bot crashed, wait a bit and restart
  echo "Bot crashed or exited with error. Restarting in 5 seconds..."
  sleep 5
done 