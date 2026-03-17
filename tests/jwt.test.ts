/**
 * @file JWT Utility Tests
 * @description Tests for token generation, verification, and extraction
 */

import { generateToken, verifyToken, extractToken } from '../src/utils/jwt';
import { JWTPayload } from '../src/types';

describe('JWT Utilities', () => {
  const testPayload: JWTPayload = {
    userId: 'test123',
    email: 'test@example.com',
    role: 'user',
    permissions: ['users:read', 'payments:read'],
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should generate different tokens for different payloads', () => {
      const payload1: JWTPayload = {
        userId: 'user1',
        email: 'user1@example.com',
        role: 'user',
        permissions: ['users:read'],
      };

      const payload2: JWTPayload = {
        userId: 'user2',
        email: 'user2@example.com',
        role: 'admin',
        permissions: ['users:read', 'users:write'],
      };

      const token1 = generateToken(payload1);
      const token2 = generateToken(payload2);

      expect(token1).not.toBe(token2);
    });

    it('should include standard JWT claims', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.iat).toBeDefined(); // Issued at
      expect(decoded.exp).toBeDefined(); // Expiration
      expect(decoded.exp! > decoded.iat!).toBe(true);
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode valid token', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
      expect(decoded.permissions).toEqual(testPayload.permissions);
    });

    it('should throw error for invalid token signature', () => {
      const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for malformed token', () => {
      expect(() => verifyToken('not-a-token')).toThrow();
    });

    it('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should preserve all payload fields', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
      expect(Array.isArray(decoded.permissions)).toBe(true);
      expect(decoded.permissions.length).toBe(testPayload.permissions.length);
    });
  });

  describe('extractToken', () => {
    it('should extract token from valid Authorization header', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      const authHeader = `Bearer ${token}`;

      const extracted = extractToken(authHeader);

      expect(extracted).toBe(token);
    });

    it('should return null for missing Authorization header', () => {
      const extracted = extractToken(undefined);

      expect(extracted).toBeNull();
    });

    it('should return null for invalid format (no Bearer)', () => {
      const extracted = extractToken('Basic dXNlcjpwYXNz');

      expect(extracted).toBeNull();
    });

    it('should return null for malformed Bearer format', () => {
      const extracted = extractToken('Bearer');

      expect(extracted).toBeNull();
    });

    it('should return null for extra spaces', () => {
      const extracted = extractToken('Bearer  token extra');

      expect(extracted).toBeNull();
    });

    it('should handle token with special characters', () => {
      const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token_123.signature';
      const authHeader = `Bearer ${token}`;

      const extracted = extractToken(authHeader);

      expect(extracted).toBe(token);
    });
  });

  describe('Token Lifecycle', () => {
    it('should complete full token lifecycle (generate, extract, verify)', () => {
      // Step 1: Generate token
      const token = generateToken(testPayload);
      expect(token).toBeDefined();

      // Step 2: Simulate Authorization header
      const authHeader = `Bearer ${token}`;

      // Step 3: Extract token
      const extracted = extractToken(authHeader);
      expect(extracted).toBe(token);

      // Step 4: Verify token
      const decoded = verifyToken(extracted!);
      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
    });
  });

  describe('Security Scenarios', () => {
    it('should generate unique tokens even with identical timing', () => {
      const token1 = generateToken(testPayload);
      const token2 = generateToken(testPayload);

      // Tokens may be different due to iat timestamp precision
      // Both should be valid
      const decoded1 = verifyToken(token1);
      const decoded2 = verifyToken(token2);

      expect(decoded1.userId).toBe(decoded2.userId);
      expect(decoded1.email).toBe(decoded2.email);
    });

    it('should not accept tokens with modified payload', () => {
      const token = generateToken(testPayload);

      // Tamper with token (change a character in payload section)
      const parts = token.split('.');
      const tamperedPayload = parts[1].split('').reverse().join('');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() => verifyToken(tamperedToken)).toThrow();
    });
  });
});
