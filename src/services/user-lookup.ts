import { Types } from "mongoose";
import { User, toPublicUser, type PublicUser } from "../models/user.model.js";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function findPublicUsersByIds(
  ids: string[],
): Promise<Map<string, PublicUser>> {
  const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
  if (validIds.length === 0) return new Map();

  const users = await User.find({ _id: { $in: validIds } }).lean();
  return new Map(users.map((user) => [user._id.toString(), toPublicUser(user)]));
}

export async function findCustomerIdsBySearch(search: string): Promise<string[]> {
  const regex = new RegExp(escapeRegExp(search), "i");
  const users = await User.find({
    role: "customer",
    $or: [{ name: regex }, { email: regex }],
  })
    .select("_id")
    .lean();
  return users.map((user) => user._id.toString());
}
