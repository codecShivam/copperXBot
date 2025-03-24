import fs from 'fs';
import path from 'path';
import { Telegraf } from 'telegraf';
import { closeRedisConnection } from './sessionStore';

const BOT_LOCK_FILE = path.join(process.cwd(), '.bot.lock');

/**
 * Checks if another bot process is already running
 * @returns Process ID of running bot, or null if none
 */
export const checkRunningBot = (): number | null => {
  try {
    if (fs.existsSync(BOT_LOCK_FILE)) {
      const pidString = fs.readFileSync(BOT_LOCK_FILE, 'utf8').trim();
      const pid = parseInt(pidString);
      
      if (isNaN(pid)) {
        console.warn('Found invalid PID in lock file, assuming no running process');
        return null;
      }
      
      // Check if the process is actually running
      try {
        // Sending signal 0 doesn't actually kill the process,
        // it just checks if the process exists
        process.kill(pid, 0);
        return pid; // Process exists
      } catch (e) {
        // Process doesn't exist
        console.log(`Process ${pid} from lock file not found, assuming old lock file`);
        fs.unlinkSync(BOT_LOCK_FILE);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error checking for running bot:', error);
    return null;
  }
};

/**
 * Registers the current bot process in the lock file
 */
export const registerBotProcess = (): void => {
  try {
    fs.writeFileSync(BOT_LOCK_FILE, process.pid.toString());
    console.log(`Registered bot process with PID: ${process.pid}`);
  } catch (error) {
    console.error('Error registering bot process:', error);
  }
};

/**
 * Removes the lock file
 */
export const cleanupBotProcess = (): void => {
  try {
    if (fs.existsSync(BOT_LOCK_FILE)) {
      fs.unlinkSync(BOT_LOCK_FILE);
      console.log('Removed bot lock file');
    }
  } catch (error) {
    console.error('Error cleaning up bot process:', error);
  }
};

/**
 * Setup graceful shutdown handlers for the bot
 * @param bot Telegraf bot instance
 */
export const setupGracefulShutdown = (bot: Telegraf): void => {
  process.once('SIGINT', async () => {
    console.log('SIGINT signal received');
    await performShutdown(bot, 'SIGINT');
  });
  
  process.once('SIGTERM', async () => {
    console.log('SIGTERM signal received');
    await performShutdown(bot, 'SIGTERM');
  });
  
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await performShutdown(bot, 'UNCAUGHT_EXCEPTION');
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled promise rejection:', reason);
    await performShutdown(bot, 'UNHANDLED_REJECTION');
  });
};

/**
 * Perform a graceful shutdown of all services
 * @param bot Telegraf bot instance
 * @param reason Reason for shutdown
 */
export const performShutdown = async (bot: Telegraf, reason: string): Promise<void> => {
  console.log(`Starting graceful shutdown: ${reason}`);
  
  try {
    // Stop the bot
    await bot.stop(reason);
    console.log('Bot stopped successfully');
    
    // Close Redis connection
    await closeRedisConnection();
    console.log('Redis connection closed');
    
    // Cleanup lock file
    cleanupBotProcess();
    
    console.log('Shutdown complete');
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  // Don't call process.exit here - let the process exit naturally
}; 