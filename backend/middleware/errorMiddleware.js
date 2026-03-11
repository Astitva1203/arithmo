import multer from "multer";
import mongoose from "mongoose";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const notFoundHandler = (_req, res) => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler = (err, _req, res, _next) => {
  const status = err.statusCode || err.status || 500;
  let message = err.message || "Internal server error";

  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Invalid request data",
      errors: err.issues
    });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      message: err.code === "LIMIT_FILE_SIZE" ? "Uploaded file is too large" : "File upload error"
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ message: "Invalid resource id" });
  }

  if (err.code === 11000) {
    message = "Duplicate resource";
  }

  if (status >= 500) {
    console.error(err);
    message = "Something went wrong. Please try again.";
  }

  return res.status(status).json({ message });
};
