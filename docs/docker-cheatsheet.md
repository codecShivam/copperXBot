# Docker Cheat Sheet for CopperX Bot

## Basic Docker Commands

### Container Management

```bash
# List running containers
docker ps

# List all containers (including stopped)
docker ps -a

# Start a container
docker start [container_id or name]

# Stop a container
docker stop [container_id or name]

# Restart a container
docker restart [container_id or name]

# Remove a container
docker rm [container_id or name]

# Remove all stopped containers
docker container prune
```

### Image Management

```bash
# List all images
docker images

# Remove an image
docker rmi [image_id or name]

# Remove all unused images
docker image prune

# Build an image from a Dockerfile
docker build -t [name:tag] .
```

### Logs and Debugging

```bash
# View container logs
docker logs [container_id or name]

# Follow container logs
docker logs -f [container_id or name]

# Show container resource usage
docker stats

# Run a command in a running container
docker exec -it [container_id or name] [command]

# Get a shell in a running container
docker exec -it [container_id or name] sh
```

## Docker Compose Commands (for CopperX Bot)

```bash
# Start services in the background
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View service logs
docker compose logs

# Follow service logs
docker compose logs -f

# View logs for a specific service
docker compose logs -f bot

# Rebuild containers
docker compose build

# Check the status of services
docker compose ps

# Scale a service (if needed)
docker compose up -d --scale bot=2

# Run a command in a service container
docker compose exec bot sh
```

## Redis Configuration in Docker

When using Redis with Docker, there are some important configuration differences compared to local development:

```bash
# IMPORTANT: In docker-compose.yml environments, use 'redis' as the hostname
# This is the service name in your docker-compose.yml file
REDIS_HOST=redis

# In local (non-Docker) environments, use 'localhost'
REDIS_HOST=localhost
```

This is a common source of errors. If your bot container can't connect to Redis with errors like:
```
Redis connection error: Error: connect ECONNREFUSED 127.0.0.1:6379
```

Make sure your `.env` file has `REDIS_HOST=redis` when running in Docker.

## Redis Commands for Docker

```bash
# Connect to Redis CLI in the container
docker compose exec redis redis-cli -a "$REDIS_PASSWORD"

# Check Redis connectivity
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" ping

# Create a Redis backup manually
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" SAVE

# Copy Redis backup file from container
docker cp copperxbot-redis-1:/data/dump.rdb ./redis-backup.rdb

# Monitor Redis
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" MONITOR

# Get Redis info
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" INFO
```

## Volume Management

```bash
# List volumes
docker volume ls

# Inspect a volume
docker volume inspect redis-data

# Remove a volume (caution: data loss!)
docker volume rm redis-data

# Backup a volume
docker run --rm -v redis-data:/data -v $(pwd):/backup alpine tar -czf /backup/redis-data-backup.tar.gz /data
```

## Docker Network Commands

```bash
# List networks
docker network ls

# Inspect a network
docker network inspect copperxbot_default

# Create a network
docker network create my-network
```

## Docker System Commands

```bash
# Show Docker disk usage
docker system df

# Clean up Docker (remove unused containers, networks, images)
docker system prune

# Clean up everything including volumes (CAUTION!)
docker system prune -a --volumes
```

## Environment Management

```bash
# Check Docker version
docker --version

# Check Docker Compose version
docker compose version

# View Docker system info
docker info
```

## Useful Docker Compose Scripts

### Update and Restart Services

```bash
#!/bin/bash
# Update and restart
cd /path/to/copperXBot
git pull
docker compose down
docker compose build
docker compose up -d
```

### Backup Redis Data

```bash
#!/bin/bash
# Backup Redis data
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

# Create Redis backup
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" SAVE
docker cp copperxbot-redis-1:/data/dump.rdb $BACKUP_DIR/redis-backup-$TIMESTAMP.rdb
```

### Check Health of Services

```bash
#!/bin/bash
# Health check
if [ "$(docker compose ps -q | wc -l)" -lt 2 ]; then
  echo "Some services are down. Restarting..."
  docker compose restart
fi
```