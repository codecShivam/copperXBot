#!/bin/bash
# Deployment script for CopperX Telegram Bot on Fedora

# Exit on any error
set -e

echo "Deploying CopperX Telegram Bot..."

# 1. Pull latest changes if using git
if [ -d ".git" ]; then
  echo "Pulling latest changes from git..."
  git pull
else
  echo "Not a git repository, skipping git pull"
fi

# 2. Install dependencies
echo "Installing dependencies..."
npm install

# 3. Build the application
echo "Building application..."
npm run build

# 4. Check Redis status
echo "Checking Redis status..."
redis_status=$(systemctl is-active redis)
if [ "$redis_status" != "active" ]; then
  echo "Redis is not running. Starting Redis..."
  sudo systemctl start redis
  sudo systemctl enable redis
else
  echo "Redis is running correctly."
fi

# 5. Create logs directory if it doesn't exist
echo "Setting up logs directory..."
mkdir -p logs

# 6. Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
  echo "PM2 is not installed. Installing PM2..."
  sudo npm install -g pm2
else
  echo "PM2 is already installed."
fi

# 7. Stop the current bot if running
echo "Stopping any running instance..."
pm2 stop copperx-bot 2>/dev/null || true

# 8. Start the bot with PM2
echo "Starting bot with PM2..."
pm2 start ecosystem.config.js

# 9. Save PM2 configuration
echo "Saving PM2 configuration..."
pm2 save

# 10. Ensure PM2 starts on system boot
echo "Setting up PM2 to start on boot..."
pm2 startup | tail -n 1 | bash || true

echo "Deployment completed successfully!"
echo "You can monitor the bot with: pm2 logs copperx-bot"
echo "Or check bot status with: pm2 status" 