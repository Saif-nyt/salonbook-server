import { Schema, model, type Types } from "mongoose";
import {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  type ServiceCategory,
} from "../config/constants.js";

export interface ServiceDocument {
  _id: Types.ObjectId;
  serviceName: string;
  category: ServiceCategory;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: (typeof SERVICE_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new Schema<ServiceDocument>(
  {
    serviceName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: SERVICE_CATEGORIES,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 1500,
    },
    price: {
      type: Number,
      required: true,
      min: 0.01,
      max: 100_000,
    },
    duration: {
      type: Number,
      required: true,
      min: 15,
      max: 600,
    },
    image: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: SERVICE_STATUSES,
      default: "active",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

serviceSchema.index({ status: 1, category: 1, price: 1 });
serviceSchema.index({ serviceName: 1 });

export const Service = model<ServiceDocument>("Service", serviceSchema);
