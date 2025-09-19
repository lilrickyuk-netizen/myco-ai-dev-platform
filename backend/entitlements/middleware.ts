import { APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { PLAN_FEATURES } from "./types";

const enableBilling = secret("EnableBilling");

// Middleware function to check if user has access to a feature
export async function requireFeature(feature: string): Promise<void> {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("user not authenticated");
  }

  try {
    const billingEnabled = enableBilling() === 'true';
    
    if (!billingEnabled) {
      // If billing is disabled, allow all features
      return;
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

    const hasFeature = planFeatures.includes(feature as any);

    if (!hasFeature) {
      throw APIError.permissionDenied(
        `feature '${feature}' not available on '${userPlan}' plan`
      );
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw APIError.internal("failed to check feature access");
  }
}

// Helper function to check multiple features at once
export async function requireAnyFeature(features: string[]): Promise<void> {
  const auth = getAuthData();
  if (!auth?.userID) {
    throw APIError.unauthenticated("user not authenticated");
  }

  const billingEnabled = enableBilling() === 'true';
  
  if (!billingEnabled) {
    // If billing is disabled, allow all features
    return;
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

  const hasAnyFeature = features.some(feature => planFeatures.includes(feature as any));
  
  if (!hasAnyFeature) {
    throw APIError.permissionDenied(
      `none of the required features [${features.join(', ')}] are available on '${userPlan}' plan`
    );
  }
}

// Helper to get user plan without throwing errors
export async function getUserPlan(): Promise<string> {
  const auth = getAuthData();
  if (!auth?.userID) {
    return 'free';
  }

  try {
    const billingEnabled = enableBilling() === 'true';
    
    if (!billingEnabled) {
      return 'unlimited';
    }

    const subscription = await db.queryRow<{ plan: string; status: string }>`
      SELECT s.plan, s.status
      FROM billing_subscriptions s
      JOIN billing_customers c ON s.customer_id = c.id
      WHERE c.user_id = ${auth.userID}
      AND s.status = 'active'
      ORDER BY s.created_at DESC
      LIMIT 1
    `;

    return subscription?.plan || 'free';
  } catch {
    return 'free';
  }
}