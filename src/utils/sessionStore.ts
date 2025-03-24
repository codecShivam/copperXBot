import { Redis } from 'ioredis';
import crypto from 'crypto';
import { SessionData } from '../types';

// Default session expiry in seconds (24 hours)
const SESSION_EXPIRY = 24 * 60 * 60;

// Redis client setup
let redisClient: Redis;

// Initialize Redis client
const initRedis = () => {
  if (redisClient) return redisClient;
  
  // Use config for Redis connection or fallback to defaults
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'copperxbot:session:',
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      console.log(`Redis connection retry in ${delay}ms (attempt ${times})`);
      return delay;
    }
  };
  
  // Create new Redis client
  redisClient = new Redis(redisConfig);
  
  // Setup event handlers
  redisClient.on('connect', () => {
    console.log('Connected to Redis server');
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err);
    // Don't crash the application on Redis errors
    // For production, consider a more robust reconnect strategy
  });
  
  return redisClient;
};

/**
 * Get a unique session key for a user
 * @param userId Telegram user ID
 * @returns Encrypted session key
 */
const getSessionKey = (userId: number | string): string => {
  // Add a secret salt to the key for additional security
  const salt = process.env.SESSION_SECRET || 'copperx-telegram-bot-secret';
  
  // Create a hash of the user ID with the salt
  return crypto.createHash('sha256')
    .update(`${userId}:${salt}`)
    .digest('hex');
};

/**
 * Save session data to Redis
 * @param userId Telegram user ID
 * @param data Session data to save
 * @param ttl Session time-to-live in seconds
 */
export const saveSession = async (
  userId: number | string,
  data: SessionData,
  ttl: number = SESSION_EXPIRY
): Promise<void> => {
  const redis = initRedis();
  const key = getSessionKey(userId);
  
  try {
    // Store session data as JSON
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
    console.log(`Session saved for user ${userId}`);
  } catch (error) {
    console.error('Error saving session:', error);
    // Fall back to in-memory session in case of Redis failure
  }
};

/**
 * Load session data from Redis
 * @param userId Telegram user ID
 * @returns Session data or default session
 */
export const loadSession = async (
  userId: number | string
): Promise<SessionData> => {
  const redis = initRedis();
  const key = getSessionKey(userId);
  
  try {
    const data = await redis.get(key);
    if (!data) {
      // Return default session if not found
      return { authenticated: false };
    }
    
    return JSON.parse(data) as SessionData;
  } catch (error) {
    console.error('Error loading session:', error);
    // Return default session on error
    return { authenticated: false };
  }
};

/**
 * Delete a user's session
 * @param userId Telegram user ID
 */
export const deleteSession = async (
  userId: number | string
): Promise<void> => {
  const redis = initRedis();
  const key = getSessionKey(userId);
  
  try {
    await redis.del(key);
    console.log(`Session deleted for user ${userId}`);
  } catch (error) {
    console.error('Error deleting session:', error);
  }
};

/**
 * Extend a session's expiry time
 * @param userId Telegram user ID
 * @param ttl New time-to-live in seconds
 */
export const extendSession = async (
  userId: number | string,
  ttl: number = SESSION_EXPIRY
): Promise<void> => {
  const redis = initRedis();
  const key = getSessionKey(userId);
  
  try {
    await redis.expire(key, ttl);
    console.log(`Session extended for user ${userId}`);
  } catch (error) {
    console.error('Error extending session:', error);
  }
};

/**
 * Close Redis connection when shutting down
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    console.log('Closing Redis connection...');
    await redisClient.quit();
    console.log('Redis connection closed');
  }
}; 