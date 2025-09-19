import { describe, it, expect, vi, beforeEach } from 'vitest';
import { login, register, getProfile, updateProfile } from './auth';
import type { LoginRequest, RegisterRequest, UpdateProfileRequest } from './user';

vi.mock('encore.dev/storage/sqldb', () => ({
  SQLDatabase: vi.fn().mockImplementation(() => ({
    query: vi.fn(),
    exec: vi.fn()
  }))
}));

vi.mock('~encore/auth', () => ({
  requireUser: vi.fn().mockReturnValue({ id: 'test-user' }),
  getAuthData: vi.fn().mockReturnValue({ userID: 'test-user' })
}));

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true)
}));

vi.mock('jsonwebtoken', () => ({
  sign: vi.fn().mockReturnValue('test-token'),
  verify: vi.fn().mockReturnValue({ userId: 'test-user' })
}));

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register user successfully', async () => {
      const request: RegisterRequest = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };

      const result = await register(request);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(request.email);
      expect(result.user.name).toBe(request.name);
      expect(result.token).toBe('test-token');
    });

    it('should validate email format', async () => {
      const request: RegisterRequest = {
        email: 'invalid-email',
        password: 'password123',
        name: 'Test User'
      };

      await expect(register(request)).rejects.toThrow('Invalid email format');
    });

    it('should validate password length', async () => {
      const request: RegisterRequest = {
        email: 'test@example.com',
        password: '123',
        name: 'Test User'
      };

      await expect(register(request)).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should handle duplicate email', async () => {
      const request: RegisterRequest = {
        email: 'existing@example.com',
        password: 'password123',
        name: 'Test User'
      };

      // Mock database to simulate existing user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{ id: 'existing-user' }]);

      await expect(register(request)).rejects.toThrow('Email already registered');
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock database to return user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: 'test-user',
          email: 'test@example.com',
          password_hash: 'hashed-password',
          name: 'Test User'
        }]);

      const result = await login(request);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.user.email).toBe(request.email);
      expect(result.token).toBe('test-token');
    });

    it('should handle invalid credentials', async () => {
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Mock database to return user but wrong password
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: 'test-user',
          email: 'test@example.com',
          password_hash: 'hashed-password',
          name: 'Test User'
        }]);

      vi.mocked(require('bcryptjs').compare).mockResolvedValueOnce(false);

      await expect(login(request)).rejects.toThrow('Invalid credentials');
    });

    it('should handle non-existent user', async () => {
      const request: LoginRequest = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      // Mock database to return no user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([]);

      await expect(login(request)).rejects.toThrow('User not found');
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      // Mock database to return user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: 'test-user',
          email: 'test@example.com',
          name: 'Test User',
          created_at: new Date(),
          updated_at: new Date()
        }]);

      const result = await getProfile();

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('name');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle user not found', async () => {
      // Mock database to return no user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([]);

      await expect(getProfile()).rejects.toThrow('User not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const request: UpdateProfileRequest = {
        name: 'Updated Name',
        email: 'updated@example.com'
      };

      // Mock database to return updated user
      vi.mocked(require('encore.dev/storage/sqldb').SQLDatabase().query)
        .mockResolvedValueOnce([{
          id: 'test-user',
          email: 'updated@example.com',
          name: 'Updated Name',
          created_at: new Date(),
          updated_at: new Date()
        }]);

      const result = await updateProfile(request);

      expect(result.name).toBe(request.name);
      expect(result.email).toBe(request.email);
    });

    it('should validate email format on update', async () => {
      const request: UpdateProfileRequest = {
        email: 'invalid-email'
      };

      await expect(updateProfile(request)).rejects.toThrow('Invalid email format');
    });
  });
});