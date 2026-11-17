import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { getValidatedBody } from "../utils/request.js";
import { env } from "../config/env.js";
import { serviceUnavailable, unauthorized } from "../utils/app-error.js";
import { bootstrapAdmin } from "../services/admin.service.js";

function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export const postAdminSetup = asyncHandler(async (req: Request, res: Response) => {
  if (!env.ADMIN_SETUP_SECRET) {
    throw serviceUnavailable("Administrator setup is disabled");
  }

  const header = req.headers["x-admin-setup-secret"];
  if (typeof header !== "string" || !secretsMatch(header, env.ADMIN_SETUP_SECRET)) {
    throw unauthorized("Invalid administrator setup secret");
  }

  const body = getValidatedBody<{ name: string; email: string; password: string }>(req);
  const admin = await bootstrapAdmin(body);
  return sendSuccess(res, admin, { status: 201, message: "Administrator created" });
});
