import { SessionData } from '../types';
import { Context } from 'telegraf';

/**
 * Check if user is authenticated
 * @param ctx Bot context
 * @returns Boolean indicating authentication status
 */
export const isAuthenticated = (ctx: Context): boolean => {
  const session = getSession(ctx);
  return !!(session && session.authenticated && session.token);
};

/**
 * Clear user session
 * @param ctx Bot context
 */
export const clearSession = (ctx: Context): void => {
  const session = getSession(ctx);
  if (session) {
    Object.keys(session).forEach((key) => {
      delete session[key];
    });
    session.authenticated = false;
  }
};

/**
 * Set authentication data in session
 * @param ctx Bot context
 * @param token Access token
 * @param refreshToken Refresh token
 * @param userId User ID
 * @param email User email
 * @param organizationId Organization ID
 */
export const setAuthData = (
  ctx: Context,
  token: string,
  refreshToken: string,
  userId: number,
  email: string,
  organizationId: string,
): void => {
  const session = getSession(ctx);
  if (session) {
    session.token = token;
    session.refreshToken = refreshToken;
    session.userId = userId;
    session.email = email;
    session.organizationId = organizationId;
    session.authenticated = true;
  }
};

/**
 * Set temporary data in session
 * @param ctx Bot context
 * @param key Data key
 * @param value Data value
 */
export const setTempData = (ctx: Context, key: string, value: any): void => {
  const session = getSession(ctx);
  if (!session.tempData) {
    session.tempData = {};
  }

  session.tempData[key] = value;
};

/**
 * Get temporary data from session
 * @param ctx Bot context
 * @param key Data key
 * @returns Data value or undefined
 */
export const getTempData = (ctx: Context, key: string): any => {
  const session = getSession(ctx);
  if (!session.tempData) {
    return undefined;
  }

  return session.tempData[key];
};

/**
 * Clear temporary data from session
 * @param ctx Bot context
 * @param key Data key
 */
export const clearTempData = (ctx: Context, key?: string): void => {
  const session = getSession(ctx);
  if (!session.tempData) {
    return;
  }

  if (key) {
    delete session.tempData[key];
  } else {
    session.tempData = {};
  }
};

/**
 * Safely access session from any context type
 * This is a workaround for TypeScript type issues with different context types
 * @param ctx Any Telegraf context
 * @returns The session object
 */
export const getSession = (ctx: Context): SessionData => {
  return (ctx as any).session || {};
};
