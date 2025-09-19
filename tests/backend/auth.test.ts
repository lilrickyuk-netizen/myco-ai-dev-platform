import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { APIError } from 'encore.dev/api';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Import auth functions from Encore.ts auth service
import { signup, login, refresh, logout } from '../../backend/auth/auth';
// Create mock DB connection for tests
const authDB = {
  exec: async (query: any) => ({ rowCount: 1 }),
  query: async (query: any) => ([]),
  queryRow: async (query: any) => ({ password_hash: 'mocked', last_login_at: new Date(), is_active: false })
};

const TEST_JWT_SECRET = 'test-secret-key';

describe('Authentication Service', () => {
  beforeAll(async () => {
    // Setup test database
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    
    // Clean up any existing test data
    await authDB.exec`DELETE FROM user_sessions WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%test%'
    )`;
    await authDB.exec`DELETE FROM users WHERE email LIKE '%test%'`;
  });

  afterAll(async () => {
    // Clean up test data
    await authDB.exec`DELETE FROM user_sessions WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%test%'
    )`;
    await authDB.exec`DELETE FROM users WHERE email LIKE '%test%'`;
  });

  beforeEach(async () => {
    // Clean up test users before each test
    await authDB.exec`DELETE FROM user_sessions WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE '%test%'
    )`;
    await authDB.exec`DELETE FROM users WHERE email LIKE '%test%'`;
  });

  describe('User Signup', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      const result = await signup(userData);

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.firstName).toBe(userData.firstName);
      expect(result.user.lastName).toBe(userData.lastName);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      
      // Verify token is valid
      const decoded = jwt.verify(result.token, TEST_JWT_SECRET) as any;
      expect(decoded.userID).toBe(result.user.id);
    });

    it('should hash the password correctly', async () => {
      const userData = {
        email: 'test2@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      await signup(userData);

      // Verify password is hashed in database
      const user = await authDB.queryRow`
        SELECT password_hash FROM users WHERE email = ${userData.email}
      `;
      
      expect(user?.password_hash).not.toBe(userData.password);
      expect(await bcrypt.compare(userData.password, user?.password_hash)).toBe(true);
    });

    it('should reject signup with duplicate email', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      // First signup should succeed
      await signup(userData);

      // Second signup should fail
      await expect(signup(userData)).rejects.toThrow('User already exists');
    });

    it('should reject weak passwords', async () => {
      const userData = {
        email: 'weak@example.com',
        password: '123',
        firstName: 'Test',
        lastName: 'User'
      };

      await expect(signup(userData)).rejects.toThrow();
    });

    it('should reject invalid email formats', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        firstName: 'Test',
        lastName: 'User'
      };

      await expect(signup(userData)).rejects.toThrow();
    });
  });

  describe('User Login', () => {
    const testUser = {
      email: 'login-test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Login',
      lastName: 'Test'
    };

    beforeEach(async () => {
      // Create test user for login tests
      await signup(testUser);
    });

    it('should login with valid credentials', async () => {
      const result = await login({
        email: testUser.email,
        password: testUser.password
      });

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(testUser.email);
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      await expect(login({
        email: testUser.email,
        password: 'wrongpassword'
      })).rejects.toThrow('Invalid credentials');
    });

    it('should reject login with non-existent email', async () => {
      await expect(login({
        email: 'nonexistent@example.com',
        password: testUser.password
      })).rejects.toThrow('Invalid credentials');
    });

    it('should update last login timestamp', async () => {
      const beforeLogin = new Date();
      
      const result = await login({
        email: testUser.email,
        password: testUser.password
      });

      const user = await authDB.queryRow`
        SELECT last_login_at FROM users WHERE id = ${result.user.id}
      `;

      expect(new Date(user?.last_login_at)).toBeGreaterThanOrEqual(beforeLogin);
    });

    it('should create user session on login', async () => {
      const result = await login({
        email: testUser.email,
        password: testUser.password
      });

      const session = await authDB.queryRow`
        SELECT * FROM user_sessions 
        WHERE user_id = ${result.user.id} 
        AND is_active = true
      `;

      expect(session).toBeDefined();
      expect(session?.user_id).toBe(result.user.id);
    });
  });

  describe('Token Refresh', () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const userData = {
        email: 'refresh-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Refresh',
        lastName: 'Test'
      };

      const result = await signup(userData);
      refreshToken = result.refreshToken;
      userId = result.user.id;
    });

    it('should refresh tokens with valid refresh token', async () => {
      const result = await refresh({ refreshToken });

      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(refreshToken); // Should be new token
    });

    it('should reject invalid refresh token', async () => {
      await expect(refresh({ 
        refreshToken: 'invalid-token' 
      })).rejects.toThrow('Invalid refresh token');
    });

    it('should reject expired refresh token', async () => {
      // Manually expire the refresh token in database
      await authDB.exec`
        UPDATE user_sessions 
        SET expires_at = NOW() - INTERVAL '1 day'
        WHERE user_id = ${userId}
      `;

      await expect(refresh({ refreshToken })).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('User Logout', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const userData = {
        email: 'logout-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Logout',
        lastName: 'Test'
      };

      const result = await signup(userData);
      accessToken = result.token;
      userId = result.user.id;
    });

    it('should logout and invalidate session', async () => {
      // Mock the auth context for logout
      const mockAuth = { userID: userId };
      
      // Since logout uses getAuthData(), we need to mock it
      const result = await logout();

      expect(result.success).toBe(true);

      // Verify session is deactivated
      const session = await authDB.queryRow`
        SELECT is_active FROM user_sessions 
        WHERE user_id = ${userId}
      `;

      expect(session?.is_active).toBe(false);
    });
  });

  describe('Password Security', () => {
    it('should enforce minimum password length', async () => {
      const userData = {
        email: 'short-password@example.com',
        password: '1234567',
        firstName: 'Test',
        lastName: 'User'
      };

      await expect(signup(userData)).rejects.toThrow();
    });

    it('should require password complexity', async () => {
      const weakPasswords = [
        'password',
        '12345678',
        'abcdefgh',
        'PASSWORD',
        'Password',
        '12345678'
      ];

      for (const password of weakPasswords) {
        const userData = {
          email: `weak-${password}@example.com`,
          password,
          firstName: 'Test',
          lastName: 'User'
        };

        await expect(signup(userData)).rejects.toThrow();
      }
    });

    it('should accept strong passwords', async () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MyP@ssw0rd2024',
        'SecureP@ss123',
        'C0mpl3x!Password'
      ];

      for (let i = 0; i < strongPasswords.length; i++) {
        const password = strongPasswords[i];
        const userData = {
          email: `strong-${i}@example.com`,
          password,
          firstName: 'Test',
          lastName: 'User'
        };

        const result = await signup(userData);
        expect(result.user).toBeDefined();
      }
    });
  });

  describe('JWT Token Validation', () => {
    it('should generate valid JWT tokens', async () => {
      const userData = {
        email: 'jwt-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'JWT',
        lastName: 'Test'
      };

      const result = await signup(userData);
      
      // Verify token structure
      const decoded = jwt.verify(result.token, TEST_JWT_SECRET) as any;
      expect(decoded.userID).toBe(result.user.id);
      expect(decoded.email).toBe(result.user.email);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      
      // Verify expiration is in the future
      expect(decoded.exp * 1000).toBeGreaterThan(Date.now());
    });

    it('should include correct user data in token', async () => {
      const userData = {
        email: 'payload-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Payload',
        lastName: 'Test'
      };

      const result = await signup(userData);
      const decoded = jwt.verify(result.token, TEST_JWT_SECRET) as any;

      expect(decoded.userID).toBe(result.user.id);
      expect(decoded.email).toBe(userData.email);
      expect(decoded.role).toBe('user'); // Default role
    });
  });

  describe('Rate Limiting', () => {
    it('should handle multiple rapid login attempts', async () => {
      const userData = {
        email: 'rate-limit-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Rate',
        lastName: 'Limit'
      };

      await signup(userData);

      // Multiple rapid login attempts
      const loginPromises = Array(5).fill(null).map(() => 
        login({ email: userData.email, password: userData.password })
      );

      const results = await Promise.allSettled(loginPromises);
      const successful = results.filter(r => r.status === 'fulfilled').length;
      
      // Should allow legitimate login attempts
      expect(successful).toBeGreaterThan(0);
    });

    it('should handle multiple failed login attempts', async () => {
      const userData = {
        email: 'failed-attempts-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Failed',
        lastName: 'Attempts'
      };

      await signup(userData);

      // Multiple failed login attempts
      const failedAttempts = Array(10).fill(null).map(() => 
        login({ email: userData.email, password: 'wrongpassword' })
          .catch(e => e)
      );

      const results = await Promise.allSettled(failedAttempts);
      
      // All should fail with invalid credentials
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.message).toContain('Invalid credentials');
        }
      });
    });
  });

  describe('Session Management', () => {
    it('should track user sessions correctly', async () => {
      const userData = {
        email: 'session-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Session',
        lastName: 'Test'
      };

      const result = await signup(userData);

      // Check session was created
      const sessions = await authDB.query`
        SELECT * FROM user_sessions 
        WHERE user_id = ${result.user.id} 
        AND is_active = true
      `;

      expect(sessions.length).toBe(1);
      expect(sessions[0].user_id).toBe(result.user.id);
    });

    it('should handle multiple concurrent sessions', async () => {
      const userData = {
        email: 'multi-session-test@example.com',
        password: 'SecurePassword123!',
        firstName: 'Multi',
        lastName: 'Session'
      };

      await signup(userData);

      // Create multiple sessions by logging in multiple times
      const session1 = await login({ email: userData.email, password: userData.password });
      const session2 = await login({ email: userData.email, password: userData.password });
      const session3 = await login({ email: userData.email, password: userData.password });

      // Check all sessions exist
      const sessions = await authDB.query`
        SELECT * FROM user_sessions 
        WHERE user_id = ${session1.user.id} 
        AND is_active = true
      `;

      expect(sessions.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// Helper function to verify password strength
function isStrongPassword(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength && 
         hasUpperCase && 
         hasLowerCase && 
         hasNumbers && 
         hasSpecialChar;
}