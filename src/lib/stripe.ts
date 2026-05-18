import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
  typescript: true,
});

export const PLANS = {
  starter: {
    name: "Starter",
    priceId: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
    price: 14900, // cents
    features: {
      maxProjects: 3,
      maxTeamMembers: 5,
      storageGb: 10,
      aiNarrativesPerMonth: 25,
      programs: ["leed", "well"],
    },
  },
  professional: {
    name: "Professional",
    priceId: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY!,
    price: 39900,
    features: {
      maxProjects: null,
      maxTeamMembers: 25,
      storageGb: 100,
      aiNarrativesPerMonth: null,
      programs: ["leed", "well", "wellhs"],
    },
  },
  enterprise: {
    name: "Enterprise",
    priceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    price: null,
    features: {
      maxProjects: null,
      maxTeamMembers: null,
      storageGb: null,
      aiNarrativesPerMonth: null,
      programs: ["leed", "well", "wellhs"],
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export async function createCheckoutSession({
  priceId,
  customerId,
  successUrl,
  cancelUrl,
  metadata,
}: {
  priceId: string;
  customerId?: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    subscription_data: { metadata: metadata ?? {} },
    allow_promotion_codes: true,
  });
}

export async function createBillingPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}
