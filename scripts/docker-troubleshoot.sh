#!/bin/bash
# Docker troubleshooting script for CopperX Bot

# Exit on error
set -e

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot Docker Troubleshooting${NC}"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}❌ docker-compose.yml not found in current directory!${NC}"
    echo "Please run this script from the root of your project directory."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running!${NC}"
    echo "Start the Docker service with:"
    echo "sudo systemctl start docker"
    exit 1
else
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
fi

# Check container status
echo -e "\n${YELLOW}Checking container status...${NC}"
container_status=$(docker-compose ps)
echo "$container_status"

if ! echo "$container_status" | grep -q "bot.*Up"; then
    echo -e "${RED}❌ Bot container is not running!${NC}"
else
    echo -e "${GREEN}✓ Bot container is running${NC}"
fi

if ! echo "$container_status" | grep -q "redis.*Up"; then
    echo -e "${RED}❌ Redis container is not running!${NC}"
else
    echo -e "${GREEN}✓ Redis container is running${NC}"
fi

# Check .env file
echo -e "\n${YELLOW}Checking .env configuration...${NC}"
if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    
    # Check Redis host in .env
    redis_host=$(grep "REDIS_HOST" .env | cut -d '=' -f2)
    if [ "$redis_host" = "localhost" ]; then
        echo -e "${RED}❌ REDIS_HOST is set to 'localhost' in .env!${NC}"
        echo -e "${YELLOW}This is a common issue in Docker environments.${NC}"
        echo "Would you like to fix it automatically? (y/n)"
        read -r fix_redis_host
        
        if [[ "$fix_redis_host" =~ ^[Yy]$ ]]; then
            # Create backup of .env
            cp .env .env.backup
            echo -e "${BLUE}Created backup of .env as .env.backup${NC}"
            
            # Update Redis host
            sed -i 's/REDIS_HOST=localhost/REDIS_HOST=redis/g' .env
            echo -e "${GREEN}✓ Updated REDIS_HOST to 'redis' in .env${NC}"
            
            # Ask to restart containers
            echo "Would you like to restart Docker containers to apply the change? (y/n)"
            read -r restart_containers
            
            if [[ "$restart_containers" =~ ^[Yy]$ ]]; then
                echo -e "${BLUE}Restarting containers...${NC}"
                docker-compose down
                docker-compose up -d
                echo -e "${GREEN}✓ Containers restarted${NC}"
            fi
        fi
    elif [ "$redis_host" = "redis" ]; then
        echo -e "${GREEN}✓ REDIS_HOST correctly set to 'redis' in .env${NC}"
    else
        echo -e "${YELLOW}⚠️ REDIS_HOST is set to '$redis_host', which may be incorrect for Docker${NC}"
    fi
    
    # Check Redis password
    if grep -q "REDIS_PASSWORD" .env; then
        redis_password=$(grep "REDIS_PASSWORD" .env | cut -d '=' -f2)
        if [ -z "$redis_password" ] || [ "$redis_password" = "your_redis_password_here" ]; then
            echo -e "${RED}❌ Redis password is not set properly in .env!${NC}"
        else
            echo -e "${GREEN}✓ Redis password appears to be set${NC}"
        fi
    else
        echo -e "${RED}❌ REDIS_PASSWORD not found in .env!${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Would you like to create one from the example file? (y/n)"
    read -r create_env
    
    if [[ "$create_env" =~ ^[Yy]$ ]]; then
        if [ -f ".env.docker.example" ]; then
            cp .env.docker.example .env
            echo -e "${GREEN}✓ Created .env from .env.docker.example${NC}"
            
            # Generate secure Redis password and session secret
            if command -v openssl &> /dev/null; then
                redis_password=$(openssl rand -base64 24)
                session_secret=$(openssl rand -hex 32)
                
                sed -i "s/your_redis_password_here/$redis_password/g" .env
                sed -i "s/your_session_secret_here/$session_secret/g" .env
                
                echo -e "${GREEN}✓ Generated secure Redis password and session secret${NC}"
            else
                echo -e "${YELLOW}⚠️ openssl not found. Please edit .env manually to set secure passwords.${NC}"
            fi
            
            echo -e "${YELLOW}Please edit .env to set your Telegram BOT_TOKEN and other required values.${NC}"
        else
            echo -e "${RED}❌ .env.docker.example not found!${NC}"
        fi
    fi
fi

