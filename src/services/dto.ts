import type { Types } from "mongoose";
import type { AppointmentDocument } from "../models/appointment.model.js";
import type { ServiceDocument } from "../models/service.model.js";
import type { TransactionDocument } from "../models/transaction.model.js";
import type { PublicUser } from "../models/user.model.js";

export interface ServiceDto {
  id: string;
  serviceName: string;
  category: string;
  description: string;
  price: number;
  duration: number;
  image: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toServiceDto(
  service: Pick<
    ServiceDocument,
    | "serviceName"
    | "category"
    | "description"
    | "price"
    | "duration"
    | "image"
    | "status"
    | "createdAt"
    | "updatedAt"
  > & { _id: Types.ObjectId },
): ServiceDto {
  return {
    id: service._id.toString(),
    serviceName: service.serviceName,
    category: service.category,
    description: service.description,
    price: service.price,
    duration: service.duration,
    image: service.image,
    status: service.status,
    createdAt: service.createdAt,
    updatedAt: service.updatedAt,
  };
}

export interface AppointmentDto {
  id: string;
  serviceId: string;
  customerId: string;
  appointmentDate: Date;
  timeSlot: string;
  message: string;
  servicePrice: number;
  paymentStatus: string;
  status: string;
  createdAt: Date;
  service: {
    name: string;
    image: string;
    category: string;
    duration: number;
  };
  customer?: PublicUser;
}

export function toAppointmentDto(
  appointment: Pick<
    AppointmentDocument,
    | "serviceId"
    | "customerId"
    | "appointmentDate"
    | "timeSlot"
    | "message"
    | "servicePrice"
    | "paymentStatus"
    | "status"
    | "serviceName"
    | "serviceImage"
    | "serviceCategory"
    | "serviceDuration"
    | "createdAt"
  > & { _id: Types.ObjectId },
  customer?: PublicUser,
): AppointmentDto {
  return {
    id: appointment._id.toString(),
    serviceId: appointment.serviceId.toString(),
    customerId: appointment.customerId,
    appointmentDate: appointment.appointmentDate,
    timeSlot: appointment.timeSlot,
    message: appointment.message ?? "",
    servicePrice: appointment.servicePrice,
    paymentStatus: appointment.paymentStatus,
    status: appointment.status,
    createdAt: appointment.createdAt,
    service: {
      name: appointment.serviceName,
      image: appointment.serviceImage,
      category: appointment.serviceCategory,
      duration: appointment.serviceDuration,
    },
    ...(customer ? { customer } : {}),
  };
}

export interface TransactionDto {
  id: string;
  appointmentId: string;
  customerId: string;
  amount: number;
  currency: string;
  stripeSessionId: string;
  status: string;
  createdAt: Date;
  customer?: PublicUser;
  appointment?: {
    date: Date;
    timeSlot: string;
    serviceName: string;
    serviceImage: string;
  };
}

export function toTransactionDto(
  transaction: Pick<
    TransactionDocument,
    | "appointmentId"
    | "customerId"
    | "amount"
    | "currency"
    | "stripeSessionId"
    | "status"
    | "createdAt"
  > & { _id: Types.ObjectId },
  extras: {
    customer?: PublicUser;
    appointment?: TransactionDto["appointment"];
  } = {},
): TransactionDto {
  return {
    id: transaction._id.toString(),
    appointmentId: transaction.appointmentId ? transaction.appointmentId.toString() : "",
    customerId: transaction.customerId,
    amount: transaction.amount,
    currency: transaction.currency,
    stripeSessionId: transaction.stripeSessionId,
    status: transaction.status,
    createdAt: transaction.createdAt,
    ...(extras.customer ? { customer: extras.customer } : {}),
    ...(extras.appointment ? { appointment: extras.appointment } : {}),
  };
}
