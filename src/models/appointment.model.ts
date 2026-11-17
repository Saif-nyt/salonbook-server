import { Schema, model, type Types } from "mongoose";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  TIME_SLOTS,
  type ServiceCategory,
} from "../config/constants.js";

export interface AppointmentDocument {
  _id: Types.ObjectId;
  serviceId: Types.ObjectId;
  customerId: string;
  appointmentDate: Date;
  timeSlot: (typeof TIME_SLOTS)[number];
  message?: string;
  servicePrice: number;
  paymentStatus: (typeof PAYMENT_STATUSES)[number];
  status: (typeof APPOINTMENT_STATUSES)[number];
  active: boolean;
  serviceName: string;
  serviceImage: string;
  serviceCategory: ServiceCategory;
  serviceDuration: number;
  createdAt: Date;
  updatedAt: Date;
}

const appointmentSchema = new Schema<AppointmentDocument>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    customerId: {
      type: String,
      required: true,
      index: true,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      enum: TIME_SLOTS,
      required: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    servicePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "unpaid",
      required: true,
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
    serviceName: { type: String, required: true },
    serviceImage: { type: String, required: true },
    serviceCategory: { type: String, required: true },
    serviceDuration: { type: Number, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

appointmentSchema.index(
  { appointmentDate: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { active: true },
    name: "unique_active_slot",
  },
);
appointmentSchema.index({ customerId: 1, createdAt: -1 });
appointmentSchema.index({ status: 1, createdAt: -1 });

export const Appointment = model<AppointmentDocument>(
  "Appointment",
  appointmentSchema,
);
