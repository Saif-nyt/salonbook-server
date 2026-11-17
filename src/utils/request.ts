import type { Request } from "express";
import { badRequest } from "./app-error.js";

export function getValidatedBody<T>(req: Request): T {
  return req.validatedBody as T;
}

export function getValidatedQuery<T>(req: Request): T {
  return req.validatedQuery as T;
}

export function getPagination(query: { page: number; limit: number }) {
  return {
    page: query.page,
    limit: query.limit,
    skip: (query.page - 1) * query.limit,
  };
}

export function buildMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest(`Missing ${name}`);
  }
  return value;
}
