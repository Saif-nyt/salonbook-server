import { Schema, model } from "mongoose";

export interface WebhookEventDocument {
  eventId: string;
  type: string;
  processedAt: Date;
}

const webhookEventSchema = new Schema<WebhookEventDocument>(
  {
    eventId: { type: String, required: true, unique: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now, required: true },
  },
  {
    collection: "webhook_events",
    versionKey: false,
  },
);

webhookEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30, name: "webhook_event_ttl" },
);

export const WebhookEvent = model<WebhookEventDocument>(
  "WebhookEvent",
  webhookEventSchema,
);
