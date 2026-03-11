import { Router } from "express";
import { body, param } from "express-validator";
import {
  clearChats,
  deleteChat,
  editMessageAndRegenerate,
  exportChat,
  getChatById,
  getHistory,
  regenerateResponse,
  renameChat,
  setBookmark,
  searchChats,
  sendMessage
} from "../controllers/chatController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { chatMessageSchema, validateBody } from "../middleware/zodValidation.js";

const router = Router();

router.use(authMiddleware);

router.post(
  "/message",
  validateBody(chatMessageSchema),
  asyncHandler(sendMessage)
);
router.post("/:id/regenerate", [param("id").isMongoId()], asyncHandler(regenerateResponse));
router.patch(
  "/:id/title",
  [param("id").isMongoId(), body("title").isString().trim().isLength({ min: 1, max: 100 })],
  asyncHandler(renameChat)
);
router.patch("/:id/bookmark", [param("id").isMongoId(), body("isBookmarked").isBoolean()], asyncHandler(setBookmark));
router.patch(
  "/:chatId/message/:messageId",
  [
    param("chatId").isMongoId(),
    param("messageId").isString().isLength({ min: 1 }),
    body("content").isString().trim().isLength({ min: 1, max: 8000 })
  ],
  asyncHandler(editMessageAndRegenerate)
);

router.get("/history", asyncHandler(getHistory));
router.get("/search", asyncHandler(searchChats));
router.get("/export/:chatId", [param("chatId").isMongoId()], asyncHandler(exportChat));
router.get("/:id", [param("id").isMongoId()], asyncHandler(getChatById));
router.delete("/clear/all", asyncHandler(clearChats));
router.delete("/:id", [param("id").isMongoId()], asyncHandler(deleteChat));

export default router;
