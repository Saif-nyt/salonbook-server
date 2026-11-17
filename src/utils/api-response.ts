import type { Response } from "express";

type Meta = Record<string, unknown> | undefined;

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string; meta?: Meta } = {},
) {
  return res.status(options.status ?? 200).json({
    success: true,
    data,
    ...(options.message ? { message: options.message } : {}),
    ...(options.meta ? { meta: options.meta } : {}),
  });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  });
}
