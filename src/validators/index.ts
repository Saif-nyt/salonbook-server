import { z } from "zod";
import {
  APPOINTMENT_STATUSES,
  PAYMENT_STATUSES,
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  TIME_SLOTS,
  TRANSACTION_STATUSES,
} from "../config/constants.js";
import { isDateInPast, isWithinBookingWindow, parseDateOnly } from "../utils/date.js";

const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid identifier");

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date")
  .refine((value) => {
    const date = parseDateOnly(value);
    return !isDateInPast(date) && isWithinBookingWindow(date);
  }, "Choose a date within the next 120 days");

const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const serviceCreateSchema = z.object({
  serviceName: z.string().trim().min(2, "Service name is too short").max(120),
  category: z.enum(SERVICE_CATEGORIES),
  description: z
    .string()
    .trim()
    .min(20, "Describe the service in at least 20 characters")
    .max(1500),
  price: z.coerce.number().positive("Price must be greater than zero").max(100_000),
  duration: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(15, "Duration must be at least 15 minutes")
    .max(600),
  image: z.string().trim().url("Upload an image or provide a valid image URL"),
  status: z.enum(SERVICE_STATUSES).default("active"),
});

export const serviceUpdateSchema = serviceCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "No changes were provided");

export const serviceStatusSchema = z.object({
  status: z.enum(SERVICE_STATUSES),
});

export const serviceQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.enum(SERVICE_CATEGORIES).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name-asc"]).default("newest"),
  status: z.enum(SERVICE_STATUSES).optional(),
  page: pagination.page,
  limit: pagination.limit,
});

export const appointmentCreateSchema = z.object({
  serviceId: objectId,
  appointmentDate: dateOnly,
  timeSlot: z.enum(TIME_SLOTS),
  message: z.string().trim().max(500, "Message is too long").optional().default(""),
});

export const availabilityQuerySchema = z.object({
  date: dateOnly,
});

export const appointmentQuerySchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  search: z.string().trim().max(120).optional(),
  page: pagination.page,
  limit: pagination.limit,
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short").max(80).optional(),
    phone: z
      .string()
      .trim()
      .max(30)
      .regex(/^[+()\d\s-]*$/, "Enter a valid phone number")
      .optional()
      .nullable(),
    image: z
      .string()
      .trim()
      .url("Enter a valid image URL")
      .max(2048)
      .optional()
      .nullable(),
  })
  .refine((value) => Object.keys(value).length > 0, "No changes were provided");

export const userQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: pagination.page,
  limit: pagination.limit,
});

export const transactionQuerySchema = z.object({
  status: z.enum(TRANSACTION_STATUSES).optional(),
  page: pagination.page,
  limit: pagination.limit,
});

export const adminSetupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[a-z]/, "Password must include a lowercase letter"),
});

export type ServiceCreateInput = z.infer<typeof serviceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof serviceUpdateSchema>;
export type ServiceQuery = z.infer<typeof serviceQuerySchema>;
export type AppointmentCreateInput = z.infer<typeof appointmentCreateSchema>;
export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>;
