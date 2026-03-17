/**
 * @file Nexus Gateway - Main Application Server
 * @description Production-grade API Gateway with authentication, rate limiting, and microservice routing
 *
 * Architecture:
 * - Single entry point for all client requests
 * - JWT-based authentication layer
 * - Reverse proxy to internal microservices
 * - Rate limiting and DDoS protection
 * - Health checks for Kubernetes/Docker
 * - Graceful shutdown handling
 *
 * @author Aditya Batra
 * @version 1.0.0
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/environment';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import route handlers
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import gatewayRoutes from './routes/gateway';

/**
 * Initialize Express application with security middleware
 */
function createApp(): Application {
  const app: Application = express();

  // ===== Security Middleware =====
  // Helmet: Sets secure HTTP headers (XSS protection, CSP, etc.)
  app.use(helmet());

  // CORS: Configure Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS
        ? process.env.ALLOWED_ORIGINS.split(',')
        : '*', // In production: Whitelist specific origins
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
      maxAge: 86400, // Cache preflight requests for 24 hours
    })
  );

  // ===== Request Parsing Middleware =====
  app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
  app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

  // ===== Rate Limiting =====
  // Apply global rate limiter to all routes
  app.use(rateLimiter);

  // ===== Request Logging =====
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    next();
  });

  // ===== Public Routes (No Authentication Required) =====
  app.use('/', healthRoutes); // Health checks for orchestration
  app.use('/auth', authRoutes); // Login and token generation

  // ===== Protected Routes (Authentication Required) =====
  // All routes under /api/v1 require valid JWT token
  app.use('/api/v1', authMiddleware, gatewayRoutes);

  // ===== Root Endpoint =====
  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'Nexus Gateway',
      version: '1.0.0',
      description: 'Secure API Gateway with JWT Authentication',
      documentation: '/status',
      health: '/health',
      login: '/auth/login',
      timestamp: new Date().toISOString(),
    });
  });

  // ===== Error Handling =====
  app.use(notFoundHandler); // 404 handler for undefined routes
  app.use(errorHandler); // Global error handler

  return app;
}

/**
 * Start the HTTP server
 */
export function startServer(): void {
  const app = createApp();
  const port = config.port;

  const server = app.listen(port, () => {
    logger.info('Nexus Gateway started successfully', {
      port,
      environment: config.nodeEnv,
      pid: process.pid,
      version: '1.0.0',
    });

    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║             🚀 NEXUS GATEWAY OPERATIONAL 🚀              ║
║                                                           ║
║  Status:      RUNNING                                     ║
║  Port:        ${port}                                         ║
║  Environment: ${config.nodeEnv.toUpperCase().padEnd(41)}║
║  PID:         ${process.pid.toString().padEnd(41)}║
║                                                           ║
║  📊 Endpoints:                                            ║
║    • Health:  http://localhost:${port}/health               ║
║    • Status:  http://localhost:${port}/status               ║
║    • Login:   http://localhost:${port}/auth/login           ║
║    • Gateway: http://localhost:${port}/api/v1/*             ║
║                                                           ║
║  🔐 Security: JWT Authentication + Rate Limiting          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // ===== Graceful Shutdown Handling =====
  // Ensures in-flight requests complete before shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections, flush logs, etc.
      // await database.disconnect();
      // await cache.disconnect();

      logger.info('Graceful shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  // Listen for termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled rejection', reason);
    shutdown('unhandledRejection');
  });
}

// Start server if run directly
if (require.main === module) {
  startServer();
}

// Export for testing
export default createApp;
