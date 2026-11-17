import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { unprocessable } from "../utils/app-error.js";

function formatIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));
}

export const validateBody =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(unprocessable("Please check the submitted information", formatIssues(result.error.issues)));
      return;
    }
    req.validatedBody = result.data;
    next();
  };

export const validateQuery =
  (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(unprocessable("Invalid query parameters", formatIssues(result.error.issues)));
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
