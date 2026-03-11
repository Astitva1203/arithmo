import { Router } from "express";
import multer from "multer";
import { body } from "express-validator";
import { codeAssist, summarizeDocument } from "../controllers/aiController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

router.post(
  "/summarize",
  authMiddleware,
  upload.single("file"),
  [
    body("text").optional().isString().isLength({ max: 20000 }),
    body("chatId").optional({ nullable: true }).isMongoId(),
    body("mode").optional().isIn(["general", "coding", "study", "creative"])
  ],
  asyncHandler(summarizeDocument)
);

router.post(
  "/code-assist",
  authMiddleware,
  [
    body("code").isString().trim().isLength({ min: 1, max: 30000 }),
    body("language").optional().isString().isLength({ max: 40 }),
    body("task").optional().isIn(["explain", "debug", "optimize"])
  ],
  asyncHandler(codeAssist)
);

export default router;
