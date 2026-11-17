import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { buildMeta, getValidatedQuery } from "../utils/request.js";
import type { TransactionQuery } from "../validators/index.js";
import {
  listAllTransactions,
  listCustomerTransactions,
} from "../services/transaction.service.js";

export const getMyTransactions = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<TransactionQuery>(req);
  const { items, total } = await listCustomerTransactions(
    req.user!._id.toString(),
    query,
  );
  return sendSuccess(res, items, {
    meta: buildMeta(total, query.page, query.limit),
  });
});

export const getAllTransactions = asyncHandler(async (req: Request, res: Response) => {
  const query = getValidatedQuery<TransactionQuery>(req);
  const { items, total } = await listAllTransactions(query);
  return sendSuccess(res, items, {
    meta: buildMeta(total, query.page, query.limit),
  });
});
