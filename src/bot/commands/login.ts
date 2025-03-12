import { Composer, Telegraf } from 'telegraf';
import { message } from 'telegraf/filters';
import { authApi } from '../../api';
import { setAuthData, setTempData, clearTempData, getSession } from '../../utils/session';
import { mainMenuKeyboard } from '../keyboards';
import { setupNotifications } from '../../services/notifications';

// Login command handler
const loginCommand = Composer.command('login', async (ctx) => {
  console.log('[LOGIN] Login command received');
  
  // Check if already authenticated
  const session = getSession(ctx);
  console.log('[LOGIN] Session state:', { 
    authenticated: session.authenticated, 
    currentStep: session.currentStep,
    hasTempData: !!session.tempData
  });
  
  if (session.authenticated) {
    console.log('[LOGIN] User already authenticated, sending message');
    await ctx.reply(
      '✅ You are already logged in.\n\nUse /logout if you want to log out and log in with a different account.',
    );
    return;
  }
  
  // Start login process
  console.log('[LOGIN] Starting login process');
  await ctx.reply(
    '🔐 *Login to Copperx*\n\nPlease enter your email address:',
    {
      parse_mode: 'Markdown',
    },
  );
  
  // Set current step
  console.log('[LOGIN] Setting currentStep to login_email');
  session.currentStep = 'login_email';
});

