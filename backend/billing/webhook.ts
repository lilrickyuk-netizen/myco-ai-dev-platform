import { api, APIError } from "encore.dev/api";
import { Header } from "encore.dev/api";
import { secret } from "encore.dev/config";
import log from "encore.dev/log";
import db from "../db";
import { WebhookRequest, WebhookResponse } from "./types";

// Stripe webhook secret - set this in the Infrastructure tab
const stripeWebhookSecret = secret("StripeWebhookSecret");

interface WebhookRequestWithHeaders extends WebhookRequest {
  stripeSignature: Header<"stripe-signature">;
}

// Handles Stripe webhook events for billing updates
export const webhook = api<WebhookRequestWithHeaders, WebhookResponse>(
  { expose: true, method: "POST", path: "/billing/webhook" },
  async (req) => {
    // Verify webhook signature (placeholder implementation)
    if (!req.stripeSignature) {
      throw APIError.invalidArgument("missing stripe signature");
    }

    const webhookSecret = stripeWebhookSecret();
    if (!webhookSecret || webhookSecret === "INSERT_STRIPE_WEBHOOK_SECRET") {
      log.warn("Stripe webhook secret not configured - please set StripeWebhookSecret secret in Infrastructure tab");
    }

    try {
      // In a real implementation, you would:
      // 1. Verify the webhook signature using Stripe SDK
      // 2. Parse the event data
      // 3. Handle different event types
      
      // Log the event for debugging
      await db.exec`
        INSERT INTO billing_events (stripe_event_id, event_type, data, processed)
        VALUES (${req.id}, ${req.type}, ${JSON.stringify(req.data)}, false)
        ON CONFLICT (stripe_event_id) DO NOTHING
      `;

      log.info("Received Stripe webhook", { 
        eventId: req.id, 
        eventType: req.type 
      });

      // Handle different webhook events
      await handleWebhookEvent(req);

      // Mark event as processed
      await db.exec`
        UPDATE billing_events 
        SET processed = true 
        WHERE stripe_event_id = ${req.id}
      `;

      return { received: true };

    } catch (error) {
      log.error("Failed to process webhook", { error, eventId: req.id });
      throw APIError.internal("webhook processing failed");
    }
  }
);

async function handleWebhookEvent(event: WebhookRequest) {
  switch (event.type) {
    case 'customer.created':
      log.info("Customer created", { customerId: event.data.object.id });
      // Handle customer creation
      break;

    case 'invoice.created':
      log.info("Invoice created", { invoiceId: event.data.object.id });
      // Handle invoice creation
      break;

    case 'payment_intent.succeeded':
      log.info("Payment succeeded", { paymentIntentId: event.data.object.id });
      // Handle successful payment
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      log.info("Subscription updated", { 
        subscriptionId: event.data.object.id,
        status: event.data.object.status 
      });
      // Handle subscription updates
      await handleSubscriptionUpdate(event.data.object);
      break;

    case 'customer.subscription.deleted':
      log.info("Subscription deleted", { subscriptionId: event.data.object.id });
      // Handle subscription cancellation
      await handleSubscriptionCancellation(event.data.object);
      break;

    default:
      log.info("Unhandled webhook event", { eventType: event.type });
  }
}

async function handleSubscriptionUpdate(subscription: any) {
  // In a real implementation, you would:
  // 1. Find the customer by Stripe customer ID
  // 2. Update or create the subscription record
  // 3. Update the user's entitlements
  
  const stripeCustomerId = subscription.customer;
  const stripeSubscriptionId = subscription.id;
  const status = subscription.status;
  const currentPeriodStart = new Date(subscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

  log.info("Processing subscription update", {
    stripeCustomerId,
    stripeSubscriptionId,
    status
  });

  // Placeholder - implement actual subscription update logic
}

async function handleSubscriptionCancellation(subscription: any) {
  const stripeSubscriptionId = subscription.id;
  
  log.info("Processing subscription cancellation", {
    stripeSubscriptionId
  });

  // Placeholder - implement actual subscription cancellation logic
}