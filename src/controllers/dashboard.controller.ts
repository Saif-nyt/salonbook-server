import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { getAdminStats, getCustomerStats } from "../services/dashboard.service.js";

export const getMyDashboard = asyncHandler(async (req: Request, res: Response) => {
  const stats = await getCustomerStats(req.user!._id.toString());
  return sendSuccess(res, stats);
});

export const getAdminDashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await getAdminStats();
  return sendSuccess(res, stats);
});
