/**
 * @file HTTP Proxy Service
 * @description Handles request forwarding to internal microservices with timeout and error handling
 *
 * Network Architecture:
 * - Gateway acts as reverse proxy
 * - Forwards authenticated requests to internal services
 * - Handles connection timeouts and service failures
 * - Implements circuit breaker pattern (can be extended)
 */

import { Request, Response } from 'express';
import { getServiceConfig } from '../config/services';
import { logger } from '../utils/logger';

/**
 * Forwards HTTP request to target microservice
 *
 * Process Flow:
 * 1. Resolve service URL from registry
 * 2. Construct target URL with path and query parameters
 * 3. Forward request with original headers
 * 4. Handle timeouts and network errors
 * 5. Return proxied response to client
 *
 * @param serviceName - Target service identifier
 * @param req - Express request object
 * @param res - Express response object
 */
export async function proxyRequest(
  serviceName: string,
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();

  try {
    // Step 1: Resolve service configuration
    const serviceConfig = getServiceConfig(serviceName);

    if (!serviceConfig) {
      logger.error('Service not found in registry', undefined, {
        serviceName,
        availableServices: require('../config/services').listServices(),
      });

      res.status(502).json({
        error: 'Bad Gateway',
        message: `Service '${serviceName}' is not available`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Step 2: Construct target URL
    const targetPath = req.path.replace(`/api/v1/${serviceName}`, '');
    const targetUrl = `${serviceConfig.url}${targetPath}`;
    const queryString = new URLSearchParams(req.query as any).toString();
    const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

    logger.debug('Proxying request to internal service', {
      serviceName,
      targetUrl: fullUrl,
      method: req.method,
    });

    // Step 3: Forward request using fetch (Node.js 18+)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, serviceConfig.timeout || 5000);

    try {
      const response = await fetch(fullUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': req.ip || 'unknown',
          'X-Gateway-Request-Id': generateRequestId(),
          ...(req.headers['user-agent'] && {
            'User-Agent': req.headers['user-agent'],
          }),
        },
        ...(req.method !== 'GET' &&
          req.method !== 'HEAD' && {
            body: JSON.stringify(req.body),
          }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Step 4: Parse and forward response
      const data = await response.json();

      const duration = Date.now() - startTime;
      logger.info('Request proxied successfully', {
        serviceName,
        statusCode: response.status,
        duration,
        path: req.path,
      });

      res.status(response.status).json(data);
    } catch (error) {
      clearTimeout(timeout);

      // Handle timeout
      if ((error as Error).name === 'AbortError') {
        logger.error('Service timeout', error as Error, {
          serviceName,
          targetUrl: fullUrl,
          timeout: serviceConfig.timeout,
        });

        res.status(504).json({
          error: 'Gateway Timeout',
          message: `Service '${serviceName}' did not respond in time`,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Handle network errors
      logger.error('Service proxy error', error as Error, {
        serviceName,
        targetUrl: fullUrl,
      });

      res.status(502).json({
        error: 'Bad Gateway',
        message: `Failed to communicate with service '${serviceName}'`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Unexpected proxy error', error as Error, {
      serviceName,
      path: req.path,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Request forwarding failed',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Generates unique request ID for distributed tracing
 * In production, use UUIDs or correlation IDs from APM tools
 */
function generateRequestId(): string {
  return `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Mock service response generator (for testing without actual microservices)
 *
 * @param serviceName - Service identifier
 * @param endpoint - Requested endpoint path
 * @returns Mock response data
 */
export function getMockResponse(serviceName: string, _endpoint: string): any {
  const mockData: Record<string, any> = {
    users: {
      success: true,
      data: [
        { id: '1', name: 'John Doe', email: 'john@example.com' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com' },
      ],
      message: 'Users retrieved successfully',
    },
    payments: {
      success: true,
      data: {
        transactionId: 'txn_1234567890',
        amount: 99.99,
        currency: 'USD',
        status: 'completed',
      },
      message: 'Payment processed successfully',
    },
    orders: {
      success: true,
      data: [
        { orderId: 'ORD-001', status: 'shipped', total: 149.99 },
        { orderId: 'ORD-002', status: 'pending', total: 79.99 },
      ],
      message: 'Orders retrieved successfully',
    },
    analytics: {
      success: true,
      data: {
        totalUsers: 15420,
        activeUsers: 3245,
        revenue: 125340.5,
        conversionRate: 2.34,
      },
      message: 'Analytics data retrieved successfully',
    },
  };

  return (
    mockData[serviceName] || {
      success: false,
      message: 'Service not found',
    }
  );
}
