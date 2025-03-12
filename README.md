# CopperX Telegram Bot

A Telegram bot that integrates with Copperx Payout's API to enable users to deposit, withdraw, and transfer USDC directly through Telegram.

## Features

- 🔐 **Authentication & Account Management**
  - User login with Copperx credentials
  - View account profile and KYC/KYB status

- 👛 **Wallet Management**
  - View wallet balances across networks
  - Set default wallet for transactions
  - Deposit funds

- 💸 **Fund Transfers**
  - Send funds to email addresses
  - Send funds to external wallet addresses
  - Withdraw funds to bank accounts
  - View transaction history

- 🔔 **Real-time Notifications**
  - Receive deposit notifications via Pusher

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Telegram Bot Token (from BotFather)
- Pusher account for real-time notifications

## Setup Instructions

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/copperxbot.git
   cd copperxbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   
   Copy the .env.example file to .env and update the values:
   ```bash
   cp .env.example .env
   ```
   
   Update the following variables in your .env file:
   - `BOT_TOKEN`: Your Telegram bot token from BotFather
   - `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`: Your Pusher credentials

4. **Development Mode**
   ```bash
   npm run dev
   ```

5. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## Bot Commands

- `/start` - Welcome message and bot introduction
- `/login` - Authenticate with Copperx credentials
- `/balance` - View your wallet balances
- `/send` - Transfer funds to an email or wallet
- `/withdraw` - Withdraw funds to a bank account
- `/history` - View your transaction history
- `/profile` - View your account profile and KYC status
- `/help` - Get usage instructions

## Deployment

The bot can be deployed on platforms like Render.com:

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Use the following settings:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
4. Add your environment variables in the Render dashboard

## Support

For questions or support, please contact the Copperx team in Telegram at [https://t.me/copperxcommunity/2991](https://t.me/copperxcommunity/2991).

## License

ISC 

## Managing Bot Instances

To prevent the "409: Conflict: terminated by other getUpdates request" error, ensure that only one instance of the bot is running at a time. The bot now includes lifecycle management utilities that create a PID file to track running instances.

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

The bot includes graceful shutdown handlers for SIGINT and SIGTERM signals, which ensures that connections to the Telegram API are properly closed when the bot is stopped. 