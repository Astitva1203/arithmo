import { Router } from "express";
import { body, param } from "express-validator";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listPinnedMessages, pinMessage, unpinMessage } from "../controllers/pinController.js";

const router = Router();
router.use(authMiddleware);

router.get("/", asyncHandler(listPinnedMessages));
router.post(
  "/",
  [
    body("messageId").isString().isLength({ min: 1 }),
    body("chatId").isMongoId(),
    body("content").isString().isLength({ min: 1, max: 8000 })
  ],
  asyncHandler(pinMessage)
);
router.delete("/:id", [param("id").isMongoId()], asyncHandler(unpinMessage));

export default router;
