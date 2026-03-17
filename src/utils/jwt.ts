/**
 * @file JWT Token Utility Functions
 * @description Cryptographic token generation and validation using RS256/HS256 algorithms
 */

import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import { config } from '../config/environment';
import { logger } from './logger';

/**
 * Generates a signed JWT token
 *
 * Security Considerations:
 * - Uses HS256 (HMAC with SHA-256) for symmetric encryption
 * - In production, consider RS256 (RSA) with public/private key pairs
 * - Tokens are stateless; revocation requires a blacklist mechanism
 *
 * @param payload - User identification and authorization data
 * @returns Signed JWT token string
 */
export function generateToken(payload: JWTPayload): string {
  try {
    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiration as string | number,
      algorithm: 'HS256',
      issuer: 'nexus-gateway',
      audience: 'nexus-services',
    } as jwt.SignOptions);

    logger.debug('JWT token generated', {
      userId: payload.userId,
      role: payload.role,
    });

    return token;
  } catch (error) {
    logger.error('Failed to generate JWT token', error as Error);
    throw new Error('Token generation failed');
  }
}

/**
 * Verifies and decodes a JWT token
 *
 * Validation Process:
 * 1. Signature verification (cryptographic integrity)
 * 2. Expiration check (temporal validity)
 * 3. Issuer/Audience validation (origin verification)
 *
 * @param token - JWT token string from Authorization header
 * @returns Decoded payload if valid
 * @throws Error if token is invalid, expired, or malformed
 */
export function verifyToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'nexus-gateway',
      audience: 'nexus-services',
    }) as JWTPayload;

    logger.debug('JWT token verified', {
      userId: decoded.userId,
      role: decoded.role,
    });

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('JWT token expired', { error: error.message });
      throw new Error('Token expired');
    }

    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Invalid JWT token', { error: error.message });
      throw new Error('Invalid token');
    }

    logger.error('JWT verification failed', error as Error);
    throw new Error('Token verification failed');
  }
}

/**
 * Extracts token from Authorization header
 *
 * Expected format: "Bearer <token>"
 *
 * @param authHeader - Authorization header value
 * @returns Extracted token or null if invalid format
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    logger.warn('Invalid Authorization header format', {
      header: authHeader.substring(0, 20) + '...',
    });
    return null;
  }

  return parts[1];
}
