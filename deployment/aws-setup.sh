#!/bin/bash
# AWS EC2 setup script for CopperX Telegram Bot

# Exit script on any error
set -e

# Update the system
echo "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 18.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
echo "Installing Redis..."
sudo apt-get install redis-server -y

# Configure Redis to start on boot
sudo systemctl enable redis-server

# Modify Redis configuration for better security
echo "Configuring Redis..."
sudo sed -i 's/bind 127.0.0.1/bind 127.0.0.1/g' /etc/redis/redis.conf
sudo sed -i 's/# requirepass foobared/requirepass YOUR_SECURE_PASSWORD_HERE/g' /etc/redis/redis.conf
sudo sed -i 's/appendonly no/appendonly yes/g' /etc/redis/redis.conf
sudo systemctl restart redis-server

# Install PM2 for process management
echo "Installing PM2..."
sudo npm install -g pm2

# Create app directory
echo "Creating application directory..."
mkdir -p ~/copperXBot

echo "Setup completed successfully!"
echo "Now transfer your application code to the server using SCP or git clone."
echo "Then run 'cd ~/copperXBot && npm install && npm run build && pm2 start ecosystem.config.js'" 