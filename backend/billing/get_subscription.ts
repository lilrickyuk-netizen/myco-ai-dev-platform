import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { GetSubscriptionResponse, Customer, Subscription } from "./types";

// Gets the current subscription status for the authenticated user
export const getSubscription = api<void, GetSubscriptionResponse>(
  { expose: true, method: "GET", path: "/billing/subscription", auth: true },
  async () => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("user not authenticated");
    }

    try {
      // Get customer record
      const customerRow = await db.queryRow<Customer>`
        SELECT id, user_id, stripe_customer_id, email, created_at, updated_at
        FROM billing_customers
        WHERE user_id = ${auth.userID}
      `;

      if (!customerRow) {
        return {
          subscription: null,
          customer: null
        };
      }

      // Get current subscription
      const subscriptionRow = await db.queryRow<Subscription>`
        SELECT id, customer_id, stripe_subscription_id, plan, status, 
               current_period_start, current_period_end, cancel_at_period_end,
               created_at, updated_at
        FROM billing_subscriptions
        WHERE customer_id = ${customerRow.id}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      return {
        customer: {
          id: customerRow.id,
          userId: customerRow.user_id,
          stripeCustomerId: customerRow.stripe_customer_id || undefined,
          email: customerRow.email,
          createdAt: customerRow.created_at,
          updatedAt: customerRow.updated_at
        },
        subscription: subscriptionRow ? {
          id: subscriptionRow.id,
          customerId: subscriptionRow.customer_id,
          stripeSubscriptionId: subscriptionRow.stripe_subscription_id || undefined,
          plan: subscriptionRow.plan,
          status: subscriptionRow.status,
          currentPeriodStart: subscriptionRow.current_period_start || undefined,
          currentPeriodEnd: subscriptionRow.current_period_end || undefined,
          cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end,
          createdAt: subscriptionRow.created_at,
          updatedAt: subscriptionRow.updated_at
        } : null
      };

    } catch (error) {
      throw APIError.internal("failed to get subscription");
    }
  }
);