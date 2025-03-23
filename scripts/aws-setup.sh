#!/bin/bash
# AWS EC2 Setup Script for CopperX Bot

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot AWS EC2 Setup${NC}"
echo "============================"

# Check if user is root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please don't run this script as root or with sudo.${NC}"
    echo "It will ask for sudo permissions when needed."
    exit 1
fi

# Update system packages
echo -e "\n${YELLOW}Updating system packages...${NC}"
sudo yum update -y

# Install required packages
echo -e "\n${YELLOW}Installing required packages...${NC}"
sudo yum install -y git docker

# Install Docker Compose if not available
if ! command -v docker-compose &> /dev/null; then
    echo -e "\n${YELLOW}Installing Docker Compose...${NC}"
    sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
fi

# Start and enable Docker
echo -e "\n${YELLOW}Starting and enabling Docker service...${NC}"
sudo systemctl start docker
sudo systemctl enable docker

# Add current user to docker group
echo -e "\n${YELLOW}Adding user to docker group...${NC}"
sudo usermod -aG docker $USER
echo -e "${GREEN}You've been added to the docker group.${NC}"
echo -e "${YELLOW}You may need to log out and back in for this to take effect.${NC}"

# Create .env file from example if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "\n${YELLOW}Creating .env file...${NC}"
    if [ -f ".env.docker.example" ]; then
        cp ".env.docker.example" ".env"
        
        # Generate secure passwords
        REDIS_PASSWORD=$(openssl rand -base64 24)
        SESSION_SECRET=$(openssl rand -hex 32)
        
        # Update the .env file
        sed -i "s/your_redis_password_here/$REDIS_PASSWORD/g" ".env"
        sed -i "s/your_session_secret_here/$SESSION_SECRET/g" ".env"
        
        echo -e "${GREEN}Created .env file with secure Redis password and session secret.${NC}"
        echo -e "${YELLOW}Please edit the .env file to add your Telegram Bot Token and API settings.${NC}"
        echo -e "${YELLOW}Edit the file with: nano .env${NC}"
    else
        echo -e "${RED}No .env.docker.example file found. Please create .env file manually.${NC}"
    fi
else
    echo -e "${GREEN}.env file already exists${NC}"
    
    # Check if REDIS_HOST is set correctly
    if grep -q "REDIS_HOST=localhost" ".env"; then
        echo -e "${RED}REDIS_HOST is set to 'localhost' in your .env file.${NC}"
        echo -e "${YELLOW}In Docker, it should be set to 'redis' (the service name in docker-compose.yml).${NC}"
        echo "Would you like to fix it now? (y/n)"
        read -r fix_redis_host
        
        if [[ "$fix_redis_host" =~ ^[Yy]$ ]]; then
            # Create backup of .env
            cp .env .env.backup
            echo -e "${BLUE}Created backup of .env as .env.backup${NC}"
            
            # Update Redis host
            sed -i 's/REDIS_HOST=localhost/REDIS_HOST=redis/g' .env
            echo -e "${GREEN}✓ Updated REDIS_HOST to 'redis' in .env${NC}"
        fi
    fi
fi

# Create logs directory
echo -e "\n${YELLOW}Creating logs directory...${NC}"
mkdir -p logs

# Setup systemd service for auto-restart on system boot
echo -e "\n${YELLOW}Setting up auto-restart on system boot...${NC}"
SERVICE_FILE=/etc/systemd/system/copperx-docker.service
sudo bash -c "cat > $SERVICE_FILE" << EOF
[Unit]
Description=CopperX Telegram Bot Docker Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable copperx-docker.service
echo -e "${GREEN}Created and enabled systemd service for auto-restart.${NC}"

echo -e "\n${GREEN}AWS EC2 setup completed!${NC}"
echo "Next steps:"
echo "1. Edit your .env file to add your bot token: nano .env"
echo "2. Build and start Docker containers: docker-compose up -d"
echo "3. Check logs with: docker-compose logs -f"
echo "4. If issues occur, run: ./scripts/docker-troubleshoot.sh"
echo ""
echo "Note: If you just added yourself to the docker group,"
echo "you may need to log out and log back in for the changes to take effect." 