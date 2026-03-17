/**
 * @file Authentication Firewall Middleware
 * @description Zero-Trust security layer that validates JWT tokens before allowing access
 *
 * Security Model:
 * - Default Deny: All requests are blocked unless explicitly authenticated
 * - Token-Based Authentication: Stateless JWT verification
 * - Defense in Depth: Multiple validation layers (format, signature, expiration, claims)
 *
 * Attack Vectors Mitigated:
 * - Unauthorized access attempts
 * - Token forgery (cryptographic signature verification)
 * - Replay attacks (expiration timestamps)
 * - Malformed tokens (strict format validation)
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import { extractToken, verifyToken } from '../utils/jwt';
import { logger } from '../utils/logger';

/**
 * Authentication Middleware
 *
 * Request Flow:
 * 1. Extract "Authorization: Bearer <token>" header
 * 2. Validate token format
 * 3. Verify cryptographic signature
 * 4. Check expiration timestamp
 * 5. Inject decoded user data into request object
 * 6. Pass control to next handler
 *
 * Failure Modes:
 * - 401 Unauthorized: Missing or malformed token
 * - 403 Forbidden: Valid token format but invalid signature/expired
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Next middleware in chain
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const startTime = Date.now();

  try {
    // Phase 1: Token Extraction
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (!token) {
      logger.warn('Authentication failed: Missing or invalid token format', {
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token is required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Phase 2: Token Verification (Cryptographic + Expiration)
    try {
      const decoded = verifyToken(token);

      // Phase 3: Inject User Context
      req.user = decoded;

      // Security Audit Log
      logger.info('Authentication successful', {
        userId: decoded.userId,
        role: decoded.role,
        path: req.path,
        method: req.method,
        ip: req.ip,
        duration: Date.now() - startTime,
      });

      // Pass control to next middleware/route handler
      next();
    } catch (error) {
      // Token verification failed (expired, invalid signature, etc.)
      logger.warn('Authentication failed: Invalid token', {
        error: (error as Error).message,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: (error as Error).message || 'Invalid or expired token',
        timestamp: new Date().toISOString(),
      });
      return;
    }
  } catch (error) {
    // Unexpected error in middleware
    logger.error('Authentication middleware error', error as Error, {
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication processing failed',
      timestamp: new Date().toISOString(),
    });
    return;
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware Factory
 *
 * Creates middleware that enforces role-based permissions
 *
 * @param allowedRoles - Array of roles permitted to access the route
 * @returns Middleware function that checks user role
 *
 * @example
 * router.get('/admin/users', requireRole(['admin']), getUsers);
 */
export function requireRole(allowedRoles: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Authorization failed: Insufficient permissions', {
        userId: req.user.userId,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions for this resource',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

/**
 * Permission-Based Access Control Middleware Factory
 *
 * Fine-grained access control based on specific permissions
 *
 * @param requiredPermission - Permission string required for access
 * @returns Middleware function that checks user permissions
 *
 * @example
 * router.delete('/users/:id', requirePermission('users:delete'), deleteUser);
 */
export function requirePermission(requiredPermission: string) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      logger.warn('Authorization failed: Missing required permission', {
        userId: req.user.userId,
        requiredPermission,
        userPermissions: req.user.permissions,
        path: req.path,
      });

      res.status(403).json({
        error: 'Forbidden',
        message: `Permission '${requiredPermission}' is required`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
