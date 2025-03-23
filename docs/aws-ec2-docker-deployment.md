# AWS EC2 Docker Deployment Guide for CopperX Bot

This guide will walk you through deploying your CopperX Telegram Bot on AWS EC2 using Docker.

## Prerequisites

- AWS Account
- CopperX Bot codebase with Docker files
- Telegram Bot Token

## Step 1: Launch an EC2 Instance

1. **Log in to AWS Console**: Go to [console.aws.amazon.com](https://console.aws.amazon.com)

2. **Navigate to EC2**:
   - In the AWS Management Console, find "Services" at the top
   - Under "Compute", select "EC2"

3. **Launch an Instance**:
   - Click the orange "Launch instance" button
   
4. **Name your instance**:
   - Enter "CopperXBot-Production" for the Name

5. **Choose an Amazon Machine Image (AMI)**:
   - Select "Amazon Linux 2023" (recommended for best compatibility)
   - Make sure it says "Free tier eligible"

6. **Choose an Instance Type**:
   - Select "t2.micro" or "t3.micro" (Free tier eligible)

7. **Configure Key Pair**:
   - Click "Create new key pair"
   - Name: "copperx-key"
   - Key pair type: RSA
   - Private key file format: .pem
   - Click "Create key pair" (this will download the key to your computer)
   - **IMPORTANT**: Save this .pem file securely - you cannot download it again

8. **Configure Network Settings**:
   - Keep the default VPC and subnet
   - "Auto-assign public IP": Enable
   - For Security Group, create a new one:
     - Add SSH (port 22) restricted to your IP address only
     - Name the security group "copperx-sg"

9. **Configure Storage**:
   - Keep the default 8GB gp3 volume or increase to 16GB if needed

10. **Review and Launch**:
    - Review your settings
    - Click "Launch instance"

## Step 2: Connect to Your EC2 Instance

Using EC2 Connect (Easiest Method):

1. In the EC2 dashboard, select your running instance
2. Click the "Connect" button
3. Select the "EC2 Instance Connect" tab
4. Click "Connect"
5. This opens a browser-based terminal session

Alternatively, you can use SSH:

```bash
# Set permissions on your key file (Linux/Mac)
chmod 400 path/to/copperx-key.pem

# Connect via SSH
ssh -i path/to/copperx-key.pem ec2-user@YOUR_EC2_PUBLIC_IP
```

## Step 3: Set Up Docker on EC2

Run the following commands in your EC2 terminal:

```bash
# Update the system
sudo yum update -y

# Install Git and Docker
sudo yum install -y git docker

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add the ec2-user to the docker group so you can run Docker without sudo
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Apply the new group membership (or just reconnect)
newgrp docker
```

## Step 4: Clone Your Repository

```bash
# Create a directory for your project
mkdir -p ~/copperXBot
cd ~/copperXBot

# Clone your repository (replace with your actual repository URL)
git clone https://github.com/codecShivam/copperXBot.git .

# Or, if you don't have a Git repository, you'll need to upload your code
# (instructions for this are in Step 5)
```

## Step 5: Upload Your Code (If Not Using Git)

If your code isn't in a Git repository, you can upload it using SCP:

From your local machine:

```bash
# Package your project files (excluding node_modules, etc.)
cd /path/to/local/copperXBot
tar -czf copperxbot.tar.gz --exclude=node_modules --exclude=.git .

# Upload to EC2 (replace with your actual key path and EC2 IP)
scp -i path/to/copperx-key.pem copperxbot.tar.gz ec2-user@YOUR_EC2_PUBLIC_IP:~/
```

Back on your EC2 instance:

```bash
# Extract the uploaded files
cd ~/copperXBot
tar -xzf ~/copperxbot.tar.gz
```

## Step 6: Configure Environment Variables

```bash
# Create .env file from example
cp .env.docker.example .env

# Generate secure passwords
REDIS_PASSWORD=$(openssl rand -base64 24)
SESSION_SECRET=$(openssl rand -hex 32)

# Update .env file (replace placeholders with actual values)
sed -i "s/your_redis_password_here/$REDIS_PASSWORD/g" .env
sed -i "s/your_session_secret_here/$SESSION_SECRET/g" .env

# Edit the .env file to add your configuration
nano .env
```

Your .env file should include the following settings for the CopperX Bot:

```
# Bot Configuration
BOT_TOKEN=your_telegram_bot_token_here

# Pusher Configuration (if using Pusher for notifications)
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster

# API settings
API_BASE_URL=https://income-api.copperx.io/api

# Redis configuration
REDIS_HOST=redis  # IMPORTANT: Must be 'redis' in Docker, not 'localhost'
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Security
SESSION_SECRET=your_session_secret
SESSION_EXPIRY=86400

# Log Level
LOG_LEVEL=info

# Environment
NODE_ENV=production
```

> **⚠️ IMPORTANT:** When using Docker, the `REDIS_HOST` must be set to `redis` (the service name in docker-compose.yml), not `localhost`. 
> If set incorrectly to `localhost`, the bot container will attempt to connect to itself rather than the Redis container, resulting in connection errors.

Make sure to replace all placeholder values with your actual credentials.

## Step 7: Build and Run Docker Containers

```bash
# Make sure you're in the project directory
cd ~/copperXBot

# Create logs directory
mkdir -p logs

# Build and start the containers
docker compose up -d

# Check the status
docker compose ps

# View logs
docker compose logs -f
```

## Step 8: Set Up Auto-Restart on System Boot

```bash
# Create a systemd service file
sudo nano /etc/systemd/system/copperx-docker.service
```

Add the following content:

```
[Unit]
Description=CopperX Telegram Bot Docker Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ec2-user/copperXBot
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable copperx-docker.service
sudo systemctl start copperx-docker.service
```

## Step 9: Create Maintenance Scripts

Create a backup script:

```bash
cat > ~/backup.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR

echo "Creating Redis backup..."
docker compose exec redis redis-cli -a "$REDIS_PASSWORD" SAVE
docker cp copperxbot-redis-1:/data/dump.rdb $BACKUP_DIR/redis-backup-$TIMESTAMP.rdb

echo "Creating .env backup..."
cp .env $BACKUP_DIR/.env-backup-$TIMESTAMP

echo "Backup complete!"
EOF

chmod +x ~/backup.sh
```

Create an update script:

```bash
cat > ~/update.sh << 'EOF'
#!/bin/bash
cd ~/copperXBot

echo "Pulling latest changes..."
git pull

echo "Rebuilding and restarting containers..."
docker compose down
docker compose build
docker compose up -d

echo "Update complete!"
EOF

chmod +x ~/update.sh
```

## Step 10: Set Up Automatic Backups

Add a cron job for daily backups:

```bash
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup.sh >> ~/backup.log 2>&1") | crontab -
```

## Step 11: Monitoring Health (Optional)

Create a health check script:

```bash
cat > ~/health.sh << 'EOF'
#!/bin/bash
# Check if containers are running
CONTAINER_COUNT=$(docker compose ps -q | wc -l)
if [ "$CONTAINER_COUNT" -lt 2 ]; then
  echo "Warning: Some containers are not running. Attempting to restart..."
  docker compose restart
fi
EOF

chmod +x ~/health.sh

# Add to crontab to run every 15 minutes
(crontab -l 2>/dev/null; echo "*/15 * * * * ~/health.sh >> ~/health.log 2>&1") | crontab -
```

## Security Best Practices

1. **Keep Your Instance Updated**: Run `sudo yum update -y` regularly
2. **Use Security Groups Wisely**: Only open necessary ports
3. **Regularly Backup Data**: Test your backups regularly
4. **Monitor Your Instance**: Set up CloudWatch alarms
5. **Use AWS Parameter Store** for sensitive values (advanced)

## Troubleshooting

If you encounter issues:

1. **Check Docker Container Logs**:
   ```bash
   docker compose logs -f
   ```

2. **Check Container Status**:
   ```bash
   docker compose ps
   ```

3. **Restart Containers**:
   ```bash
   docker compose restart
   ```

4. **Rebuild Containers**:
   ```bash
   docker compose down
   docker compose build
   docker compose up -d
   ```

5. **Check System Resources**:
   ```bash
   docker stats
   ```

## Optional Improvements

1. **Use Elastic IP**: To ensure your server IP doesn't change
2. **Set up a CI/CD Pipeline**: For automated deployments
3. **Use AWS ECR**: For storing your Docker images
4. **Set up CloudWatch Logs**: For centralized logging
5. **Use AWS EFS**: For persistent Redis data 