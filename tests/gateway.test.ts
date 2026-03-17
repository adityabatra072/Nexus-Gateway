/**
 * @file Gateway Router Tests
 * @description Tests for microservice routing and request forwarding
 */

import request from 'supertest';
import createApp from '../src/server';
import { generateToken } from '../src/utils/jwt';
import { JWTPayload } from '../src/types';

const app = createApp();

describe('Gateway Router', () => {
  let validToken: string;
  let adminToken: string;

  beforeAll(() => {
    // Generate test tokens
    const userPayload: JWTPayload = {
      userId: 'user123',
      email: 'user@example.com',
      role: 'user',
      permissions: ['users:read', 'payments:read', 'orders:read'],
    };
    validToken = generateToken(userPayload);

    const adminPayload: JWTPayload = {
      userId: 'admin123',
      email: 'admin@example.com',
      role: 'admin',
      permissions: [
        'users:read',
        'users:write',
        'payments:read',
        'orders:read',
        'analytics:read',
      ],
    };
    adminToken = generateToken(adminPayload);

    // Enable mock data for testing
    process.env.USE_MOCK_DATA = 'true';
  });

  describe('Service Discovery', () => {
    it('should return list of available services', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.services).toBeDefined();
      expect(Array.isArray(response.body.data.services)).toBe(true);
      expect(response.body.data.services.length).toBeGreaterThan(0);
    });

    it('should include service endpoints in discovery response', async () => {
      const response = await request(app)
        .get('/api/v1/')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      const services = response.body.data.services;
      const userService = services.find((s: any) => s.name === 'users');

      expect(userService).toBeDefined();
      expect(userService.endpoint).toBe('/api/v1/users');
    });
  });

  describe('User Service Routing', () => {
    it('should route GET requests to user service', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body._mock).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should route POST requests to user service', async () => {
      const response = await request(app)
        .post('/api/v1/users/create')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'John Doe', email: 'john@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Payment Service Routing', () => {
    it('should route payment requests with authentication', async () => {
      const response = await request(app)
        .get('/api/v1/payments/history')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should reject payment requests without token', async () => {
      await request(app).get('/api/v1/payments/history').expect(401);
    });
  });

  describe('Order Service Routing', () => {
    it('should route order requests to order service', async () => {
      const response = await request(app)
        .get('/api/v1/orders/list')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should support POST requests to order service', async () => {
      const response = await request(app)
        .post('/api/v1/orders/create')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          items: [{ id: '1', quantity: 2 }],
          total: 99.99,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Analytics Service Routing', () => {
    it('should route analytics requests with admin token', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should allow user access to analytics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/report')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Request Headers and Metadata', () => {
    it('should include timestamp in all responses', async () => {
      const response = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('should handle query parameters', async () => {
      const response = await request(app)
        .get('/api/v1/users/search?name=John&limit=10')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should support different HTTP methods', async () => {
      // GET
      await request(app)
        .get('/api/v1/users/list')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // POST
      await request(app)
        .post('/api/v1/users/create')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ name: 'Test' })
        .expect(200);

      // PUT
      await request(app)
        .put('/api/v1/users/update')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ id: '1', name: 'Updated' })
        .expect(200);

      // DELETE
      await request(app)
        .delete('/api/v1/users/delete')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle requests to unknown services gracefully', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-service/endpoint')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200); // Mock data returns 200 for any service

      expect(response.body).toBeDefined();
    });

    it('should require authentication for all gateway routes', async () => {
      await request(app).get('/api/v1/users/profile').expect(401);
      await request(app).get('/api/v1/payments/list').expect(401);
      await request(app).get('/api/v1/orders/list').expect(401);
      await request(app).get('/api/v1/analytics/data').expect(401);
    });
  });
});
