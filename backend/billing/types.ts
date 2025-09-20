// Database row interfaces (snake_case)
export interface Customer {
  id: number;
  user_id: string;
  stripe_customer_id?: string;
  email: string;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: number;
  customer_id: number;
  stripe_subscription_id?: string;
  plan: string;
  status: string;
  current_period_start?: Date;
  current_period_end?: Date;
  cancel_at_period_end: boolean;
  created_at: Date;
  updated_at: Date;
}

// API response interfaces (camelCase)
export interface CustomerResponse {
  id: number;
  userId: string;
  stripeCustomerId?: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionResponse {
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
  subscription: SubscriptionResponse | null;
  customer: CustomerResponse | null;
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