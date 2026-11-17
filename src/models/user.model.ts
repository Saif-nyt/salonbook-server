import { Schema, model, type Types } from "mongoose";
import { ROLES, type ServiceCategory } from "../config/constants.js";

export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  phone?: string | null;
  role: (typeof ROLES)[number];
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    phone: { type: String, default: null, trim: true },
    role: {
      type: String,
      enum: ROLES,
      default: "customer",
      required: true,
    },
    isBlocked: { type: Boolean, default: false, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: "user",
    strict: false,
    versionKey: false,
  },
);

export const User = model<UserDocument>("User", userSchema);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  phone: string | null;
  role: (typeof ROLES)[number];
  isBlocked: boolean;
  createdAt: Date;
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    phone: user.phone ?? null,
    role: user.role,
    isBlocked: user.isBlocked,
    createdAt: user.createdAt,
  };
}

export type Category = ServiceCategory;
