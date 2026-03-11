import { Router } from "express";
import multer from "multer";
import { body } from "express-validator";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { analyzeFile, analyzeImage } from "../controllers/filesController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(authMiddleware);

router.post(
  "/analyze",
  upload.single("file"),
  [
    body("chatId").optional({ nullable: true }).isMongoId(),
    body("mode").optional().isIn(["general", "coding", "study", "creative"]),
    body("prompt").optional().isString().isLength({ max: 3000 })
  ],
  asyncHandler(analyzeFile)
);

router.post(
  "/analyze-image",
  upload.single("image"),
  [
    body("chatId").optional({ nullable: true }).isMongoId(),
    body("mode").optional().isIn(["general", "coding", "study", "creative"]),
    body("prompt").optional().isString().isLength({ max: 3000 })
  ],
  asyncHandler(analyzeImage)
);

export default router;
