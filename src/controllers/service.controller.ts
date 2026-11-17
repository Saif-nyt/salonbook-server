import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import {
  buildMeta,
  getValidatedBody,
  getValidatedQuery,
  routeParam,
} from "../utils/request.js";
import { sendSuccess } from "../utils/api-response.js";
import type {
  ServiceCreateInput,
  ServiceQuery,
  ServiceUpdateInput,
} from "../validators/index.js";
import {
  createService,
  deleteService,
  getServiceById,
  listCategoryCounts,
  listServices,
  setServiceStatus,
  updateService,
} from "../services/service.service.js";

export const getServices = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<ServiceQuery>(req);
  const includeInactive = req.user?.role === "admin";
  const { items, total } = await listServices(query, { includeInactive });

  return sendSuccess(res, items, {
    meta: {
      ...buildMeta(total, query.page, query.limit),
      ...(includeInactive ? {} : { activeOnly: true }),
    },
  });
});

export const getService = asyncHandler(async (req: Request, res: Response) => {
  const service = await getServiceById(routeParam(req, "id"));
  return sendSuccess(res, service);
});

export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await listCategoryCounts();
  return sendSuccess(res, categories);
});

export const postService = asyncHandler(async (req: Request, res: Response) => {
  const input = getValidatedBody<ServiceCreateInput>(req);
  const service = await createService(input);
  return sendSuccess(res, service, { status: 201, message: "Service created" });
});

export const patchService = asyncHandler(async (req: Request, res: Response) => {
  const input = getValidatedBody<ServiceUpdateInput>(req);
  const service = await updateService(routeParam(req, "id"), input);
  return sendSuccess(res, service, { message: "Service updated" });
});

export const patchServiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.validatedBody as { status: "active" | "inactive" };
  const service = await setServiceStatus(routeParam(req, "id"), status);
  return sendSuccess(res, service, { message: `Service marked ${status}` });
});

export const removeService = asyncHandler(async (req: Request, res: Response) => {
  const result = await deleteService(routeParam(req, "id"));
  return sendSuccess(res, result, { message: "Service deleted" });
});
