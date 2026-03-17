/**
 * @file Service Registry Configuration
 * @description Maps microservice identifiers to their internal network endpoints
 *
 * Network Architecture:
 * - Gateway acts as the single entry point (API Gateway Pattern)
 * - All microservices are isolated in an internal Docker network
 * - External clients cannot access microservices directly
 * - Gateway performs authentication before routing to internal services
 */

import { ServiceRegistryEntry } from '../types';

/**
 * Service Registry: Maps service names to internal network addresses
 *
 * In production, these URLs point to:
 * - Docker containers on an internal bridge network
 * - Kubernetes services within a cluster namespace
 * - Private subnet instances in cloud environments
 */
export const SERVICE_REGISTRY: Record<string, ServiceRegistryEntry> = {
  users: {
    name: 'User Management Service',
    url: process.env.USER_SERVICE_URL || 'http://user-service:3001',
    healthCheckEndpoint: '/health',
    timeout: 5000,
  },
  payments: {
    name: 'Payment Processing Service',
    url: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3002',
    healthCheckEndpoint: '/health',
    timeout: 10000, // Higher timeout for payment operations
  },
  orders: {
    name: 'Order Management Service',
    url: process.env.ORDER_SERVICE_URL || 'http://order-service:3003',
    healthCheckEndpoint: '/health',
    timeout: 5000,
  },
  analytics: {
    name: 'Analytics & Reporting Service',
    url: process.env.ANALYTICS_SERVICE_URL || 'http://analytics-service:3004',
    healthCheckEndpoint: '/health',
    timeout: 15000, // Analytics queries may take longer
  },
};

/**
 * Retrieves service configuration by name
 * @param serviceName - The identifier of the target service
 * @returns Service configuration or undefined if not found
 */
export function getServiceConfig(
  serviceName: string
): ServiceRegistryEntry | undefined {
  return SERVICE_REGISTRY[serviceName];
}

/**
 * Lists all registered service names
 * @returns Array of service identifiers
 */
export function listServices(): string[] {
  return Object.keys(SERVICE_REGISTRY);
}
