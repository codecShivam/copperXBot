#!/bin/bash
# Redis connection check script for CopperX Bot

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot Redis Connection Test${NC}"
echo "=============================="

# First check if Docker containers are running
if docker ps | grep -q redis; then
    echo -e "${BLUE}Docker Redis container detected${NC}"
    echo -e "${GREEN}✓ Redis container is running in Docker${NC}"
    
    # Check Docker Redis connectivity
    echo ""
    echo -e "${YELLOW}Testing Docker Redis connection...${NC}"
    
    # Get Redis password from .env
    if [ -f ".env" ] && grep -q "REDIS_PASSWORD" ".env"; then
        REDIS_PASSWORD=$(grep "REDIS_PASSWORD" ".env" | cut -d '=' -f2)
        
        # Test Redis connection using the password
        redis_ping=$(docker exec -it copperxbot-redis-1 redis-cli -a "$REDIS_PASSWORD" ping 2>&1)
        if [[ "$redis_ping" == *"PONG"* ]]; then
            echo -e "${GREEN}✓ Successfully connected to Redis in Docker!${NC}"
            
            # Check bot connectivity to Redis
            echo -e "${YELLOW}Checking if bot container can connect to Redis...${NC}"
            docker logs copperxbot-bot-1 | grep -i "redis" | tail -5
            
            echo -e "\n${GREEN}Your Redis setup in Docker appears to be working correctly.${NC}"
            echo -e "${GREEN}No need to install Redis on the host system.${NC}"
            exit 0
        else
            echo -e "${RED}❌ Failed to connect to Redis in Docker${NC}"
            echo "Error: $redis_ping"
        fi
    else
        echo -e "${RED}❌ Could not find REDIS_PASSWORD in .env file${NC}"
    fi
else
    echo -e "${BLUE}Detected local environment${NC}"
    
    # Check if Redis is installed (only for local environment)
    if command -v redis-cli &> /dev/null; then
        echo -e "${GREEN}✓ Redis is installed${NC}"
        
        # Check if Redis service is running
        if command -v systemctl &> /dev/null; then
            redis_status=$(systemctl is-active redis)
            if [ "$redis_status" != "active" ]; then
                echo -e "${RED}❌ Redis service is not running!${NC}"
                echo "Start Redis with:"
                echo "sudo systemctl start redis"
                echo "sudo systemctl enable redis"
                exit 1
            else
                echo -e "${GREEN}✓ Redis service is running${NC}"
            fi
        else
            echo "Cannot check Redis service status (systemctl not available)"
        fi
    else
        echo -e "${RED}❌ Redis is not installed!${NC}"
        
        # Detect OS and suggest correct installation command
        if [ -f /etc/redhat-release ] || [ -f /etc/fedora-release ]; then
            echo "Please install Redis first:"
            echo "sudo dnf install redis -y"
        elif [ -f /etc/amazon-release ] || grep -q "Amazon Linux" /etc/system-release 2>/dev/null; then
            echo "Please install Redis first:"
            echo "sudo yum install redis -y"
        elif [ -f /etc/debian_version ]; then
            echo "Please install Redis first:"
            echo "sudo apt install redis-server -y"
        else
            echo "Please install Redis using your system's package manager"
        fi
        exit 1
    fi
fi

# Check if .env file exists and contains Redis configuration
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓ .env file found${NC}"
    
    # Check if Redis password is set in .env
    if grep -q "REDIS_PASSWORD" "$ENV_FILE"; then
        echo -e "${GREEN}✓ Redis password is configured in .env${NC}"
        
        # Extract Redis password from .env file
        REDIS_PASSWORD=$(grep "REDIS_PASSWORD" "$ENV_FILE" | cut -d '=' -f2)
        
        # Check if password is empty or default
        if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "your_secure_redis_password" ] || [ "$REDIS_PASSWORD" = "your_redis_password_here" ]; then
            echo -e "${RED}❌ Redis password is not set properly in .env!${NC}"
            echo "Please set a proper password in your .env file."
        else
            echo -e "${GREEN}✓ Redis password appears to be set properly${NC}"
        fi
    else
        echo -e "${RED}❌ Redis password not found in .env file!${NC}"
    fi
    
    # Check Redis host configuration
    if grep -q "REDIS_HOST" "$ENV_FILE"; then
        REDIS_HOST=$(grep "REDIS_HOST" "$ENV_FILE" | cut -d '=' -f2)
        if [ "$REDIS_HOST" = "redis" ]; then
            echo -e "${YELLOW}⚠️ Redis host is set to 'redis' in local environment${NC}"
            echo "This is correct for Docker, but for local development you might want to use 'localhost'"
            echo "unless you have specifically named your Redis instance 'redis' in your hosts file."
        elif [ "$REDIS_HOST" = "localhost" ]; then
            echo -e "${GREEN}✓ Redis host correctly set to 'localhost' for local environment${NC}"
        else
            echo -e "${YELLOW}⚠️ Redis host set to '${REDIS_HOST}' - make sure this is correct for your environment${NC}"
        fi
    else
        echo -e "${RED}❌ Redis host not found in .env file!${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create an .env file with Redis configuration."
