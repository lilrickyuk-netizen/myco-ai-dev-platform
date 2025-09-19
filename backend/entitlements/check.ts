import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { EntitlementsRequest, EntitlementsResponse, PLAN_FEATURES } from "./types";

// Billing feature flag - set to 'true' to enable billing checks
const enableBilling = secret("EnableBilling");

// Checks if a user has access to a specific feature based on their subscription plan
export const check = api<EntitlementsRequest, EntitlementsResponse>(
  { expose: true, method: "POST", path: "/entitlements/check", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("user not authenticated");
    }

    // If user ID in request doesn't match authenticated user, only allow if it's the same user
    if (req.userId !== auth.userID) {
      throw APIError.permissionDenied("cannot check entitlements for other users");
    }

    try {
      // Check if billing is enabled
      const billingEnabled = enableBilling() === 'true';
      
      if (!billingEnabled) {
        // If billing is disabled, allow all features
        return {
          allowed: true,
          plan: 'unlimited',
          reason: 'billing disabled - all features enabled'
        };
      }

      // Get user's current subscription plan
      const subscription = await db.queryRow<{ plan: string; status: string }>`
        SELECT s.plan, s.status
        FROM billing_subscriptions s
        JOIN billing_customers c ON s.customer_id = c.id
        WHERE c.user_id = ${req.userId}
        AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const userPlan = subscription?.plan || 'free';
      const planFeatures = PLAN_FEATURES[userPlan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.free;

      const hasFeature = planFeatures.includes(req.feature as any);

      return {
        allowed: hasFeature,
        plan: userPlan,
        reason: hasFeature 
          ? undefined 
          : `feature '${req.feature}' not available on '${userPlan}' plan`
      };

    } catch (error) {
      throw APIError.internal("failed to check entitlements");
    }
  }
);