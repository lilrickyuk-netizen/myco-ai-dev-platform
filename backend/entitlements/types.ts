export interface EntitlementsRequest {
  userId: string;
  feature: string;
}

export interface EntitlementsResponse {
  allowed: boolean;
  plan: string;
  reason?: string;
}

export interface UserEntitlements {
  userId: string;
  plan: string;
  features: string[];
}

export const FEATURES = {
  AI_GENERATION: 'ai_generation',
  PROJECT_COLLABORATION: 'project_collaboration',
  ADVANCED_TEMPLATES: 'advanced_templates',
  PRIORITY_SUPPORT: 'priority_support',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  UNLIMITED_PROJECTS: 'unlimited_projects'
} as const;

export const PLAN_FEATURES = {
  free: [
    FEATURES.AI_GENERATION
  ],
  pro: [
    FEATURES.AI_GENERATION,
    FEATURES.PROJECT_COLLABORATION,
    FEATURES.ADVANCED_TEMPLATES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.UNLIMITED_PROJECTS
  ],
  enterprise: [
    FEATURES.AI_GENERATION,
    FEATURES.PROJECT_COLLABORATION,
    FEATURES.ADVANCED_TEMPLATES,
    FEATURES.PRIORITY_SUPPORT,
    FEATURES.CUSTOM_INTEGRATIONS,
    FEATURES.UNLIMITED_PROJECTS
  ]
} as const;