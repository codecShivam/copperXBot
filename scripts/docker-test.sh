#!/bin/bash
# Simple Docker test script

# Define colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Docker Test for CopperX Bot${NC}"
echo "=============================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed!${NC}"
    echo "Please install Docker first:"
    echo "For Fedora: sudo dnf install -y docker-ce docker-ce-cli containerd.io"
    exit 1
else
    DOCKER_VERSION=$(docker --version)
    echo -e "${GREEN}✓ Docker is installed: ${DOCKER_VERSION}${NC}"
fi

# Check if Docker Compose is installed
if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed!${NC}"
    echo "Please install Docker Compose:"
    echo "For Fedora: sudo dnf install -y docker-compose-plugin"
    exit 1
else
    COMPOSE_VERSION=$(docker compose version)
    echo -e "${GREEN}✓ Docker Compose is installed: ${COMPOSE_VERSION}${NC}"
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running!${NC}"
    echo "Start the Docker service with:"
    echo "sudo systemctl start docker"
    echo "sudo systemctl enable docker"
    exit 1
else
    echo -e "${GREEN}✓ Docker daemon is running${NC}"
fi

# Test Docker with hello-world
echo -e "\n${YELLOW}Testing Docker with hello-world container...${NC}"
if docker run --rm hello-world &> /dev/null; then
    echo -e "${GREEN}✓ Successfully ran hello-world container${NC}"
else
    echo -e "${RED}❌ Failed to run hello-world container${NC}"
    echo "There might be an issue with your Docker installation."
    exit 1
fi

# Check if files exist
echo -e "\n${YELLOW}Checking Docker configuration files...${NC}"
if [ -f "../Dockerfile" ]; then
    echo -e "${GREEN}✓ Dockerfile exists${NC}"
else
    echo -e "${RED}❌ Dockerfile not found!${NC}"
fi

if [ -f "../docker-compose.yml" ]; then
    echo -e "${GREEN}✓ docker-compose.yml exists${NC}"
else
    echo -e "${RED}❌ docker-compose.yml not found!${NC}"
fi

if [ -f "../.dockerignore" ]; then
    echo -e "${GREEN}✓ .dockerignore exists${NC}"
else
    echo -e "${RED}❌ .dockerignore not found!${NC}"
fi

echo -e "\n${GREEN}Docker environment is ready for CopperX Bot deployment!${NC}"
echo "Next steps:"
echo "1. Create/update your .env file with Redis settings"
echo "2. Build and run your containers with: docker compose up -d"
echo "3. Check logs with: docker compose logs -f" 