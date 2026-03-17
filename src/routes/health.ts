/**
 * @file Health Check Routes
 * @description Kubernetes/Docker liveness and readiness probes
 *
 * Purpose:
 * - Liveness: Is the application running? (restart if not)
 * - Readiness: Can the application serve traffic? (remove from load balancer if not)
 * - Metrics: Expose operational metrics for monitoring
 */

import { Router, Request, Response } from 'express';
import { listServices } from '../config/services';

const router = Router();

// Application start time (for uptime calculation)
const startTime = Date.now();

/**
 * Liveness Probe
 *
 * Kubernetes uses this to determine if pod should be restarted
 * Should only fail if application is in unrecoverable state
 */
router.get('/health', (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Probe
 *
 * Kubernetes uses this to determine if pod can receive traffic
 * Should check:
 * - Database connectivity
 * - External service dependencies
 * - Resource availability (memory, disk)
 */
router.get('/ready', (_req: Request, res: Response): void => {
  // In production: Check critical dependencies
  const isReady = checkReadiness();

  if (isReady) {
    res.status(200).json({
      status: 'ready',
      services: listServices(),
      timestamp: new Date().toISOString(),
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      message: 'Gateway is not ready to serve traffic',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Metrics Endpoint
 *
 * Prometheus/Grafana can scrape this for monitoring
 * Exposes operational metrics
 */
router.get('/metrics', (_req: Request, res: Response): void => {
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const memoryUsage = process.memoryUsage();

  res.status(200).json({
    uptime: {
      seconds: uptime,
      formatted: formatUptime(uptime),
    },
    memory: {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
    },
    process: {
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    services: {
      registered: listServices().length,
      list: listServices(),
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Status Endpoint
 *
 * Human-readable status page
 * Shows gateway version, configuration, and health
 */
router.get('/status', (_req: Request, res: Response): void => {
  res.status(200).json({
    name: 'Nexus Gateway',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'operational',
    uptime: formatUptime(Math.floor((Date.now() - startTime) / 1000)),
    features: {
      authentication: 'JWT',
      rateLimiting: 'enabled',
      cors: 'enabled',
      helmet: 'enabled',
    },
    services: {
      available: listServices(),
      total: listServices().length,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * Helper: Check if gateway is ready to serve traffic
 * In production: Verify database connections, cache, etc.
 */
function checkReadiness(): boolean {
  // Simulate readiness checks
  // In production: ping database, check Redis, verify service mesh
  return true;
}

/**
 * Helper: Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);

  return parts.join(' ');
}

export default router;
