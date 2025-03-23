#!/bin/bash
# Docker deployment script for CopperX Bot

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Deploying CopperX Bot with Docker${NC}"
echo "================================="

# Check if we're in the right directory
if [ ! -f "./docker-compose.yml" ]; then
  if [ -f "../docker-compose.yml" ]; then
    cd ..
  else
    echo -e "${RED}Error: docker-compose.yml not found!${NC}"
    echo "Please run this script from the project root or scripts directory."
    exit 1
  fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo -e "${RED}Error: .env file not found!${NC}"
  echo "Please create an .env file with your configuration."
  echo "You can copy .env.docker.example to .env and edit it."
  exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Pull the latest changes if this is a git repository
if [ -d ".git" ]; then
  echo -e "\n${YELLOW}Pulling latest changes...${NC}"
  git pull
fi

# Build and start containers
echo -e "\n${YELLOW}Building and starting containers...${NC}"
docker compose down
docker compose build
docker compose up -d

# Check if containers are running
echo -e "\n${YELLOW}Checking container status...${NC}"
if docker compose ps --format json | grep -q "\"State\":\"running\""; then
  echo -e "${GREEN}Containers are running successfully!${NC}"
else
  echo -e "${RED}Warning: Some containers may not be running.${NC}"
  docker compose ps
fi

# Display logs
echo -e "\n${YELLOW}Starting to display logs (press Ctrl+C to exit logs)...${NC}"
echo -e "${YELLOW}Bot will continue running after you exit logs.${NC}"
docker compose logs -f

# This command won't be reached until the user exits the logs with Ctrl+C 