// Handle login flow
const loginFlow = Composer.on(message('text'), async (ctx, next) => {
  // Skip if not in login flow
  const session = getSession(ctx);
  console.log('[LOGIN FLOW] Message received, current step:', session?.currentStep);
  
  if (!session?.currentStep?.startsWith('login_')) {
    console.log('[LOGIN FLOW] Not in login flow, passing to next handler');
    return next();
  }
  
  const text = ctx.message.text.trim();
  console.log(`[LOGIN FLOW] Processing input: "${text}" for step: ${session.currentStep}`);
  
  // Handle email input
  if (session.currentStep === 'login_email') {
    console.log('[LOGIN FLOW] Processing email input');
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(text)) {
      console.log('[LOGIN FLOW] Invalid email format');
      await ctx.reply('❌ Invalid email format. Please enter a valid email address:');
      return;
    }
    
    try {
      console.log(`[LOGIN FLOW] Valid email format: ${text}`);
      
      // Store email in session
      console.log('[LOGIN FLOW] Storing email in session');
      setTempData(ctx, 'email', text);
      
      // Request OTP
      console.log('[LOGIN FLOW] Requesting OTP from API');
      await ctx.reply('🔄 Requesting OTP...');
      
      console.log('[LOGIN FLOW] Calling requestEmailOtp API');
      const otpResponse = await authApi.requestEmailOtp({ email: text });
      console.log('[LOGIN FLOW] OTP request successful', otpResponse);
      
      // Store the session ID from the OTP request
      if (otpResponse && otpResponse.sid) {
        console.log('[LOGIN FLOW] Storing session ID in tempData:', otpResponse.sid);
        setTempData(ctx, 'sid', otpResponse.sid);
      } else {
        console.error('[LOGIN FLOW] No session ID received from OTP request', otpResponse);
        await ctx.reply('❌ Error requesting OTP: Missing session ID from server. Please try again later.');
        session.currentStep = undefined;
        return;
      }
      
      await ctx.reply(
        `📱 An OTP has been sent to *${text}*.\n\nPlease enter the OTP code:`,
        {
          parse_mode: 'Markdown',
        },
      );
      
      // Update step
      console.log('[LOGIN FLOW] Updating step to login_otp');
      session.currentStep = 'login_otp';
    } catch (error) {
      console.error('[LOGIN FLOW] Error requesting OTP:', error);
      await ctx.reply(
        `❌ Failed to request OTP: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again later.`,
      );
      session.currentStep = undefined;
    }
    return;
  }
  
  // Handle OTP input
  if (session.currentStep === 'login_otp') {
    console.log('[LOGIN FLOW] Processing OTP input');
    
    // Validate OTP format (numeric)
    if (!/^\d+$/.test(text)) {
      console.log('[LOGIN FLOW] Invalid OTP format (not numeric)');
      await ctx.reply('❌ Invalid OTP format. Please enter a numeric OTP code:');
      return;
    }
    
    try {
      console.log('[LOGIN FLOW] OTP format valid');
      const email = session.tempData?.email;
      const sid = session.tempData?.sid;
      
      if (!email) {
        console.error('[LOGIN FLOW] Email not found in session');
        throw new Error('Email not found in session');
      }
      
      if (!sid) {
        console.error('[LOGIN FLOW] Session ID not found in session');
        throw new Error('Session ID not found. Please restart the login process.');
      }
      
      console.log(`[LOGIN FLOW] Retrieved email from session: ${email}`);
      console.log(`[LOGIN FLOW] Retrieved session ID from session: ${sid}`);
      
      // Authenticate with OTP
      await ctx.reply('🔄 Authenticating...');
      
      console.log('[LOGIN FLOW] Preparing to authenticate with OTP');
      console.log('[LOGIN FLOW] Authentication payload:', { 
        email, 
        otpLength: text.length,
        hasSid: !!sid
      });
      
      try {
        console.log('[LOGIN FLOW] Calling authenticateWithOtp API');
        const response = await authApi.authenticateWithOtp({
          email,
          otp: text,
          sid,
        });
        console.log('[LOGIN FLOW] Authentication successful');
        console.log('[LOGIN FLOW] Auth response:', response);
        
        // Extract data directly from the response
        const { accessToken, accessTokenId, user } = response;
        // For backward compatibility, use the accessToken as refreshToken if no separate refreshToken is provided
        const refreshToken = response.refreshToken || accessTokenId || accessToken;
        
        console.log('[LOGIN FLOW] Received tokens and user data');
        
        // Set auth data in session
        console.log('[LOGIN FLOW] Setting auth data in session');
        setAuthData(
          ctx,
          accessToken,
          refreshToken,
          user.id,
          user.email,
          user.organizationId,
        );
        
        // Clear temporary data
        console.log('[LOGIN FLOW] Clearing temporary data');
        clearTempData(ctx);
        
        // Send success message
        console.log('[LOGIN FLOW] Sending success message');
        await ctx.reply(
          `✅ Successfully logged in as *${user.email}*.\n\nYou can now use all the features of the Copperx Payout Bot.`,
          {
            parse_mode: 'Markdown',
          },
        );
        
        // Set up notifications
        if (ctx.chat && ctx.chat.id) {
          console.log('[LOGIN FLOW] Setting up notifications');
          setupNotifications(
            null,
            ctx.chat.id,
            accessToken,
            user.organizationId,
          );
        }
        
        // Show main menu
        console.log('[LOGIN FLOW] Showing main menu');
        await ctx.reply('Please select an option:', mainMenuKeyboard());
        
        // Reset step
        console.log('[LOGIN FLOW] Resetting current step');
        session.currentStep = undefined;
      } catch (authError) {
        console.error('[LOGIN FLOW] Authentication API error:', authError);
        
        // Extract the error message
        const errorMessage = authError instanceof Error 
          ? authError.message 
          : 'Unknown authentication error';
        
        console.error('[LOGIN FLOW] Error message:', errorMessage);
        
        // Check for common error patterns
        if (errorMessage.includes('Invalid OTP') || errorMessage.includes('expired')) {
          console.log('[LOGIN FLOW] Detected invalid/expired OTP error');
          await ctx.reply(
            '❌ Invalid or expired OTP code. Please try again with /login.',
          );
        } else if (errorMessage.includes('not found') || errorMessage.includes('email')) {
          console.log('[LOGIN FLOW] Detected email not found error');
          await ctx.reply(
            '❌ Email address not found or not registered. Please check your email and try again with /login.',
          );
        } else {
          console.log('[LOGIN FLOW] General authentication error');
          await ctx.reply(
            `❌ Authentication failed: ${errorMessage}\n\nPlease try again with /login.`,
          );
        }
        
        console.log('[LOGIN FLOW] Resetting current step after error');
        session.currentStep = undefined;
      }
    } catch (error) {
      console.error('[LOGIN FLOW] Login flow error:', error);
      await ctx.reply(
        '❌ An unexpected error occurred during login. Please try again with /login.',
      );
      console.log('[LOGIN FLOW] Resetting current step after unexpected error');
      session.currentStep = undefined;
    }
    return;
  }
  
  console.log('[LOGIN FLOW] Passing to next handler (step not recognized)');
  return next();
});

export default Composer.compose([loginCommand, loginFlow]);