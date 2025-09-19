import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import log from "encore.dev/log";
import { CreateCheckoutRequest, CreateCheckoutResponse } from "./types";

// Stripe configuration - set these in the Infrastructure tab
const stripeSecretKey = secret("StripeSecretKey");
const stripePriceId = secret("StripePriceId");

// Creates a Stripe checkout session for subscription billing
export const createCheckout = api<CreateCheckoutRequest, CreateCheckoutResponse>(
  { expose: true, method: "POST", path: "/billing/create-checkout", auth: true },
  async (req) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      throw APIError.unauthenticated("user not authenticated");
    }

    // Use default price ID if not provided
    const priceId = req.priceId || stripePriceId();
    
    // Validate price ID
    if (!priceId || priceId === "INSERT_PRICE_ID") {
      throw APIError.invalidArgument("price ID not configured - please set StripePriceId secret in Infrastructure tab");
    }

    // Check if Stripe is properly configured
    const secretKey = stripeSecretKey();
    if (!secretKey || secretKey === "INSERT_STRIPE_SECRET_KEY") {
      throw APIError.internal("Stripe not configured - please set StripeSecretKey secret in Infrastructure tab");
    }

    try {
      // In a real implementation, you would:
      // 1. Initialize Stripe with the secret key
      // 2. Create or retrieve the customer
      // 3. Create a checkout session
      // 4. Return the checkout URL
      
      log.info("Creating checkout session for user", { 
        userId: auth.userID, 
        priceId: priceId 
      });

      // Placeholder response - replace with actual Stripe integration
      const mockSessionId = `cs_mock_${Date.now()}`;
      const mockCheckoutUrl = `https://checkout.stripe.com/pay/${mockSessionId}`;

      return {
        checkoutUrl: mockCheckoutUrl,
        sessionId: mockSessionId
      };

    } catch (error) {
      log.error("Failed to create checkout session", { error, userId: auth.userID });
      throw APIError.internal("failed to create checkout session");
    }
  }
);