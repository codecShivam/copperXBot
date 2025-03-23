#!/bin/bash
# Deployment script for CopperX Bot

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting CopperX Bot deployment...${NC}"

# Check if git is available and we're in a git repository
if command -v git &> /dev/null && [ -d ".git" ]; then
    echo -e "${GREEN}Git repository detected, pulling latest changes...${NC}"
    git pull
else
    echo -e "${YELLOW}Not a git repository or git not installed. Skipping pull...${NC}"
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build the application
echo -e "${GREEN}Building the application...${NC}"
npm run build

# Check if Redis is running
if command -v systemctl &> /dev/null; then
    redis_status=$(systemctl is-active redis)
    if [ "$redis_status" != "active" ]; then
        echo -e "${YELLOW}Redis service is not running. Starting it...${NC}"
        sudo systemctl start redis
        echo -e "${GREEN}Redis started.${NC}"
    else
        echo -e "${GREEN}Redis is running.${NC}"
    fi
else
    echo -e "${YELLOW}Cannot check Redis status (systemctl not available).${NC}"
fi

# Create logs directory if it doesn't exist
if [ ! -d "logs" ]; then
    echo -e "${GREEN}Creating logs directory...${NC}"
    mkdir -p logs
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 is not installed. Installing it globally...${NC}"
    npm install -g pm2
fi

# Stop the bot if it's already running
echo -e "${GREEN}Stopping any running instance of the bot...${NC}"
pm2 stop copperx-bot 2>/dev/null || true

# Start the bot using PM2 and the ecosystem config
echo -e "${GREEN}Starting the bot with PM2...${NC}"
pm2 start ecosystem.config.js

# Save the PM2 configuration to persist across reboots
echo -e "${GREEN}Saving PM2 configuration...${NC}"
pm2 save

# Check if PM2 is set to start on boot
pm2_startup=$(pm2 startup | grep -o "sudo .*")
if [ ! -z "$pm2_startup" ]; then
    echo -e "${YELLOW}To enable PM2 to start on system boot, run:${NC}"
    echo "$pm2_startup"
fi

echo -e "${GREEN}Deployment complete! The bot is now running.${NC}"
echo "Use 'pm2 logs copperx-bot' to view the bot logs." 