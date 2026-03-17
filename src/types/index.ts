/**
 * @file Type Definitions for Nexus Gateway
 * @description Centralized type definitions for authentication, routing, and service communication
 */

import { Request } from 'express';

/**
 * JWT Payload Structure
 * Contains user identification and authorization metadata
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user' | 'service';
  permissions: string[];
  iat?: number; // Issued at timestamp
  exp?: number; // Expiration timestamp
}

/**
 * Extended Express Request with authenticated user data
 * Middleware injects this after successful JWT validation
 */
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Microservice Response Format
 * Standardized response structure for all internal services
 */
export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

/**
 * Gateway Configuration
 * Runtime configuration for security and routing
 */
export interface GatewayConfig {
  port: number;
  jwtSecret: string;
  jwtExpiration: string;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  nodeEnv: string;
}

/**
 * Service Registry Entry
 * Maps service names to their internal network addresses
 */
export interface ServiceRegistryEntry {
  name: string;
  url: string;
  healthCheckEndpoint?: string;
  timeout?: number;
}

/**
 * API Error Response
 * Standardized error format for client responses
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path?: string;
}
