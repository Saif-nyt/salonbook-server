import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../config/env.js";

const jwks = createRemoteJWKSet(new URL(env.jwksUrl), {
  cacheMaxAge: 10 * 60 * 1000,
  cooldownDuration: 30 * 1000,
});

export interface AccessTokenPayload {
  sub: string;
  email?: string;
  role?: string;
  name?: string;
  [claim: string]: unknown;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: env.BETTER_AUTH_URL,
    audience: env.BETTER_AUTH_URL,
  });

  if (!payload.sub) {
    throw new Error("Token is missing a subject");
  }

  return payload as AccessTokenPayload;
}
