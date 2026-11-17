import type { QueryFilter } from "mongoose";
import { Appointment, type AppointmentDocument } from "../models/appointment.model.js";
import { Service } from "../models/service.model.js";
import { TIME_SLOTS } from "../config/constants.js";
import type { UserDocument } from "../models/user.model.js";
import type { AppointmentCreateInput, AppointmentQuery } from "../validators/index.js";
import { conflict, forbidden, notFound } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { isDuplicateKeyError, toObjectId } from "../utils/mongo.js";
import { toAppointmentDto } from "./dto.js";
import {
  findCustomerIdsBySearch,
  findPublicUsersByIds,
} from "./user-lookup.js";

function buildAppointmentFilter(query: AppointmentQuery): QueryFilter<AppointmentDocument> {
  const filter: QueryFilter<AppointmentDocument> = {};
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  return filter;
}

export async function createAppointment(user: UserDocument, input: AppointmentCreateInput) {
  if (user.role !== "customer") {
    throw forbidden("Only customers can request appointments");
  }

  const service = await Service.findById(toObjectId(input.serviceId, "service id")).lean();
  if (!service) throw notFound("Service not found");
  if (service.status !== "active") {
    throw conflict("This service is not currently accepting appointments", "SERVICE_INACTIVE");
  }

  const appointmentDate = parseDateOnly(input.appointmentDate);

  const existing = await Appointment.exists({
    appointmentDate,
    timeSlot: input.timeSlot,
    active: true,
  });
  if (existing) {
    throw conflict(
      "That time slot is already reserved. Please choose another time.",
      "SLOT_UNAVAILABLE",
    );
  }

  try {
    const appointment = await Appointment.create({
      serviceId: service._id,
      customerId: user._id.toString(),
      appointmentDate,
      timeSlot: input.timeSlot,
      message: input.message,
      servicePrice: service.price,
      paymentStatus: "unpaid",
      status: "pending",
      active: true,
      serviceName: service.serviceName,
      serviceImage: service.image,
      serviceCategory: service.category,
      serviceDuration: service.duration,
    });

    return toAppointmentDto(appointment.toObject());
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw conflict(
        "That time slot has just been reserved. Please choose another time.",
        "SLOT_UNAVAILABLE",
      );
    }
    throw error;
  }
}

export async function listCustomerAppointments(
  customerId: string,
  query: AppointmentQuery,
) {
  const filter = { ...buildAppointmentFilter(query), customerId };
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ appointmentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  return { items: items.map((item) => toAppointmentDto(item)), total };
}

export async function listAllAppointments(query: AppointmentQuery) {
  const filter = buildAppointmentFilter(query);

  if (query.search) {
    const regex = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const matchedCustomers = await findCustomerIdsBySearch(query.search);
    filter.$or = [
      { serviceName: regex },
      ...(matchedCustomers.length > 0
        ? [{ customerId: { $in: matchedCustomers } }]
        : []),
    ];
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Appointment.countDocuments(filter),
  ]);

  const customers = await findPublicUsersByIds(items.map((item) => item.customerId));

  return {
    items: items.map((item) =>
      toAppointmentDto(item, customers.get(item.customerId)),
    ),
    total,
  };
}

export async function getAppointment(
  id: string,
  user: UserDocument,
  includeCustomer = false,
) {
  const appointment = await Appointment.findById(toObjectId(id, "appointment id")).lean();
  if (!appointment) throw notFound("Appointment not found");

  if (user.role === "customer" && appointment.customerId !== user._id.toString()) {
    throw notFound("Appointment not found");
  }

  if (!includeCustomer) {
    return toAppointmentDto(appointment);
  }

  const customers = await findPublicUsersByIds([appointment.customerId]);
  return toAppointmentDto(appointment, customers.get(appointment.customerId));
}

export async function cancelAppointment(id: string, user: UserDocument) {
  const objectId = toObjectId(id, "appointment id");
  const appointment = await Appointment.findById(objectId).lean();
  if (!appointment) throw notFound("Appointment not found");

  if (user.role === "customer" && appointment.customerId !== user._id.toString()) {
    throw notFound("Appointment not found");
  }

  if (appointment.status === "cancelled") {
    throw conflict("This appointment has already been cancelled", "ALREADY_CANCELLED");
  }

  if (user.role === "customer" && appointment.status !== "pending") {
    throw conflict(
      "Only pending appointments can be cancelled by customers",
      "CANCELLATION_NOT_ALLOWED",
    );
  }

  const updated = await Appointment.findOneAndUpdate(
    {
      _id: objectId,
      active: true,
      status: user.role === "customer" ? "pending" : { $in: ["pending", "confirmed"] },
    },
    { $set: { status: "cancelled", active: false } },
    { new: true },
  ).lean();

  if (!updated) {
    throw conflict(
      "This appointment can no longer be cancelled",
      "CANCELLATION_NOT_ALLOWED",
    );
  }

  return toAppointmentDto(updated);
}

export async function confirmAppointment(id: string) {
  const objectId = toObjectId(id, "appointment id");
  const appointment = await Appointment.findById(objectId).lean();
  if (!appointment) throw notFound("Appointment not found");

  if (appointment.status === "confirmed") {
    throw conflict("This appointment is already confirmed", "ALREADY_CONFIRMED");
  }
  if (appointment.status === "cancelled") {
    throw conflict(
      "Cancelled appointments cannot be confirmed",
      "CONFIRMATION_NOT_ALLOWED",
    );
  }

  const updated = await Appointment.findOneAndUpdate(
    { _id: objectId, status: "pending" },
    { $set: { status: "confirmed" } },
    { new: true },
  ).lean();

  if (!updated) {
    throw conflict("Only pending appointments can be confirmed", "CONFIRMATION_NOT_ALLOWED");
  }

  return toAppointmentDto(updated);
}

export async function getSlotAvailability(dateValue: string) {
  const appointmentDate = parseDateOnly(dateValue);
  const booked = await Appointment.find({ appointmentDate, active: true })
    .select("timeSlot")
    .lean();

  const bookedSlots = new Set(booked.map((item) => item.timeSlot));

  return TIME_SLOTS.map((slot) => ({
    slot,
    available: !bookedSlots.has(slot),
  }));
}
