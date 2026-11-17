import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";
import { isCastError, isDuplicateKeyError } from "../utils/mongo.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, res: Response) {
  return sendError(
    res,
    404,
    "NOT_FOUND",
    `Route ${req.method} ${req.originalUrl} does not exist`,
  );
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof AppError) {
    return sendError(res, error.statusCode, error.code, error.message, error.details);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Image must be 5 MB or smaller"
        : "The image upload could not be processed";
    return sendError(res, 400, "UPLOAD_ERROR", message);
  }

  if (isDuplicateKeyError(error)) {
    return sendError(
      res,
      409,
      "DUPLICATE_RESOURCE",
      "That record conflicts with an existing one",
    );
  }

  if (isCastError(error)) {
    return sendError(res, 400, "INVALID_ID", "The provided identifier is invalid");
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.parse.failed"
  ) {
    return sendError(res, 400, "INVALID_JSON", "The request body is not valid JSON");
  }

  console.error("[api] Unhandled error", error);
  return sendError(
    res,
    500,
    "INTERNAL_ERROR",
    env.isProduction
      ? "Something went wrong while processing your request"
      : error instanceof Error
        ? error.message
        : "Something went wrong while processing your request",
  );
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (env.isTest) {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log(
      `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
    );
  });
  next();
}
