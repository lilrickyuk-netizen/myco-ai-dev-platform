export interface Customer {
  id: number;
  userId: string;
  stripeCustomerId?: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: number;
  customerId: number;
  stripeSubscriptionId?: string;
  plan: string;
  status: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCheckoutRequest {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResponse {
  checkoutUrl: string;
  sessionId: string;
}

export interface WebhookRequest {
  // This will be populated by Stripe webhook data
  type: string;
  data: {
    object: any;
  };
  id: string;
}

export interface WebhookResponse {
  received: boolean;
}

export interface GetSubscriptionResponse {
  subscription: Subscription | null;
  customer: Customer | null;
}

export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise'
} as const;

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  CANCELED: 'canceled',
  PAST_DUE: 'past_due',
  INCOMPLETE: 'incomplete'
} as const;