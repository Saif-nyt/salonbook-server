import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import {
  buildMeta,
  getValidatedBody,
  getValidatedQuery,
  routeParam,
} from "../utils/request.js";
import type {
  AppointmentCreateInput,
  AppointmentQuery,
} from "../validators/index.js";
import {
  cancelAppointment,
  confirmAppointment,
  createAppointment,
  getAppointment,
  getSlotAvailability,
  listAllAppointments,
  listCustomerAppointments,
} from "../services/appointment.service.js";

export const postAppointment = asyncHandler(async (req: Request, res: Response) => {
  const input = getValidatedBody<AppointmentCreateInput>(req);
  const appointment = await createAppointment(req.user!, input);
  return sendSuccess(res, appointment, {
    status: 201,
    message: "Appointment request submitted",
  });
});

export const getMyAppointments = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<AppointmentQuery>(req);
  const { items, total } = await listCustomerAppointments(
    req.user!._id.toString(),
    query,
  );
  return sendSuccess(res, items, {
    meta: buildMeta(total, query.page, query.limit),
  });
});

export const getAllAppointments = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<AppointmentQuery>(req);
  const { items, total } = await listAllAppointments(query);
  return sendSuccess(res, items, {
    meta: buildMeta(total, query.page, query.limit),
  });
});

export const getAppointmentById = asyncHandler(async (req: Request, res: Response) => {
  const includeCustomer = req.user!.role === "admin";
  const appointment = await getAppointment(routeParam(req, "id"), req.user!, includeCustomer);
  return sendSuccess(res, appointment);
});

export const patchCancelAppointment = asyncHandler(
  async (req: Request, res: Response) => {
    const appointment = await cancelAppointment(routeParam(req, "id"), req.user!);
    return sendSuccess(res, appointment, { message: "Appointment cancelled" });
  },
);

export const patchConfirmAppointment = asyncHandler(
  async (req: Request, res: Response) => {
    const appointment = await confirmAppointment(routeParam(req, "id"));
    return sendSuccess(res, appointment, { message: "Appointment confirmed" });
  },
);

export const getAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { date } = req.validatedQuery as { date: string };
  const slots = await getSlotAvailability(date);
  return sendSuccess(res, slots);
});
