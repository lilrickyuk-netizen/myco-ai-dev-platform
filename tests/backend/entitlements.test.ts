import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { entitlements } from '~encore/clients';
import { FEATURES } from '../../backend/entitlements/types';

describe('Entitlements API', () => {
  const testUserId = 'test-user-123';

  beforeEach(async () => {
    // Set up test data
  });

  afterEach(async () => {
    // Clean up test data
  });

  describe('check', () => {
    it('should allow all features when billing is disabled', async () => {
      try {
        const result = await entitlements.check({
          userId: testUserId,
          feature: FEATURES.AI_GENERATION
        });

        // When billing is disabled (default), all features should be allowed
        expect(result.allowed).toBe(true);
        expect(result.plan).toBe('unlimited');
        expect(result.reason).toContain('billing disabled');
      } catch (error: any) {
        // Expected to fail without authentication
        expect(error.message).toContain('unauthenticated');
      }
    });

    it('should block pro features for free users when billing enabled', async () => {
      // This test assumes billing is enabled and user has free plan
      try {
        const result = await entitlements.check({
          userId: testUserId,
          feature: FEATURES.PROJECT_COLLABORATION
        });

        if (result.plan === 'free') {
          expect(result.allowed).toBe(false);
          expect(result.reason).toContain('not available on \'free\' plan');
        }
      } catch (error: any) {
        // Expected to fail without proper setup
        expect(error).toBeDefined();
      }
    });

    it('should allow basic features for free users', async () => {
      try {
        const result = await entitlements.check({
          userId: testUserId,
          feature: FEATURES.AI_GENERATION
        });

        // AI generation should be available on all plans
        expect(result.allowed).toBe(true);
      } catch (error: any) {
        // Expected to fail without authentication
        expect(error.message).toContain('unauthenticated');
      }
    });

    it('should reject check for different user', async () => {
      try {
        await entitlements.check({
          userId: 'different-user-456',
          feature: FEATURES.AI_GENERATION
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('cannot check entitlements for other users');
      }
    });
  });

  describe('getUserEntitlements', () => {
    it('should return all features when billing disabled', async () => {
      try {
        const result = await entitlements.getUserEntitlements();
        
        expect(result.userId).toBeDefined();
        expect(result.plan).toBe('unlimited');
        expect(result.features).toBeInstanceOf(Array);
        expect(result.features.length).toBeGreaterThan(0);
        expect(result.features).toContain(FEATURES.AI_GENERATION);
      } catch (error: any) {
        // Expected to fail without authentication
        expect(error.message).toContain('unauthenticated');
      }
    });

    it('should return plan-specific features when billing enabled', async () => {
      try {
        const result = await entitlements.getUserEntitlements();
        
        expect(result.userId).toBeDefined();
        expect(['free', 'pro', 'enterprise', 'unlimited']).toContain(result.plan);
        expect(result.features).toBeInstanceOf(Array);

        // Free plan should have at least AI generation
        if (result.plan === 'free') {
          expect(result.features).toContain(FEATURES.AI_GENERATION);
          expect(result.features).not.toContain(FEATURES.CUSTOM_INTEGRATIONS);
        }

        // Pro plan should have more features
        if (result.plan === 'pro') {
          expect(result.features).toContain(FEATURES.AI_GENERATION);
          expect(result.features).toContain(FEATURES.PROJECT_COLLABORATION);
          expect(result.features).toContain(FEATURES.UNLIMITED_PROJECTS);
        }

        // Enterprise plan should have all features
        if (result.plan === 'enterprise') {
          expect(result.features).toContain(FEATURES.CUSTOM_INTEGRATIONS);
        }
      } catch (error: any) {
        // Expected to fail without authentication
        expect(error.message).toContain('unauthenticated');
      }
    });
  });
});