import { createServer } from "node:http";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { closeAuthDatabase } from "./lib/auth.js";
import { Appointment } from "./models/appointment.model.js";
import { Service } from "./models/service.model.js";
import { Transaction } from "./models/transaction.model.js";
import { WebhookEvent } from "./models/webhook-event.model.js";

async function start() {
  await connectDatabase();
  await Promise.all([
    Service.init(),
    Appointment.init(),
    Transaction.init(),
    WebhookEvent.init(),
  ]);

  const app = createApp();
  const server = createServer(app);

  server.listen(env.PORT, () => {
    console.log(`SalonBook API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down`);

    server.close(() => {
      void (async () => {
        await disconnectDatabase();
        await closeAuthDatabase();
        process.exit(0);
      })();
    });

    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((error) => {
  console.error("Failed to start SalonBook API", error);
  process.exit(1);
});
