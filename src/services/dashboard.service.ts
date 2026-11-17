import { Appointment } from "../models/appointment.model.js";
import { Service } from "../models/service.model.js";
import { Transaction } from "../models/transaction.model.js";
import { User } from "../models/user.model.js";

export async function getCustomerStats(customerId: string) {
  const [total, pending, confirmed, cancelled, paid] = await Promise.all([
    Appointment.countDocuments({ customerId }),
    Appointment.countDocuments({ customerId, status: "pending" }),
    Appointment.countDocuments({ customerId, status: "confirmed" }),
    Appointment.countDocuments({ customerId, status: "cancelled" }),
    Transaction.aggregate<{ count: number; amount: number }>([
      { $match: { customerId, status: "paid" } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const paidRow = paid[0];

  return {
    totalAppointments: total,
    pending,
    confirmed,
    cancelled,
    payments: paidRow?.count ?? 0,
    totalPaid: paidRow?.amount ?? 0,
  };
}

export async function getAdminStats() {
  const [
    totalCustomers,
    activeServices,
    totalAppointments,
    pending,
    confirmed,
    payments,
  ] = await Promise.all([
    User.countDocuments({ role: "customer" }),
    Service.countDocuments({ status: "active" }),
    Appointment.countDocuments(),
    Appointment.countDocuments({ status: "pending" }),
    Appointment.countDocuments({ status: "confirmed" }),
    Transaction.aggregate<{ count: number; amount: number }>([
      { $match: { status: "paid" } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const paymentRow = payments[0];

  return {
    totalCustomers,
    activeServices,
    totalAppointments,
    pending,
    confirmed,
    successfulPayments: paymentRow?.count ?? 0,
    totalRevenue: paymentRow?.amount ?? 0,
  };
}
