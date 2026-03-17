/**
 * @file Environment Configuration Manager
 * @description Centralized configuration loader with validation and type safety
 */

import dotenv from 'dotenv';
import { GatewayConfig } from '../types';

// Load environment variables from .env file
dotenv.config();

/**
 * Validates required environment variables
 * @throws Error if critical configuration is missing
 */
function validateEnvironment(): void {
  const required = ['JWT_SECRET', 'PORT'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
}

/**
 * Loads and validates gateway configuration
 * @returns Validated configuration object
 */
export function loadConfig(): GatewayConfig {
  validateEnvironment();

  return {
    port: parseInt(process.env.PORT || '8080', 10),
    jwtSecret: process.env.JWT_SECRET!,
    jwtExpiration: process.env.JWT_EXPIRATION || '24h',
    rateLimitWindowMs: parseInt(
      process.env.RATE_LIMIT_WINDOW_MS || '900000',
      10
    ),
    rateLimitMaxRequests: parseInt(
      process.env.RATE_LIMIT_MAX_REQUESTS || '100',
      10
    ),
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

// Export singleton config instance
export const config = loadConfig();
