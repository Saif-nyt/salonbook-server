import multer from "multer";
import { ALLOWED_IMAGE_TYPES } from "../lib/imgbb.js";
import { badRequest } from "../utils/app-error.js";

const storage = multer.memoryStorage();

export const singleImageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(badRequest("Upload a JPEG, PNG, WebP or GIF image"));
      return;
    }
    callback(null, true);
  },
}).single("image");
