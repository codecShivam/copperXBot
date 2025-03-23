# CopperX Bot Deployment Guide for AWS EC2

This document provides instructions for deploying the CopperX Telegram Bot to an AWS EC2 instance with secure session management.

## Prerequisites

- An AWS account
- Access to create and manage EC2 instances
- A registered Telegram bot token

## Step 1: Launch an EC2 Instance

1. Log in to the AWS Management Console
2. Navigate to EC2 Dashboard
3. Click "Launch Instance"
4. Choose Ubuntu Server 22.04 LTS
5. Select an appropriate instance type (t3.micro or larger)
6. Configure instance details as needed
7. Add storage (minimum 8GB recommended)
8. Add tags for easier identification
9. Configure security group:
   - Allow SSH (Port 22) - restrict to your IP
   - Allow HTTP (Port 80) and HTTPS (Port 443) if you plan to run a dashboard
10. Review and launch the instance
11. Create or select an existing key pair for SSH access

## Step 2: Connect to Your Instance

```bash
ssh -i /path/to/your-key.pem ubuntu@your-instance-public-dns
```

## Step 3: Install Dependencies

Run the setup script to install all required dependencies:

```bash
# Copy the setup script to your instance
scp -i /path/to/your-key.pem deployment/aws-setup.sh ubuntu@your-instance-public-dns:~/

# SSH into your instance
ssh -i /path/to/your-key.pem ubuntu@your-instance-public-dns

# Make the script executable
chmod +x ~/aws-setup.sh

# Run the setup script
~/aws-setup.sh
```

## Step 4: Transfer Your Application

### Option 1: Use SCP

```bash
# Create a directory for deployment files
mkdir -p ~/deployment

# Archive your application
tar -czvf ~/deployment/copperxbot.tar.gz --exclude="node_modules" --exclude=".git" ./

# Transfer the archive to your EC2 instance
scp -i /path/to/your-key.pem ~/deployment/copperxbot.tar.gz ubuntu@your-instance-public-dns:~/

# SSH into your instance and extract
ssh -i /path/to/your-key.pem ubuntu@your-instance-public-dns
mkdir -p ~/copperXBot
tar -xzvf ~/copperxbot.tar.gz -C ~/copperXBot
```

### Option 2: Use Git (Recommended)

```bash
# On your EC2 instance
git clone https://your-repository-url.git ~/copperXBot
```

## Step 5: Configure Environment Variables

```bash
cd ~/copperXBot
cp .env.example .env
nano .env  # Edit with your actual configuration values
```

Make sure to set:
- Your Telegram Bot Token
- Redis password (matching the one in redis.conf)
- A strong session secret
- Other API credentials as needed

## Step 6: Install Dependencies and Build

```bash
cd ~/copperXBot
npm install
npm run build
```

## Step 7: Start the Bot with PM2

```bash
# Ensure the logs directory exists
mkdir -p ~/copperXBot/logs

# Start the application with PM2
cd ~/copperXBot
pm2 start ecosystem.config.js
```

## Step 8: Configure PM2 to Start on Boot

```bash
pm2 startup
# Run the command provided by the output
pm2 save
```

## Step 9: Monitor Your Bot

```bash
# Check status
pm2 status

# View logs
pm2 logs copperx-bot

# Monitor CPU/Memory usage
pm2 monit
```

## Security Considerations

1. Regularly update your instance:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Set up a firewall (UFW):
   ```bash
   sudo apt install ufw
   sudo ufw allow 22/tcp
   sudo ufw enable
   ```

3. Consider setting up fail2ban to prevent brute-force attacks:
   ```bash
   sudo apt install fail2ban
   ```

4. Change Redis password periodically:
   ```bash
   sudo nano /etc/redis/redis.conf  # Update requirepass
   sudo systemctl restart redis-server
   ```

## Backup Strategy

1. Configure automatic PM2 log rotation:
   ```bash
   pm2 install pm2-logrotate
   pm2 set pm2-logrotate:max_size 10M
   pm2 set pm2-logrotate:retain 7
   ```

2. Set up Redis persistence:
   Redis is already configured with AOF persistence in the setup script.

3. Consider setting up AWS Backup for your instance. 