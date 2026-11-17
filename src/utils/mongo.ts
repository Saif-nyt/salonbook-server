import { Types } from "mongoose";
import { badRequest } from "./app-error.js";

export function toObjectId(value: string, label = "id"): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw badRequest(`Invalid ${label}`);
  }
  return new Types.ObjectId(value);
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

export function isCastError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "CastError"
  );
}
