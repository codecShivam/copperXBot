import fs from 'fs';
import path from 'path';
import { Telegraf } from 'telegraf';
import { BotContext } from '../types';

const PID_FILE = path.join(process.cwd(), '.bot.pid');

/**
 * Write the current process ID to a file
 * This helps with managing multiple bot instances
 */
export const registerBotProcess = (): void => {
  try {
    fs.writeFileSync(PID_FILE, process.pid.toString());
    console.log(`Bot process registered with PID: ${process.pid}`);
  } catch (error) {
    console.error('Error registering bot process:', error);
  }
};

/**
 * Remove the PID file on bot shutdown
 */
export const unregisterBotProcess = (): void => {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
      console.log('Bot process unregistered');
    }
  } catch (error) {
    console.error('Error unregistering bot process:', error);
  }
};

/**
 * Check if another bot instance is running
 * @returns PID of the running instance, or null if none found
 */
export const checkRunningBot = (): number | null => {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'), 10);
      
      // Check if process is actually running
      try {
        // Sending signal 0 doesn't do anything to the process
        // but will throw an error if the process doesn't exist
        process.kill(pid, 0);
        return pid; // Process exists
      } catch (e) {
        // Process doesn't exist, remove the stale PID file
        fs.unlinkSync(PID_FILE);
        return null;
      }
    }
  } catch (error) {
    console.error('Error checking for running bot:', error);
  }
  
  return null;
};

/**
 * Setup graceful shutdown handlers for the bot
 * @param bot Telegraf bot instance
 */
export const setupGracefulShutdown = (bot: Telegraf<BotContext>): void => {
  const shutdown = (signal: string) => {
    console.log(`${signal} received. Shutting down bot gracefully...`);
    bot.stop(signal);
    unregisterBotProcess();
    
    // Give time for connections to close properly before exiting
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  };
  
  // Handle termination signals
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    shutdown('UNCAUGHT_EXCEPTION');
  });
  
  // Handle unhandled rejections (promises)
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
  });
}; 