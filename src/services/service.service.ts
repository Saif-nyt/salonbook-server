import type { QueryFilter, SortOrder } from "mongoose";
import { Service, type ServiceDocument } from "../models/service.model.js";
import type { ServiceCreateInput, ServiceQuery, ServiceUpdateInput } from "../validators/index.js";
import { notFound } from "../utils/app-error.js";
import { toObjectId } from "../utils/mongo.js";
import { toServiceDto } from "./dto.js";

const SORT_OPTIONS: Record<ServiceQuery["sort"], Record<string, SortOrder>> = {
  newest: { createdAt: -1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  "name-asc": { serviceName: 1 },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface ListOptions {
  includeInactive?: boolean;
}

export async function listServices(query: ServiceQuery, options: ListOptions = {}) {
  const filter: QueryFilter<ServiceDocument> = {};

  if (!options.includeInactive) {
    filter.status = "active";
  } else if (query.status) {
    filter.status = query.status;
  }

  if (query.category) filter.category = query.category;
  if (query.search) {
    filter.serviceName = { $regex: escapeRegExp(query.search), $options: "i" };
  }

  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort(SORT_OPTIONS[query.sort])
      .skip(skip)
      .limit(query.limit)
      .lean(),
    Service.countDocuments(filter),
  ]);

  return { items: items.map(toServiceDto), total };
}

export async function getServiceById(id: string) {
  const service = await Service.findById(toObjectId(id, "service id")).lean();
  if (!service) throw notFound("Service not found");
  return toServiceDto(service);
}

export async function createService(input: ServiceCreateInput) {
  const service = await Service.create(input);
  return toServiceDto(service);
}

export async function updateService(id: string, input: ServiceUpdateInput) {
  const service = await Service.findByIdAndUpdate(
    toObjectId(id, "service id"),
    { $set: input },
    { new: true, runValidators: true },
  ).lean();

  if (!service) throw notFound("Service not found");
  return toServiceDto(service);
}

export async function setServiceStatus(
  id: string,
  status: ServiceDocument["status"],
) {
  const service = await Service.findByIdAndUpdate(
    toObjectId(id, "service id"),
    { $set: { status } },
    { new: true, runValidators: true },
  ).lean();

  if (!service) throw notFound("Service not found");
  return toServiceDto(service);
}

export async function deleteService(id: string) {
  const service = await Service.findByIdAndDelete(toObjectId(id, "service id")).lean();
  if (!service) throw notFound("Service not found");
  return { id };
}

export async function listCategoryCounts() {
  const rows = await Service.aggregate<{ _id: string; count: number }>([
    { $match: { status: "active" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  return rows.map((row) => ({ category: row._id, count: row.count }));
}
