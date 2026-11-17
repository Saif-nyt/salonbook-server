import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { getValidatedQuery, routeParam } from "../utils/request.js";
import { AppError, badRequest } from "../utils/app-error.js";
import { env } from "../config/env.js";
import { getStripe } from "../lib/stripe.js";
import { createCheckoutSession, processStripeEvent } from "../services/payment.service.js";
import { getPaymentStatus } from "../services/transaction.service.js";

export const postCheckout = asyncHandler(async (req: Request, res: Response) => {
  const session = await createCheckoutSession(req.user!, routeParam(req, "id"));
  return sendSuccess(res, session, { message: "Checkout session created" });
});

export const postWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    throw badRequest("Missing Stripe signature");
  }
  if (!Buffer.isBuffer(req.body)) {
    throw badRequest("Stripe webhook body must be raw");
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError(400, "Invalid Stripe webhook signature", "INVALID_SIGNATURE");
  }

  const result = await processStripeEvent(event);
  return sendSuccess(res, { received: true, duplicate: result.duplicate });
});

export const getSessionStatus = asyncHandler(async (req: Request, res: Response) => {
  const { session_id: sessionId } = getValidatedQuery<{ session_id: string }>(req);
  const status = await getPaymentStatus(req.user!._id.toString(), sessionId);
  return sendSuccess(res, status);
});
