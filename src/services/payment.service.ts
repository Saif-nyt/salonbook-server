import type Stripe from "stripe";
import { env } from "../config/env.js";
import { getStripe } from "../lib/stripe.js";
import { Appointment } from "../models/appointment.model.js";
import { Transaction } from "../models/transaction.model.js";
import { WebhookEvent } from "../models/webhook-event.model.js";
import type { UserDocument } from "../models/user.model.js";
import { conflict, notFound } from "../utils/app-error.js";
import { isDuplicateKeyError, toObjectId } from "../utils/mongo.js";

export async function createCheckoutSession(
  user: UserDocument,
  appointmentId: string,
) {
  const appointment = await Appointment.findOne({
    _id: toObjectId(appointmentId, "appointment id"),
    customerId: user._id.toString(),
  }).lean();

  if (!appointment) throw notFound("Appointment not found");

  if (appointment.paymentStatus === "paid") {
    throw conflict("This appointment has already been paid", "ALREADY_PAID");
  }
  if (appointment.status === "pending") {
    throw conflict(
      "This appointment must be confirmed by the salon before payment",
      "PAYMENT_NOT_ALLOWED",
    );
  }
  if (appointment.status === "cancelled") {
    throw conflict(
      "Cancelled appointments cannot be paid",
      "PAYMENT_NOT_ALLOWED",
    );
  }

  const stripe = getStripe();

  const existing = await Transaction.findOne({ appointmentId: appointment._id }).lean();
  if (existing?.status === "pending" && existing.stripeSessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(existing.stripeSessionId);
      if (session.status === "open" && session.url) {
        return { url: session.url, sessionId: session.id };
      }
    } catch {
      // The previous session is no longer retrievable; create a fresh one.
    }
  }

  const amountInCents = Math.round(appointment.servicePrice * 100);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    client_reference_id: appointment._id.toString(),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: env.STRIPE_CURRENCY.toLowerCase(),
          unit_amount: amountInCents,
          product_data: {
            name: appointment.serviceName,
            description: `${appointment.serviceDuration} minute appointment`,
          },
        },
      },
    ],
    metadata: {
      appointmentId: appointment._id.toString(),
      customerId: appointment.customerId,
    },
    payment_intent_data: {
      metadata: {
        appointmentId: appointment._id.toString(),
        customerId: appointment.customerId,
      },
    },
    success_url: `${env.CLIENT_URL}/dashboard/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/dashboard/payment/cancel?appointment_id=${appointment._id.toString()}`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  await Transaction.findOneAndUpdate(
    { appointmentId: appointment._id },
    {
      $set: {
        customerId: appointment.customerId,
        amount: appointment.servicePrice,
        currency: env.STRIPE_CURRENCY.toLowerCase(),
        stripeSessionId: session.id,
        status: "pending",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return { url: session.url, sessionId: session.id };
}

export interface WebhookResult {
  duplicate: boolean;
  handled: boolean;
}

export async function processStripeEvent(event: Stripe.Event): Promise<WebhookResult> {
  try {
    await WebhookEvent.create({ eventId: event.id, type: event.type });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return { duplicate: true, handled: false };
    }
    throw error;
  }

  try {
    const handled = await dispatchEvent(event);
    return { duplicate: false, handled };
  } catch (error) {
    await WebhookEvent.deleteOne({ eventId: event.id });
    throw error;
  }
}

async function dispatchEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      return completeCheckout(session);
    }
    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await failCheckout(session, "failed");
      return true;
    }
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await failCheckout(session, "cancelled");
      return true;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object as Stripe.PaymentIntent;
      const appointmentId = intent.metadata?.appointmentId;
      if (!appointmentId) return false;
      await Transaction.updateOne(
        { appointmentId, status: "pending" },
        { $set: { status: "failed" } },
      );
      return true;
    }
    default:
      return false;
  }
}

async function completeCheckout(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return false;
  }

  const appointmentId = session.metadata?.appointmentId ?? session.client_reference_id;
  if (!appointmentId) {
    console.warn(`[stripe] Session ${session.id} is missing an appointment reference`);
    return false;
  }

  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) {
    console.warn(`[stripe] Appointment ${appointmentId} from session ${session.id} was not found`);
    return false;
  }

  if (appointment.status === "cancelled") {
    console.warn(
      `[stripe] Appointment ${appointmentId} is cancelled; skipping paid status update for session ${session.id}`,
    );
    return false;
  }

  const amount =
    session.amount_total !== null
      ? session.amount_total / 100
      : appointment.servicePrice;
  const currency = (session.currency ?? env.STRIPE_CURRENCY).toLowerCase();

  await Appointment.updateOne(
    { _id: appointment._id },
    { $set: { paymentStatus: "paid" } },
  );

  await Transaction.findOneAndUpdate(
    { appointmentId: appointment._id },
    {
      $set: {
        customerId: appointment.customerId,
        amount,
        currency,
        stripeSessionId: session.id,
        status: "paid",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return true;
}

async function failCheckout(
  session: Stripe.Checkout.Session,
  status: "failed" | "cancelled",
): Promise<void> {
  const appointmentId = session.metadata?.appointmentId ?? session.client_reference_id;
  if (!appointmentId) return;

  await Transaction.updateOne(
    { appointmentId, status: "pending" },
    { $set: { status, stripeSessionId: session.id } },
  );
}
