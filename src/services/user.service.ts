import mongoose from "mongoose";
import { Appointment } from "../models/appointment.model.js";
import { User, toPublicUser, type PublicUser } from "../models/user.model.js";
import type { ProfileUpdateInput, UserQuery } from "../validators/index.js";
import { forbidden, notFound } from "../utils/app-error.js";
import { toObjectId } from "../utils/mongo.js";
import { toAppointmentDto } from "./dto.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getPublicUserById(id: string): Promise<PublicUser> {
  const user = await User.findById(toObjectId(id, "user id")).lean();
  if (!user) throw notFound("User not found");
  return toPublicUser(user);
}

export async function listCustomers(query: UserQuery) {
  const filter: Record<string, unknown> = { role: "customer" };

  if (query.search) {
    const regex = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  const skip = (query.page - 1) * query.limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
    User.countDocuments(filter),
  ]);

  return { items: users.map(toPublicUser), total };
}

export async function getCustomerDetails(id: string) {
  const user = await User.findById(toObjectId(id, "customer id")).lean();
  if (!user) throw notFound("Customer not found");
  if (user.role === "admin") throw notFound("Customer not found");

  const [appointments, counts] = await Promise.all([
    Appointment.find({ customerId: id }).sort({ createdAt: -1 }).limit(8).lean(),
    Appointment.aggregate<{ _id: string; count: number }>([
      { $match: { customerId: id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const appointmentCounts = counts.reduce<Record<string, number>>((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});

  return {
    customer: toPublicUser(user),
    appointmentCounts: {
      total: Object.values(appointmentCounts).reduce((sum, value) => sum + value, 0),
      pending: appointmentCounts.pending ?? 0,
      confirmed: appointmentCounts.confirmed ?? 0,
      cancelled: appointmentCounts.cancelled ?? 0,
    },
    recentAppointments: appointments.map((appointment) => toAppointmentDto(appointment)),
  };
}

export async function updateProfile(userId: string, input: ProfileUpdateInput) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.phone !== undefined) updates.phone = input.phone || null;
  if (input.image !== undefined) updates.image = input.image || null;

  const user = await User.findByIdAndUpdate(
    toObjectId(userId, "user id"),
    { $set: updates },
    { new: true, runValidators: true },
  ).lean();

  if (!user) throw notFound("User not found");
  return toPublicUser(user);
}

export async function setUserBlocked(id: string, isBlocked: boolean) {
  const user = await User.findById(toObjectId(id, "user id"));
  if (!user) throw notFound("Customer not found");
  if (user.role === "admin") throw forbidden("Administrator accounts cannot be blocked");

  user.isBlocked = isBlocked;
  user.updatedAt = new Date();
  await user.save();

  if (isBlocked) {
    const database = mongoose.connection.db;
    if (database) {
      await database.collection("session").deleteMany({ userId: user._id.toString() });
    }
  }

  return toPublicUser(user);
}