# Test Redis connectivity
echo -e "\n${YELLOW}Testing Redis connectivity...${NC}"
if docker-compose ps | grep -q "redis.*Up"; then
    # Test Redis ping
    redis_ping=$(docker-compose exec redis redis-cli ping 2>&1)
    if [[ "$redis_ping" == "PONG" ]]; then
        echo -e "${GREEN}✓ Redis responds to ping (no auth required)${NC}"
    else
        # Try with password if available
        if [ -f ".env" ] && grep -q "REDIS_PASSWORD" .env; then
            redis_password=$(grep "REDIS_PASSWORD" .env | cut -d '=' -f2)
            redis_auth_ping=$(docker-compose exec redis redis-cli -a "$redis_password" ping 2>&1)
            
            if [[ "$redis_auth_ping" == "PONG" ]]; then
                echo -e "${GREEN}✓ Redis responds after authentication${NC}"
                
                # Test if bot can connect to Redis
                echo -e "\n${YELLOW}Testing if bot container can connect to Redis...${NC}"
                if docker-compose ps | grep -q "bot.*Up"; then
                    # Use netcat to test connection
                    docker-compose exec bot sh -c "apk add --no-cache netcat-openbsd > /dev/null 2>&1 || true"
                    redis_connection=$(docker-compose exec bot sh -c "nc -zv redis 6379" 2>&1)
                    
                    if [[ "$redis_connection" == *"open"* ]] || [[ "$redis_connection" == *"succeeded"* ]]; then
                        echo -e "${GREEN}✓ Bot container can connect to Redis container${NC}"
                    else
                        echo -e "${RED}❌ Bot container cannot connect to Redis container${NC}"
                        echo "This might be a Docker network issue or container DNS problem."
                    fi
                fi
            else
                echo -e "${RED}❌ Redis authentication failed with password from .env!${NC}"
            fi
        else
            echo -e "${RED}❌ Cannot authenticate with Redis - no password found in .env${NC}"
        fi
    fi
fi

# Check logs for common errors
echo -e "\n${YELLOW}Checking bot logs for common errors...${NC}"
bot_logs=$(docker-compose logs bot --tail 50 2>&1)

if echo "$bot_logs" | grep -q "ECONNREFUSED 127.0.0.1:6379"; then
    echo -e "${RED}❌ Found error: Bot trying to connect to Redis on localhost (127.0.0.1)${NC}"
    echo -e "${YELLOW}This confirms that REDIS_HOST is incorrectly set to 'localhost' in your environment.${NC}"
    echo "Please update your .env file to set REDIS_HOST=redis and restart your containers."
fi

if echo "$bot_logs" | grep -q "Redis connection error"; then
    echo -e "${RED}❌ Found Redis connection errors in logs${NC}"
fi

if echo "$bot_logs" | grep -q "MaxRetriesPerRequestError"; then
    echo -e "${RED}❌ Found Redis max retries error - bot cannot establish connection to Redis${NC}"
fi

# Provide repair options
echo -e "\n${YELLOW}Troubleshooting complete. Available repair options:${NC}"
echo "1. Rebuild and restart containers (fixes most issues after configuration changes)"
echo "2. Force recreate Redis container (fixes Redis data corruption issues)"
echo "3. Reset Redis data volume (caution: this will erase all Redis data)"
echo "4. Exit without taking action"
echo ""
echo "Enter option number (1-4):"
read -r repair_option

case "$repair_option" in
    1)
        echo -e "${BLUE}Rebuilding and restarting containers...${NC}"
        docker-compose down
        docker-compose build --no-cache bot
        docker-compose up -d
        echo -e "${GREEN}✓ Containers rebuilt and restarted${NC}"
        ;;
    2)
        echo -e "${BLUE}Force recreating Redis container...${NC}"
        docker-compose rm -sf redis
        docker-compose up -d
        echo -e "${GREEN}✓ Redis container recreated${NC}"
        ;;
    3)
        echo -e "${RED}WARNING: This will erase all Redis data!${NC}"
        echo "Are you sure you want to continue? (y/n)"
        read -r confirm_reset
        
        if [[ "$confirm_reset" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Resetting Redis data volume...${NC}"
            docker-compose down
            docker volume rm copperxbot_redis-data || true
            docker-compose up -d
            echo -e "${GREEN}✓ Redis data volume reset${NC}"
        fi
        ;;
    4)
        echo "Exiting without changes"
        ;;
    *)
        echo "Invalid option. Exiting without changes."
        ;;
esac

echo -e "\n${GREEN}Troubleshooting script complete.${NC}"
echo "If issues persist, please check docker-compose.yml and ensure it defines a redis service correctly."