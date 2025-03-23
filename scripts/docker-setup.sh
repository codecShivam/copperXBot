#!/bin/bash
# Docker setup script for CopperX Bot

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot Docker Setup${NC}"
echo "=========================="

# Check if script is run as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please don't run this script as root or with sudo.${NC}"
  echo "It will ask for sudo permissions when needed."
  exit 1
fi

# Update system packages
echo -e "\n${YELLOW}Updating system packages...${NC}"
sudo dnf update -y

# Install Docker if not already installed
if ! command -v docker &> /dev/null; then
  echo -e "\n${YELLOW}Installing Docker...${NC}"
  sudo dnf -y install dnf-plugins-core
  sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
  sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  
  # Start and enable Docker service
  sudo systemctl start docker
  sudo systemctl enable docker
  
  # Add current user to docker group
  sudo usermod -aG docker $USER
  echo -e "${GREEN}Added you to the docker group. You might need to log out and back in for this to take effect.${NC}"
else
  echo -e "${GREEN}Docker is already installed${NC}"
fi

# Check if Docker is running
if ! sudo systemctl is-active --quiet docker; then
  echo -e "\n${YELLOW}Starting Docker service...${NC}"
  sudo systemctl start docker
  sudo systemctl enable docker
fi

# Create .env file from the Docker example if it doesn't exist
if [ ! -f "../.env" ]; then
  echo -e "\n${YELLOW}Creating .env file...${NC}"
  if [ -f "../.env.docker.example" ]; then
    cp "../.env.docker.example" "../.env"
    
    # Generate Redis password and session secret
    REDIS_PASSWORD=$(openssl rand -base64 24)
    SESSION_SECRET=$(openssl rand -hex 32)
    
    # Update the .env file
    sed -i "s/your_redis_password_here/$REDIS_PASSWORD/g" "../.env"
    sed -i "s/your_session_secret_here/$SESSION_SECRET/g" "../.env"
    
    echo -e "${GREEN}Created .env file with secure random Redis password and session secret.${NC}"
    echo -e "${YELLOW}Please edit the .env file to add your Telegram Bot Token and API settings.${NC}"
  else
    echo -e "${RED}No .env.docker.example file found. Please create .env file manually.${NC}"
  fi
else
  echo -e "${GREEN}.env file already exists${NC}"
fi

# Create logs directory
mkdir -p ../logs
echo -e "${GREEN}Created logs directory${NC}"

echo -e "\n${GREEN}Docker setup completed!${NC}"
echo "Next steps:"
echo "1. Make sure your .env file is configured with your bot token"
echo "2. Run the test script to verify your Docker setup:"
echo "   ./docker-test.sh"
echo "3. Build and start your Docker containers:"
echo "   cd .. && docker compose up -d"
echo ""
echo "Note: If you're running this for the first time, you may need to log out"
echo "and log back in for Docker permissions to take effect." 