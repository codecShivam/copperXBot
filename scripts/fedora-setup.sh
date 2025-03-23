#!/bin/bash
# Fedora setup script for CopperX Bot with Redis

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot Fedora Setup${NC}"
echo "========================="

# Exit script on any error
set -e

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Please don't run this script as root or with sudo.${NC}"
  echo "It will ask for sudo permissions when needed."
  exit 1
fi

# Update system packages
echo -e "\n${YELLOW}Updating system packages...${NC}"
sudo dnf update -y

# Install Node.js if not already installed
if ! command -v node &> /dev/null; then
  echo -e "\n${YELLOW}Installing Node.js...${NC}"
  sudo dnf install nodejs -y
else
  node_version=$(node -v)
  echo -e "${GREEN}Node.js is already installed (${node_version})${NC}"
fi

# Install Redis if not already installed
if ! command -v redis-cli &> /dev/null; then
  echo -e "\n${YELLOW}Installing Redis...${NC}"
  sudo dnf install redis -y
else
  echo -e "${GREEN}Redis is already installed${NC}"
fi

# Configure Redis
echo -e "\n${YELLOW}Configuring Redis...${NC}"

# Backup original Redis config if not already backed up
if [ ! -f "/etc/redis/redis.conf.backup" ]; then
  sudo cp /etc/redis/redis.conf /etc/redis/redis.conf.backup
  echo "Created backup of original Redis config at /etc/redis/redis.conf.backup"
fi

# Generate a secure password for Redis
REDIS_PASSWORD=$(openssl rand -base64 24)

# Update Redis configuration
echo -e "${YELLOW}Updating Redis configuration...${NC}"
# Make sure Redis only listens on localhost
sudo sed -i 's/^bind .*/bind 127.0.0.1 ::1/' /etc/redis/redis.conf

# Enable password protection
sudo sed -i 's/^# *requirepass .*/requirepass '"$REDIS_PASSWORD"'/' /etc/redis/redis.conf
if ! grep -q "^requirepass" /etc/redis/redis.conf; then
  # If no requirepass line exists or it's commented, add it
  echo "requirepass $REDIS_PASSWORD" | sudo tee -a /etc/redis/redis.conf > /dev/null
fi

# Enable data persistence
sudo sed -i 's/^appendonly .*/appendonly yes/' /etc/redis/redis.conf
if ! grep -q "^appendonly" /etc/redis/redis.conf; then
  # If no appendonly line exists, add it
  echo "appendonly yes" | sudo tee -a /etc/redis/redis.conf > /dev/null
fi

# Start and enable Redis service
echo -e "\n${YELLOW}Starting Redis service...${NC}"
sudo systemctl restart redis
sudo systemctl enable redis

# Check if Redis is running
redis_status=$(systemctl is-active redis)
if [ "$redis_status" = "active" ]; then
  echo -e "${GREEN}Redis is now running and configured${NC}"
else
  echo -e "${RED}Failed to start Redis, please check the service status${NC}"
  exit 1
fi

# Install PM2 for process management
if ! command -v pm2 &> /dev/null; then
  echo -e "\n${YELLOW}Installing PM2...${NC}"
  sudo npm install -g pm2
else
  echo -e "${GREEN}PM2 is already installed${NC}"
fi

# Create or update .env file with Redis configuration
echo -e "\n${YELLOW}Setting up environment variables...${NC}"
if [ -f "../.env" ]; then
  # Update existing .env file
  if grep -q "REDIS_PASSWORD" "../.env"; then
    # Replace existing Redis password
    sed -i 's/^REDIS_PASSWORD=.*/REDIS_PASSWORD='"$REDIS_PASSWORD"'/' "../.env"
  else
    # Add Redis configuration if it doesn't exist
    echo "" >> "../.env"
    echo "# Redis configuration" >> "../.env"
    echo "REDIS_HOST=localhost" >> "../.env"
    echo "REDIS_PORT=6379" >> "../.env"
    echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> "../.env"
    echo "REDIS_DB=0" >> "../.env"
  fi
  
  # Ensure SESSION_SECRET is set
  if ! grep -q "SESSION_SECRET" "../.env"; then
    SESSION_SECRET=$(openssl rand -hex 32)
    echo "SESSION_SECRET=$SESSION_SECRET" >> "../.env"
  fi
  
  echo -e "${GREEN}Updated .env file with Redis configuration${NC}"
else
  # Create .env file from example if it exists
  if [ -f "../.env.example" ]; then
    cp "../.env.example" "../.env"
    # Update Redis password
    sed -i 's/^REDIS_PASSWORD=.*/REDIS_PASSWORD='"$REDIS_PASSWORD"'/' "../.env"
    # Generate and set SESSION_SECRET
    SESSION_SECRET=$(openssl rand -hex 32)
    sed -i 's/^SESSION_SECRET=.*/SESSION_SECRET='"$SESSION_SECRET"'/' "../.env"
    echo -e "${GREEN}Created .env file from example with Redis configuration${NC}"
  else
    # Create minimal .env file
    echo "# Bot Configuration" > "../.env"
    echo "BOT_TOKEN=your_telegram_bot_token_here" >> "../.env"
    echo "" >> "../.env"
    echo "# API settings" >> "../.env"
    echo "API_BASE_URL=https://api.example.com/v1" >> "../.env"
    echo "" >> "../.env"
    echo "# Redis configuration" >> "../.env"
    echo "REDIS_HOST=localhost" >> "../.env"
    echo "REDIS_PORT=6379" >> "../.env"
    echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> "../.env"
    echo "REDIS_DB=0" >> "../.env"
    echo "" >> "../.env"
    echo "# Security" >> "../.env"
    SESSION_SECRET=$(openssl rand -hex 32)
    echo "SESSION_SECRET=$SESSION_SECRET" >> "../.env"
    echo "" >> "../.env"
    echo "# Environment" >> "../.env"
    echo "NODE_ENV=production" >> "../.env"
    echo -e "${GREEN}Created new .env file with Redis configuration${NC}"
  fi
fi

# Create logs directory
echo -e "\n${YELLOW}Creating logs directory...${NC}"
mkdir -p ../logs

echo -e "\n${GREEN}Setup completed successfully!${NC}"
echo "Redis password: $REDIS_PASSWORD"
echo "Please save this password somewhere secure."
echo ""
echo "Next steps:"
echo "1. Complete your .env file with proper API credentials"
echo "2. Run 'npm install' to install dependencies"
echo "3. Run 'npm run build' to build the application"
echo "4. Start the bot with 'pm2 start ecosystem.config.js'"
echo ""
echo "You can also use our deployment script:"
echo "  ./scripts/deploy.sh"
echo ""
echo "To check Redis configuration and connection:"
echo "  ./scripts/check-redis.sh" 