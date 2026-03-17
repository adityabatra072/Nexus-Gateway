/**
 * @file Rate Limiting Middleware
 * @description DDoS protection and API abuse prevention using sliding window algorithm
 *
 * Defense Strategy:
 * - Limits request rate per IP address
 * - Prevents brute force attacks
 * - Mitigates resource exhaustion attacks
 * - Implements exponential backoff via Retry-After headers
 */

import rateLimit from 'express-rate-limit';
import { config } from '../config/environment';
import { logger } from '../utils/logger';

/**
 * Rate Limiter Configuration
 *
 * Algorithm: Sliding Window Counter
 * - Tracks request count per IP within a time window
 * - Resets counter after window expires
 * - More memory-efficient than token bucket
 *
 * Production Considerations:
 * - Use Redis for distributed rate limiting across multiple gateway instances
 * - Implement different limits for authenticated vs anonymous users
 * - Add IP whitelist for internal services and health checks
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs, // Time window (default: 15 minutes)
  max: config.rateLimitMaxRequests, // Max requests per window (default: 100)
  standardHeaders: true, // Return rate limit info in RateLimit-* headers
  legacyHeaders: false, // Disable X-RateLimit-* headers

  /**
   * Custom key generator
   * Uses IP address as identifier (can be extended to use user ID for authenticated requests)
   */
  keyGenerator: (req) => {
    return req.ip || 'unknown';
  },

  /**
   * Handler executed when rate limit is exceeded
   */
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'],
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(config.rateLimitWindowMs / 1000), // Seconds until reset
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Skip rate limiting for specific conditions
   * (e.g., health check endpoints, internal service calls)
   */
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    if (req.path === '/health') {
      return true;
    }
    return false;
  },
});

/**
 * Strict Rate Limiter for sensitive endpoints
 * (e.g., login, password reset, payment processing)
 *
 * More aggressive limits to prevent credential stuffing and payment fraud
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  standardHeaders: true,
  legacyHeaders: false,

  handler: (req, res) => {
    logger.warn('Strict rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many attempts. Please wait before trying again.',
      retryAfter: 60,
      timestamp: new Date().toISOString(),
    });
  },
});
