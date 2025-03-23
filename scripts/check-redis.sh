#!/bin/bash
# Redis connection check script for CopperX Bot

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}CopperX Bot Redis Connection Test${NC}"
echo "=============================="

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis is not installed!${NC}"
    echo "Please install Redis first:"
    echo "sudo dnf install redis -y"
    exit 1
fi

# Check if Redis service is running
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

# Check if .env file exists and contains Redis configuration
if [ -f "../.env" ]; then
    echo -e "${GREEN}✓ .env file found${NC}"
    
    # Check if Redis password is set in .env
    if grep -q "REDIS_PASSWORD" "../.env"; then
        echo -e "${GREEN}✓ Redis password is configured in .env${NC}"
        
        # Extract Redis password from .env file
        REDIS_PASSWORD=$(grep "REDIS_PASSWORD" "../.env" | cut -d '=' -f2)
        
        # Check if password is empty or default
        if [ -z "$REDIS_PASSWORD" ] || [ "$REDIS_PASSWORD" = "your_secure_redis_password" ]; then
            echo -e "${RED}❌ Redis password is not set properly in .env!${NC}"
            echo "Please set a proper password in your .env file."
        else
            echo -e "${GREEN}✓ Redis password appears to be set properly${NC}"
        fi
    else
        echo -e "${RED}❌ Redis password not found in .env file!${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found!${NC}"
    echo "Please create an .env file with Redis configuration."
fi

# Attempt to connect to Redis
echo ""
echo "Testing Redis connection..."

# Try simple ping command
ping_result=$(redis-cli ping 2>&1)
if [[ "$ping_result" == "PONG" ]]; then
    echo -e "${GREEN}✓ Redis responds to ping (no auth required)${NC}"
    echo -e "${YELLOW}⚠️ Warning: Redis is not password protected!${NC}"
else
    echo -e "${YELLOW}Redis requires authentication${NC}"
    
    # Check if we have a password from .env
    if [ -f "../.env" ] && grep -q "REDIS_PASSWORD" "../.env"; then
        REDIS_PASSWORD=$(grep "REDIS_PASSWORD" "../.env" | cut -d '=' -f2)
        
        # Test with password
        auth_result=$(redis-cli -a "$REDIS_PASSWORD" ping 2>&1)
        if [[ "$auth_result" == *"PONG"* ]]; then
            echo -e "${GREEN}✓ Successfully authenticated with Redis using password from .env${NC}"
            
            # Test setting and getting a value
            redis-cli -a "$REDIS_PASSWORD" set copperx-test "Redis connection works!" > /dev/null
            test_result=$(redis-cli -a "$REDIS_PASSWORD" get copperx-test)
            
            if [[ "$test_result" == "Redis connection works!" ]]; then
                echo -e "${GREEN}✓ Successfully set and retrieved test value${NC}"
                
                # Clean up test key
                redis-cli -a "$REDIS_PASSWORD" del copperx-test > /dev/null
            else
                echo -e "${RED}❌ Failed to set/get test value${NC}"
            fi
        else
            echo -e "${RED}❌ Authentication failed with password from .env!${NC}"
            echo "Please check your Redis password configuration in both:"
            echo "1. Your .env file"
            echo "2. Redis configuration (/etc/redis/redis.conf)"
        fi
    else
        echo -e "${RED}❌ Redis requires authentication but no password is set in .env!${NC}"
    fi
fi

echo ""
echo "Redis Configuration Summary:"
echo "----------------------------"
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

echo ""
echo -e "${YELLOW}If any issues were found, please fix them before running your bot.${NC}" 