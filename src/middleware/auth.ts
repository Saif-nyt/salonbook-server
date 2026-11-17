import type { NextFunction, Request, RequestHandler, Response } from "express";
import { User } from "../models/user.model.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { forbidden, unauthorized } from "../utils/app-error.js";

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function resolveUser(token: string) {
  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    throw unauthorized("Your session is invalid or has expired. Please sign in again.");
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw unauthorized("Your account could not be found. Please sign in again.");
  }

  if (user.isBlocked) {
    throw forbidden("Your account has been blocked. Please contact the salon.");
  }

  return user;
}

export const authenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = readBearerToken(req);
    if (!token) {
      throw unauthorized();
    }
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token = readBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.user = await resolveUser(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role !== "admin") {
    next(forbidden("Administrator access is required"));
    return;
  }
  next();
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(unauthorized());
    return;
  }
  if (req.user.role !== "customer") {
    next(forbidden("Only customer accounts can perform this action"));
    return;
  }
  next();
}
