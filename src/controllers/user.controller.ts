import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import {
  buildMeta,
  getValidatedBody,
  getValidatedQuery,
  routeParam,
} from "../utils/request.js";
import { toPublicUser } from "../models/user.model.js";
import type { ProfileUpdateInput, UserQuery } from "../validators/index.js";
import {
  getCustomerDetails,
  listCustomers,
  setUserBlocked,
  updateProfile,
} from "../services/user.service.js";

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  return sendSuccess(res, toPublicUser(req.user!));
});

export const patchProfile = asyncHandler(async (req: Request, res: Response) => {
  const input = getValidatedBody<ProfileUpdateInput>(req);
  const user = await updateProfile(req.user!._id.toString(), input);
  return sendSuccess(res, user, { message: "Profile updated" });
});

export const getCustomers = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<UserQuery>(req);
  const { items, total } = await listCustomers(query);
  return sendSuccess(res, items, {
    meta: buildMeta(total, query.page, query.limit),
  });
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  const details = await getCustomerDetails(routeParam(req, "id"));
  return sendSuccess(res, details);
});

export const patchBlockUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await setUserBlocked(routeParam(req, "id"), true);
  return sendSuccess(res, user, { message: "Customer blocked" });
});

export const patchUnblockUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await setUserBlocked(routeParam(req, "id"), false);
  return sendSuccess(res, user, { message: "Customer unblocked" });
});
