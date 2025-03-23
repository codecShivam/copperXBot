# 🤖 CopperX Payout Bot

A powerful Telegram bot that brings crypto payments to your fingertips! Built to seamlessly integrate with CopperX Payout API, this bot helps you manage wallets, send crypto, withdraw funds, and track transactions - all through the familiar Telegram interface.

## ✨ Features

- **🔐 Authentication & Account Management**
  - Secure email-based OTP login with Copperx credentials
  - View account profile and KYC/KYB status

- **💰 Wallet Management**
  - Check balances across multiple networks
  - Set default wallet for transactions
  - Generate wallet addresses for deposits

- **📤 Send Crypto** - Multiple ways to send:
  - Send to email addresses (no wallet needed!)
  - Send to crypto wallets directly
  - Send batch payments to multiple recipients

- **💸 Withdrawals** - Cash out to your bank account
- **📊 Transaction History** - Track all your transactions
- **🔔 Real-time Notifications** - Receive deposit notifications via Pusher

## 🛠️ Technology Stack

- **Node.js** & **TypeScript** - Rock-solid foundation
- **Telegraf** - Elegant Telegram Bot framework
- **Redis** - For persistent session management
- **Axios** - API communication
- **Pusher** - Real-time notifications

## 📁 Codebase Structure

```
src/
├── api/                # API integration with CopperX services
│   ├── auth.ts         # Authentication API calls
│   ├── wallet.ts       # Wallet management API calls
│   ├── transfers.ts    # Fund transfer API calls
│   ├── kyc.ts          # KYC verification API calls
│   └── notifications.ts # Notification handlers
├── bot/                # Telegram bot functionality
│   ├── commands/       # Bot command implementations
│   ├── keyboards/      # Telegram inline keyboards
│   └── middleware/     # Bot middleware (auth, etc.)
├── config/             # Application configuration
├── constants/          # App constants and icons
├── services/           # Background services
├── types/              # TypeScript type definitions
├── utils/              # Helper utilities
│   ├── format.ts       # Formatting helpers
│   ├── lifecycle.ts    # Bot lifecycle management
│   ├── redisSession.ts # Redis session implementation
│   ├── validation.ts   # Input validation helpers
│   └── session.ts      # Session management utilities
└── index.ts            # Main application entry point
```

## 🚀 Deployment Options

### Local Development

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/copperxbot.git
   cd copperxbot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env
   # Edit .env with your tokens and configuration
   ```

4. Run in development mode
   ```bash
   npm run dev
   ```

### Docker Deployment

1. Configure environment variables
   ```bash
   cp .env.docker.example .env
   # Edit .env with your configuration
   ```

2. Build and run with Docker Compose
   ```bash
   docker-compose up -d
   ```

3. Check logs
   ```bash
   docker-compose logs -f
   ```

### AWS EC2 Deployment

1. Launch an EC2 instance (t2.micro is sufficient)
2. Install Docker and Docker Compose
   ```bash
   sudo yum update -y
   sudo amazon-linux-extras install docker
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. Clone and deploy the bot
   ```bash
   git clone https://github.com/yourusername/copperxbot.git
   cd copperxbot
   cp .env.docker.example .env
   # Edit .env with your configuration
   docker-compose up -d
   ```

4. Set up a systemd service for auto-start (optional)
   ```bash
   sudo nano /etc/systemd/system/copperxbot.service
   ```

   ```
   [Unit]
   Description=CopperX Payout Bot
   After=docker.service
   Requires=docker.service

   [Service]
   Type=simple
   WorkingDirectory=/path/to/copperxbot
   ExecStart=/usr/local/bin/docker-compose up
   ExecStop=/usr/local/bin/docker-compose down
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

5. Enable and start the service
   ```bash
   sudo systemctl enable copperxbot.service
   sudo systemctl start copperxbot.service
   ```

## 📜 Available Scripts

- `npm start` - Start the bot in production mode
- `npm run dev` - Start with nodemon for development
- `npm run build` - Build TypeScript files
- `npm run clean-start` - Kill existing process, rebuild, and start
- `npm run start-prod` - Start in production with process management
- `npm run lint` - Run ESLint on source code
- `npm run format` - Format code with Prettier

## 💡 How It Works

### Core Workflow

1. **Bot Initialization**: The entry point is `src/index.ts` which initializes the Telegraf bot, sets up Redis session management, and registers command handlers.

2. **Commands**: Each command (like `/send`, `/balance`) is implemented as a separate module in the `bot/commands/` directory using Telegraf's Composer pattern.

3. **API Integration**: The `api/` directory contains modules for communicating with CopperX API endpoints, handling authentication, wallet management, and transfers.

4. **Session Management**: User sessions are managed using Redis, allowing persistent state across bot restarts. Session utilities are in `utils/session.ts` and `utils/redisSession.ts`.

5. **Workflow Management**: Complex operations like sending funds implement multi-step workflows, maintaining state in the user's session.

### Authentication Flow

The bot uses a secure email OTP-based authentication system:
1. User provides email address
2. System sends OTP to email
3. User confirms OTP in Telegram
4. System issues JWT token stored in session

## 📚 Bot Commands

- `/start` - Initialize the bot and see the main menu
- `/login` - Authenticate with your CopperX account
- `/logout` - Sign out from your account
- `/balance` - Check your wallet balances
- `/send` - Send crypto to emails or wallet addresses
- `/withdraw` - Withdraw funds to your bank account
- `/history` - View your transaction history
- `/profile` - View your account details and KYC/KYB status
- `/help` - Show available commands

## ⚙️ Configuration Options

Configure the bot by setting the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_TOKEN` | Your Telegram Bot Token | (Required) |
| `API_BASE_URL` | CopperX API endpoint | https://income-api.copperx.io/api |
| `PUSHER_APP_ID` | Pusher app ID for notifications | (Optional) |
| `PUSHER_KEY` | Pusher key | (Optional) |
| `PUSHER_SECRET` | Pusher secret | (Optional) |
| `PUSHER_CLUSTER` | Pusher cluster region | eu |
| `SESSION_SECRET` | Secret for session encryption | default_secret_key |
| `SESSION_EXPIRY` | Session timeout in seconds | 86400 |
| `REDIS_URL` | Redis connection URL | redis://redis:6379 |

## 🔍 Monitoring and Management

### Managing Bot Instances

To prevent the "409: Conflict: terminated by other getUpdates request" error, ensure that only one instance of the bot is running at a time. The bot includes lifecycle management utilities that create a PID file to track running instances.

If you encounter this error, you have several options:

1. Use the clean start script that will automatically terminate any running instances:
   ```bash
   npm run clean-start
   ```

2. Manually kill any existing bot processes:
   ```bash
   pkill -f 'node.*copperXBot'
   ```

3. Restart your system or development environment if the issue persists.

### Process Management Scripts

- Check if bot is running:
  ```bash
  ./scripts/check-bot.sh
  ```

- View real-time logs:
  ```bash
  ./scripts/view-logs.sh
  ```

- Restart the bot:
  ```bash
  ./scripts/restart-bot.sh
  ```

## 🛡️ Security Best Practices

- All API communications use HTTPS
- User tokens stored in encrypted Redis sessions
- OTP-based authentication for enhanced security
- Configurable session timeouts
- Bot process monitoring to prevent unauthorized deployments

## 🤝 Support

For questions or support, please contact the Copperx team in Telegram at [https://t.me/copperxcommunity/2991](https://t.me/copperxcommunity/2991).

## 📄 License

This project is licensed under the ISC License.

---

Built with ❤️ by [@codecShivam](https://github.com/codecShivam)