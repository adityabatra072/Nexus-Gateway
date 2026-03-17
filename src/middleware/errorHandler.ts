/**
 * @file Global Error Handler Middleware
 * @description Centralized error processing with security-conscious error responses
 *
 * Security Principles:
 * - Don't leak internal implementation details
 * - Sanitize error messages in production
 * - Log full error context for debugging
 * - Return consistent error format
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiErrorResponse } from '../types';

/**
 * Global Error Handler
 *
 * Catches all unhandled errors from routes and middleware
 * Prevents sensitive information leakage to clients
 *
 * @param err - Error object thrown by application code
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware (required for Express error handler signature)
 */
export function errorHandler(
  err: Error & { statusCode?: number; code?: string },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error context for debugging
  logger.error('Unhandled error', err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Sanitize error message for production
  const isDevelopment = process.env.NODE_ENV === 'development';
  const errorMessage = isDevelopment
    ? err.message
    : 'An unexpected error occurred';

  // Construct standardized error response
  const errorResponse: ApiErrorResponse = {
    error: getErrorName(statusCode),
    message: errorMessage,
    statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  // Include stack trace only in development
  if (isDevelopment && err.stack) {
    (errorResponse as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Maps HTTP status codes to error names
 */
function getErrorName(statusCode: number): string {
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };

  return errorNames[statusCode] || 'Error';
}

/**
 * 404 Not Found Handler
 *
 * Catches requests to undefined routes
 * Should be registered after all valid routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
}
