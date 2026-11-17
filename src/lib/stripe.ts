import Stripe from "stripe";
import { env } from "../config/env.js";
import { serviceUnavailable } from "../utils/app-error.js";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw serviceUnavailable("Payments are not configured on this server");
  }

  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-10-28.endive",
      typescript: true,
    });
  }

  return client;
}

export function assertStripeWebhookConfigured(): void {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw serviceUnavailable("Stripe webhooks are not configured on this server");
  }
}
