/**
 * @file Gateway Router - Network Traffic Controller
 * @description Routes authenticated requests to appropriate microservices
 *
 * Routing Strategy:
 * - Path-based routing: /api/v1/{service}/{endpoint}
 * - All routes protected by authentication middleware
 * - Requests forwarded to internal service mesh
 * - Mock responses used when services are unavailable (development mode)
 */

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { proxyRequest, getMockResponse } from '../services/proxyService';
import { logger } from '../utils/logger';
import { listServices } from '../config/services';

const router = Router();

/**
 * Dynamic Service Router
 *
 * Matches any request to /api/v1/{serviceName}/*
 * Forwards to corresponding internal microservice
 *
 * Examples:
 * - GET /api/v1/users/profile -> http://user-service:3001/profile
 * - POST /api/v1/payments/process -> http://payment-service:3002/process
 * - GET /api/v1/orders/123 -> http://order-service:3003/123
 */
router.use(
  '/:service',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const serviceName = req.params.service as string;

    logger.info('Gateway routing request', {
      service: serviceName,
      path: req.path,
      method: req.method,
      userId: req.user?.userId,
      role: req.user?.role,
    });

    // For development: Use mock responses if actual services aren't running
    const useMockData = process.env.USE_MOCK_DATA === 'true';

    if (useMockData) {
      logger.debug('Using mock service response', { service: serviceName });

      const mockResponse = getMockResponse(serviceName, req.path);
      res.status(200).json({
        ...mockResponse,
        timestamp: new Date().toISOString(),
        _mock: true, // Indicate this is mock data
      });
      return;
    }

    // Production: Forward to actual microservice
    await proxyRequest(serviceName, req, res);
  }
);

/**
 * Service Discovery Endpoint
 *
 * Returns list of available microservices
 * Useful for client-side routing and documentation
 */
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const services = listServices();

  res.status(200).json({
    success: true,
    message: 'Nexus Gateway - Available Services',
    data: {
      services: services.map((name) => ({
        name,
        endpoint: `/api/v1/${name}`,
      })),
      version: '1.0.0',
      authenticated: true,
      user: req.user
        ? {
            userId: req.user.userId,
            role: req.user.role,
          }
        : null,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
