import { Router } from "express";
import { body, param } from "express-validator";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createPrompt, deletePrompt, listPrompts, updatePrompt } from "../controllers/promptController.js";

const router = Router();
router.use(authMiddleware);

router.get("/", asyncHandler(listPrompts));
router.post(
  "/",
  [body("title").isString().trim().isLength({ min: 1, max: 100 }), body("promptText").isString().trim().isLength({ min: 1, max: 2000 })],
  asyncHandler(createPrompt)
);
router.put(
  "/:id",
  [
    param("id").isMongoId(),
    body("title").isString().trim().isLength({ min: 1, max: 100 }),
    body("promptText").isString().trim().isLength({ min: 1, max: 2000 })
  ],
  asyncHandler(updatePrompt)
);
router.delete("/:id", [param("id").isMongoId()], asyncHandler(deletePrompt));

export default router;
