import { Types, type QueryFilter } from "mongoose";
import { Appointment } from "../models/appointment.model.js";
import { Transaction, type TransactionDocument } from "../models/transaction.model.js";
import type { TransactionQuery } from "../validators/index.js";
import { notFound } from "../utils/app-error.js";
import { toTransactionDto, type TransactionDto } from "./dto.js";
import { findPublicUsersByIds } from "./user-lookup.js";

function appointmentExtras(
  appointment: {
    appointmentDate: Date;
    timeSlot: string;
    serviceName: string;
    serviceImage: string;
  },
): NonNullable<TransactionDto["appointment"]> {
  return {
    date: appointment.appointmentDate,
    timeSlot: appointment.timeSlot,
    serviceName: appointment.serviceName,
    serviceImage: appointment.serviceImage,
  };
}

async function decorateTransactions(
  transactions: (Pick<
    TransactionDocument,
    | "appointmentId"
    | "customerId"
    | "amount"
    | "currency"
    | "stripeSessionId"
    | "status"
    | "createdAt"
  > & { _id: TransactionDocument["_id"] })[],
  includeCustomers: boolean,
) {
  const appointmentIds = transactions
    .map((item) => (item.appointmentId ? String(item.appointmentId) : ""))
    .filter((id) => Types.ObjectId.isValid(id));
  const customerIds = transactions
    .map((item) => (item.customerId ? String(item.customerId) : ""))
    .filter(Boolean);

  const [appointments, customers] = await Promise.all([
    appointmentIds.length > 0
      ? Appointment.find({ _id: { $in: appointmentIds } }).lean()
      : Promise.resolve([]),
    includeCustomers
      ? findPublicUsersByIds(customerIds)
      : Promise.resolve(new Map()),
  ]);

  const appointmentMap = new Map(
    appointments.map((appointment) => [appointment._id.toString(), appointment]),
  );

  return transactions.map((transaction) => {
    const appointment = transaction.appointmentId
      ? appointmentMap.get(String(transaction.appointmentId))
      : undefined;
    return toTransactionDto(transaction, {
      ...(includeCustomers
        ? { customer: customers.get(transaction.customerId) }
        : {}),
      ...(appointment ? { appointment: appointmentExtras(appointment) } : {}),
    });
  });
}

export async function listCustomerTransactions(
  customerId: string,
  query: TransactionQuery,
) {
  const filter: QueryFilter<TransactionDocument> = { customerId };
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return { items: await decorateTransactions(items, false), total };
}

export async function listAllTransactions(query: TransactionQuery) {
  const filter: QueryFilter<TransactionDocument> = {};
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Transaction.countDocuments(filter),
  ]);

  return { items: await decorateTransactions(items, true), total };
}

export async function getPaymentStatus(userId: string, sessionId: string) {
  const transaction = await Transaction.findOne({
    stripeSessionId: sessionId,
    customerId: userId,
  }).lean();

  if (!transaction) throw notFound("Payment session not found");

  if (!transaction.appointmentId || !Types.ObjectId.isValid(String(transaction.appointmentId))) {
    throw notFound("Appointment not found");
  }

  const appointment = await Appointment.findById(transaction.appointmentId).lean();
  if (!appointment) throw notFound("Appointment not found");

  return {
    sessionId,
    transactionStatus: transaction.status,
    appointmentStatus: appointment.status,
    paymentStatus: appointment.paymentStatus,
    amount: transaction.amount,
    currency: transaction.currency,
  };
}