fi

# Attempt to connect to Redis
echo ""
echo "Testing Redis connection..."

# Determine Redis host
REDIS_HOST="localhost"
if [ -f "$ENV_FILE" ] && grep -q "REDIS_HOST" "$ENV_FILE"; then
    REDIS_HOST=$(grep "REDIS_HOST" "$ENV_FILE" | cut -d '=' -f2)
fi

# Try simple ping command
ping_result=$(redis-cli -h "$REDIS_HOST" ping 2>&1)
if [[ "$ping_result" == "PONG" ]]; then
    echo -e "${GREEN}✓ Redis responds to ping (no auth required)${NC}"
    echo -e "${YELLOW}⚠️ Warning: Redis is not password protected!${NC}"
else
    echo -e "${YELLOW}Redis requires authentication or could not connect to host: $REDIS_HOST${NC}"
    
    # Check if we have a password from .env
    if [ -f "$ENV_FILE" ] && grep -q "REDIS_PASSWORD" "$ENV_FILE"; then
        REDIS_PASSWORD=$(grep "REDIS_PASSWORD" "$ENV_FILE" | cut -d '=' -f2)
        
        # Test with password
        auth_result=$(redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" ping 2>&1)
        if [[ "$auth_result" == *"PONG"* ]]; then
            echo -e "${GREEN}✓ Successfully authenticated with Redis using password from .env${NC}"
            
            # Test setting and getting a value
            redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" set copperx-test "Redis connection works!" > /dev/null
            test_result=$(redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" get copperx-test)
            
            if [[ "$test_result" == "Redis connection works!" ]]; then
                echo -e "${GREEN}✓ Successfully set and retrieved test value${NC}"
                
                # Clean up test key
                redis-cli -h "$REDIS_HOST" -a "$REDIS_PASSWORD" del copperx-test > /dev/null
            else
                echo -e "${RED}❌ Failed to set/get test value${NC}"
            fi
        else
            echo -e "${RED}❌ Authentication failed or could not connect to Redis at $REDIS_HOST!${NC}"
            echo "Please check:"
            echo "1. Your Redis host setting in .env (should be 'redis' for Docker, 'localhost' for local)"
            echo "2. Your Redis password configuration"
            echo "3. That Redis is running and accessible"
        fi
    else
        echo -e "${RED}❌ Redis requires authentication but no password is set in .env!${NC}"
    fi
fi

# In Docker environment, show specific Docker container connectivity info
if [ "$IN_DOCKER" = true ]; then
    echo ""
    echo "Docker-specific Redis connectivity:"
    echo "----------------------------------"
    if docker ps | grep -q redis; then
        echo -e "${GREEN}✓ Redis container is running${NC}"
        
        # Check if bot container can reach Redis container
        if ping -c 1 redis &>/dev/null; then
            echo -e "${GREEN}✓ Redis container is reachable via hostname 'redis'${NC}"
        else
            echo -e "${RED}❌ Cannot ping Redis container via hostname 'redis'${NC}"
            echo "Check if containers are on the same network in docker-compose.yml"
        fi
    else
        echo -e "${RED}❌ Redis container not found or not running${NC}"
        echo "Check 'docker ps' or 'docker-compose ps' to see if Redis container is running"
    fi
else
    echo ""
    echo "Redis Configuration Summary:"
    echo "---------------------------"
    if [ -f /etc/redis/redis.conf ]; then
        redis_bind=$(grep "^bind" /etc/redis/redis.conf | head -1)
        redis_protected=$(grep "^requirepass" /etc/redis/redis.conf | head -1)
        redis_persistence=$(grep "^appendonly" /etc/redis/redis.conf | head -1)

        echo "Bind setting: ${redis_bind:-"Not found (default: 127.0.0.1)"}"
        if [[ -z "$redis_protected" || "$redis_protected" == *"#"* ]]; then
            echo -e "Password protection: ${RED}Disabled (not secure)${NC}"
        else
            echo -e "Password protection: ${GREEN}Enabled${NC}"
        fi

        if [[ "$redis_persistence" == "appendonly yes" ]]; then
            echo -e "Persistence: ${GREEN}Enabled (appendonly)${NC}"
        else
            echo -e "Persistence: ${RED}Disabled${NC}"
        fi
    else
        echo -e "${YELLOW}Cannot access Redis configuration file.${NC}"
    fi
fi

echo ""
echo -e "${YELLOW}If any issues were found, please fix them before running your bot.${NC}" 