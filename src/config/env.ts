import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  SERVER_URL: z.string().url(),
  CLIENT_URL: z.string().url(),
  BETTER_AUTH_URL: z.string().url(),
  BETTER_AUTH_BASE_URL: z.string().url().optional(),
  AUTH_JWKS_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional().default(""),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),

  STRIPE_SECRET_KEY: z.string().optional().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(""),
  STRIPE_CURRENCY: z.string().min(3).max(3).default("usd"),

  IMGBB_API_KEY: z.string().optional().default(""),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().optional().default("SalonBook Admin"),
  ADMIN_SETUP_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const data = parsed.data;

export const env = {
  ...data,
  isProduction: data.NODE_ENV === "production",
  isTest: data.NODE_ENV === "test",
  allowedOrigins: Array.from(
    new Set(
      [data.CLIENT_URL, data.BETTER_AUTH_URL, ...data.ALLOWED_ORIGINS.split(",")]
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ),
  jwksUrl: data.AUTH_JWKS_URL ?? `${data.SERVER_URL}/api/auth/jwks`,
  googleEnabled: Boolean(data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET),
  stripeEnabled: Boolean(data.STRIPE_SECRET_KEY && data.STRIPE_WEBHOOK_SECRET),
};
