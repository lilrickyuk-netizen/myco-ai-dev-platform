import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { UserEntitlements, PLAN_FEATURES } from "./types";

// Billing feature flag
const enableBilling = secret("EnableBilling");

// Gets all entitlements for the authenticated user
export const getUserEntitlements = api<void, UserEntitlements>(
  { expose: true, method: "GET", path: "/entitlements/user", auth: true },
  async () => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("user not authenticated");
    }

    try {
      // Check if billing is enabled
      const billingEnabled = enableBilling() === 'true';
      
      if (!billingEnabled) {
        // If billing is disabled, return all features
        const allFeatures = Object.values(PLAN_FEATURES).flat();
        const uniqueFeatures = [...new Set(allFeatures)];
        
        return {
          userId: auth.userID,
          plan: 'unlimited',
          features: uniqueFeatures
        };
      }

      // Get user's current subscription plan
      const subscription = await db.queryRow<{ plan: string; status: string }>`
        SELECT s.plan, s.status
        FROM billing_subscriptions s
        JOIN billing_customers c ON s.customer_id = c.id
        WHERE c.user_id = ${auth.userID}
        AND s.status = 'active'
        ORDER BY s.created_at DESC
        LIMIT 1
      `;

      const userPlan = subscription?.plan || 'free';
      const planFeatures = PLAN_FEATURES[userPlan as keyof typeof PLAN_FEATURES] || PLAN_FEATURES.free;

      return {
        userId: auth.userID,
        plan: userPlan,
        features: planFeatures as string[]
      };

    } catch (error) {
      throw APIError.internal("failed to get user entitlements");
    }
  }
);