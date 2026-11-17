import mongoose from "mongoose";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env.js";

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", false);

const DATABASE_NAME = "salonbook";

/**
 * Atlas URIs such as `mongodb+srv://user:pass@host/` carry no database name, so the
 * driver would silently fall back to `test`. Pin the name so the native client, the
 * ODM and Better Auth all read and write the same database.
 */
function withDatabaseName(uri: string): string {
  const [base, query] = uri.split("?") as [string, string?];
  if (!base.endsWith("/")) return uri;
  return `${base}${DATABASE_NAME}${query ? `?${query}` : ""}`;
}

const uri = withDatabaseName(env.MONGODB_URI);

// `new MongoClient()` is lazy: nothing is dialled until `connect()` runs.
export const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 10_000,
});

export const db: Db = client.db();

export async function connectToMongoDB(): Promise<MongoClient> {
  if (mongoose.connection.readyState === 1) return client;

  await client.connect();
  console.log("You successfully connected to MongoDB!");

  // The models are still Mongoose-based, so keep the ODM on the same URI.
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 10,
    autoIndex: false,
  });

  return client;
}

/**
 * Creates the database, its collections and the indexes the app relies on.
 * MongoDB creates databases lazily, so touching these collections explicitly is what
 * makes `salonbook` show up in Atlas on a fresh cluster.
 */
export async function ensureCollections(): Promise<void> {
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const names = new Set(existing.map((collection) => collection.name));

  for (const name of [
    "user",
    "session",
    "account",
    "verification",
    "service",
    "appointment",
    "transaction",
    "webhook_events",
  ]) {
    if (!names.has(name)) {
      await db.createCollection(name);
    }
  }

  const service = db.collection("service");
  await service.createIndexes([
    { key: { status: 1, category: 1, price: 1 } },
    { key: { status: 1, createdAt: -1 } },
    { key: { serviceName: 1 } },
  ]);

  const appointment = db.collection("appointment");
  await appointment.createIndexes([
    {
      key: { appointmentDate: 1, timeSlot: 1 },
      name: "unique_active_slot",
      unique: true,
      partialFilterExpression: { active: true },
    },
    { key: { customerId: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
    { key: { serviceId: 1 } },
  ]);

  const transaction = db.collection("transaction");
  await transaction.createIndexes([
    { key: { appointmentId: 1 }, unique: true },
    { key: { stripeSessionId: 1 }, unique: true },
    { key: { customerId: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
  ]);

  const webhookEvent = db.collection("webhook_events");
  await webhookEvent.createIndexes([
    { key: { eventId: 1 }, unique: true },
    {
      key: { processedAt: 1 },
      name: "webhook_event_ttl",
      expireAfterSeconds: 60 * 60 * 24 * 30,
    },
  ]);

  await db
    .collection("user")
    .createIndexes([{ key: { email: 1 }, unique: true }, { key: { role: 1 } }]);
}

// Call this only when your application terminates
export async function disconnectFromMongoDB(): Promise<void> {
  await mongoose.disconnect();
  await client.close();
}
