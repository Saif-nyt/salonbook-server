import { createServer } from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { z } from "zod";
import { toNodeHandler } from "better-auth/node";
import { connectToMongoDB, ensureCollections, disconnectFromMongoDB } from "./config/database.js";
import { env } from "./config/env.js";
import { auth, closeAuthDatabase } from "./lib/auth.js";
import {
  getAllAppointments,
  getAppointmentById,
  getAvailability,
  getMyAppointments,
  patchCancelAppointment,
  patchConfirmAppointment,
  postAppointment,
} from "./controllers/appointment.controller.js";
import { postAdminSetup } from "./controllers/admin.controller.js";
import {
  getAdminDashboard,
  getMyDashboard,
} from "./controllers/dashboard.controller.js";
import {
  getSessionStatus,
  postCheckout,
  postWebhook,
} from "./controllers/payment.controller.js";
import {
  getCategories,
  getService,
  getServices,
  patchService,
  patchServiceStatus,
  postService,
  removeService,
} from "./controllers/service.controller.js";
import {
  getAllTransactions,
  getMyTransactions,
} from "./controllers/transaction.controller.js";
import { postUpload } from "./controllers/upload.controller.js";
import {
  getCustomer,
  getCustomers,
  getMe,
  patchBlockUser,
  patchProfile,
  patchUnblockUser,
} from "./controllers/user.controller.js";
import {
  authenticate,
  optionalAuthenticate,
  requireAdmin,
  requireCustomer,
} from "./middleware/auth.js";
import { errorHandler, notFoundHandler, requestLogger } from "./middleware/error.js";
import { singleImageUpload } from "./middleware/upload.js";
import { validateBody, validateQuery } from "./middleware/validate.js";
import { AppError } from "./utils/app-error.js";
import { sendSuccess } from "./utils/api-response.js";
import { Appointment } from "./models/appointment.model.js";
import { Service } from "./models/service.model.js";
import { Transaction } from "./models/transaction.model.js";
import { WebhookEvent } from "./models/webhook-event.model.js";
import {
  adminSetupSchema,
  appointmentCreateSchema,
  appointmentQuerySchema,
  availabilityQuerySchema,
  profileUpdateSchema,
  serviceCreateSchema,
  serviceQuerySchema,
  serviceStatusSchema,
  serviceUpdateSchema,
  transactionQuerySchema,
  userQuerySchema,
} from "./validators/index.js";

const paymentStatusQuerySchema = z.object({
  session_id: z.string().min(1, "A payment session is required"),
});

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, "Origin is not allowed", "CORS_REJECTED"));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Setup-Secret"],
      maxAge: 86_400,
    }),
  );

  app.use(requestLogger);

  // Stripe needs the raw body, so this route must stay above express.json().
  app.post(
    "/api/payments/webhook",
    express.raw({ type: "application/json", limit: "1mb" }),
    postWebhook,
  );

  app.all("/api/auth/*splat", toNodeHandler(auth));

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/", (_req, res) =>
    sendSuccess(res, {
      name: "SalonBook API",
      version: "1.0.0",
      health: "/health",
    }),
  );

  app.get("/health", (_req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1;
    res.status(databaseConnected ? 200 : 503).json({
      success: databaseConnected,
      data: {
        status: databaseConnected ? "ok" : "degraded",
        database: databaseConnected ? "connected" : "disconnected",
        payments: env.stripeEnabled ? "configured" : "disabled",
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Services
  app.get(
    "/api/services",
    optionalAuthenticate,
    validateQuery(serviceQuerySchema),
    getServices,
  );
  app.get("/api/services/categories", getCategories);
  app.get("/api/services/:id", getService);
  app.post(
    "/api/services",
    authenticate,
    requireAdmin,
    validateBody(serviceCreateSchema),
    postService,
  );
  app.patch(
    "/api/services/:id",
    authenticate,
    requireAdmin,
    validateBody(serviceUpdateSchema),
    patchService,
  );
  app.patch(
    "/api/services/:id/status",
    authenticate,
    requireAdmin,
    validateBody(serviceStatusSchema),
    patchServiceStatus,
  );
  app.delete("/api/services/:id", authenticate, requireAdmin, removeService);

  // Appointments
  app.get(
    "/api/appointments/availability",
    validateQuery(availabilityQuerySchema),
    getAvailability,
  );
  app.get(
    "/api/appointments/mine",
    authenticate,
    requireCustomer,
    validateQuery(appointmentQuerySchema),
    getMyAppointments,
  );
  app.get(
    "/api/appointments",
    authenticate,
    requireAdmin,
    validateQuery(appointmentQuerySchema),
    getAllAppointments,
  );
  app.post(
    "/api/appointments",
    authenticate,
    requireCustomer,
    validateBody(appointmentCreateSchema),
    postAppointment,
  );
  app.get("/api/appointments/:id", authenticate, getAppointmentById);
  app.patch("/api/appointments/:id/cancel", authenticate, patchCancelAppointment);
  app.patch(
    "/api/appointments/:id/confirm",
    authenticate,
    requireAdmin,
    patchConfirmAppointment,
  );

  // Dashboards
  app.get("/api/dashboard/customer", authenticate, requireCustomer, getMyDashboard);
  app.get("/api/dashboard/admin", authenticate, requireAdmin, getAdminDashboard);

  // Users
  app.get("/api/users/me", authenticate, getMe);
  app.patch("/api/users/me", authenticate, validateBody(profileUpdateSchema), patchProfile);
  app.get(
    "/api/users",
    authenticate,
    requireAdmin,
    validateQuery(userQuerySchema),
    getCustomers,
  );
  app.get("/api/users/:id", authenticate, requireAdmin, getCustomer);
  app.patch("/api/users/:id/block", authenticate, requireAdmin, patchBlockUser);
  app.patch("/api/users/:id/unblock", authenticate, requireAdmin, patchUnblockUser);

  // Transactions
  app.get(
    "/api/transactions/mine",
    authenticate,
    requireCustomer,
    validateQuery(transactionQuerySchema),
    getMyTransactions,
  );
  app.get(
    "/api/transactions",
    authenticate,
    requireAdmin,
    validateQuery(transactionQuerySchema),
    getAllTransactions,
  );

  // Payments
  app.post("/api/payments/checkout/:id", authenticate, requireCustomer, postCheckout);
  app.get(
    "/api/payments/status",
    authenticate,
    requireCustomer,
    validateQuery(paymentStatusQuerySchema),
    getSessionStatus,
  );

  // Uploads
  app.post("/api/uploads", authenticate, singleImageUpload, postUpload);

  // Admin bootstrap
  app.post("/api/admin/setup", validateBody(adminSetupSchema), postAdminSetup);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function start() {
  await connectToMongoDB();          // ← user's requested code path
  await ensureCollections();         // create DB, collections, indexes

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
        await disconnectFromMongoDB();
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