const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid appointment date");
  }
  return date;
}

export function isDateInPast(date: Date): boolean {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() < today;
}

export function isWithinBookingWindow(date: Date, days = 120): boolean {
  const limit = Date.now() + days * 24 * 60 * 60 * 1000;
  return date.getTime() <= limit;
}

export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function assertDateOnly(value: string): string {
  if (!DATE_PATTERN.test(value)) {
    throw new Error("Date must use YYYY-MM-DD format");
  }
  return value;
}
