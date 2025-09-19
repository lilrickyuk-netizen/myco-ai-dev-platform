-- Billing tables for subscription management

CREATE TABLE billing_customers (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE billing_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES billing_customers(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free', -- free, pro, enterprise
  status TEXT NOT NULL DEFAULT 'active', -- active, canceled, past_due, incomplete
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE billing_events (
  id BIGSERIAL PRIMARY KEY,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  customer_id BIGINT REFERENCES billing_customers(id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES billing_subscriptions(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_billing_customers_user_id ON billing_customers(user_id);
CREATE INDEX idx_billing_customers_stripe_id ON billing_customers(stripe_customer_id);
CREATE INDEX idx_billing_subscriptions_customer_id ON billing_subscriptions(customer_id);
CREATE INDEX idx_billing_subscriptions_stripe_id ON billing_subscriptions(stripe_subscription_id);
CREATE INDEX idx_billing_events_stripe_id ON billing_events(stripe_event_id);
CREATE INDEX idx_billing_events_processed ON billing_events(processed);