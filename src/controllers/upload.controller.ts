import type { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { uploadImageToImgBB } from "../lib/imgbb.js";
import { badRequest } from "../utils/app-error.js";

export const postUpload = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw badRequest("Choose an image to upload");
  }

  const image = await uploadImageToImgBB(req.file.buffer, req.file.mimetype);
  return sendSuccess(res, image, { status: 201, message: "Image uploaded" });
});
