export const SERVICE_CATEGORIES = [
  "Hair",
  "Nails",
  "Skin",
  "Massage",
  "Makeup",
  "Barber",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
] as const;

export type TimeSlot = (typeof TIME_SLOTS)[number];

export const APPOINTMENT_STATUSES = ["pending", "confirmed", "cancelled"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid"] as const;
export const SERVICE_STATUSES = ["active", "inactive"] as const;
export const TRANSACTION_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
] as const;

export const ROLES = ["customer", "admin"] as const;
