/**
 * @file Authentication Middleware Tests
 * @description Comprehensive test suite for JWT authentication and authorization
 */

import request from 'supertest';
import createApp from '../src/server';
import { generateToken } from '../src/utils/jwt';
import { JWTPayload } from '../src/types';

const app = createApp();

describe('Authentication Middleware', () => {
  describe('POST /auth/login', () => {
    it('should generate valid JWT token with correct credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
          role: 'user',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.expiresIn).toBe('24h');
    });

    it('should return 400 if email is missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Email and password are required');
    });

    it('should return 400 if password is missing', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
        })
        .expect(400);

      expect(response.body.error).toBe('Bad Request');
    });

    it('should generate admin token with admin role', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'admin123',
          role: 'admin',
        })
        .expect(200);

      expect(response.body.data.user.role).toBe('admin');
    });
  });

  describe('Protected Routes - Gateway', () => {
    let validToken: string;
    let invalidToken: string;

    beforeAll(() => {
      // Generate valid token
      const payload: JWTPayload = {
        userId: 'test123',
        email: 'test@example.com',
        role: 'user',
        permissions: ['users:read', 'payments:read'],
      };
      validToken = generateToken(payload);

      // Generate tokens for testing
      invalidToken = 'invalid.token.signature';
    });

    it('should allow access with valid JWT token', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticated).toBe(true);
    });

    it('should reject request without Authorization header', async () => {
      const response = await request(app).get('/api/v1/').expect(401);

      expect(response.body.error).toBe('Unauthorized');
      expect(response.body.message).toContain('Authentication token is required');
    });

    it('should reject request with invalid token format', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should reject request with malformed token', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(403);

      expect(response.body.error).toBe('Forbidden');
      expect(response.body.message).toContain('Invalid token');
    });

    it('should reject request with missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', validToken)
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });

    it('should return user information in gateway response', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.userId).toBe('test123');
      expect(response.body.data.user.role).toBe('user');
    });
  });

  describe('Public Routes', () => {
    it('should allow access to health endpoint without token', async () => {
      const response = await request(app).get('/health').expect(200);

      expect(response.body.status).toBe('healthy');
    });

    it('should allow access to status endpoint without token', async () => {
      const response = await request(app).get('/status').expect(200);

      expect(response.body.name).toBe('Nexus Gateway');
      expect(response.body.version).toBe('1.0.0');
    });

    it('should allow access to root endpoint without token', async () => {
      const response = await request(app).get('/').expect(200);

      expect(response.body.name).toBe('Nexus Gateway');
      expect(response.body.documentation).toBe('/status');
    });
  });

  describe('Rate Limiting', () => {
    it('should not rate limit normal request volume', async () => {
      // Make 5 requests (well below limit)
      for (let i = 0; i < 5; i++) {
        await request(app).get('/health').expect(200);
      }
    });

    // Note: Full rate limit testing would require many requests
    // In production, use dedicated load testing tools
  });

  describe('Error Handling', () => {
    it('should return 404 for undefined routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body.error).toBe('Not Found');
      expect(response.body.statusCode).toBe(404);
    });

    it('should return timestamp in error responses', async () => {
      const response = await request(app).get('/api/v1/').expect(401);

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(0);
    });
  });
});
