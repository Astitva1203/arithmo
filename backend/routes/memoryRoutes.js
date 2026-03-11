import { Router } from "express";
import { body, param } from "express-validator";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import {
  deleteMemory,
  listMemories,
  updateMemory,
  upsertMemory
} from "../controllers/memoryController.js";

const router = Router();
router.use(authMiddleware);

router.get("/", asyncHandler(listMemories));
router.post(
  "/",
  [
    body("memoryKey").isString().trim().isLength({ min: 2, max: 80 }),
    body("memoryValue").isString().trim().isLength({ min: 1, max: 500 })
  ],
  asyncHandler(upsertMemory)
);
router.put(
  "/:id",
  [
    param("id").isMongoId(),
    body("memoryKey").isString().trim().isLength({ min: 2, max: 80 }),
    body("memoryValue").isString().trim().isLength({ min: 1, max: 500 })
  ],
  asyncHandler(updateMemory)
);
router.delete("/:id", [param("id").isMongoId()], asyncHandler(deleteMemory));

export default router;
