import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { bearer, jwt } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";
import { client } from "../config/database.js";

const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 6, message: "Password must be at least 6 characters long" },
  { test: (value: string) => /[A-Z]/.test(value), message: "Password must include an uppercase letter" },
  { test: (value: string) => /[a-z]/.test(value), message: "Password must include a lowercase letter" },
];

export const auth = betterAuth({
  appName: "SalonBook",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: mongodbAdapter(client.db()),
  trustedOrigins: env.allowedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
  },
  socialProviders: env.googleEnabled
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false,
      },
      isBlocked: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  advanced: {
    database: {
      joins: true,
    },
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
    },
  },
  plugins: [
    jwt({
      jwt: {
        issuer: env.BETTER_AUTH_URL,
        audience: env.BETTER_AUTH_URL,
        expirationTime: "1h",
        definePayload: ({ user }) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }),
      },
    }),
    bearer(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;

      const password = (ctx.body as { password?: unknown } | undefined)?.password;
      if (typeof password !== "string") return;

      const failedRule = PASSWORD_RULES.find((rule) => !rule.test(password));
      if (failedRule) {
        throw new APIError("BAD_REQUEST", { message: failedRule.message });
      }
    }),
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            role: "customer",
            isBlocked: false,
          },
        }),
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await User.findById(session.userId).lean();
          if (user?.isBlocked) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been blocked. Please contact the salon.",
            });
          }
        },
      },
    },
  },
});

export async function closeAuthDatabase(): Promise<void> {
  // The shared client is closed by disconnectFromMongoDB(); nothing to do here.
}
