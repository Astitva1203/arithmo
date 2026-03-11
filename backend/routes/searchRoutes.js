import { Router } from "express";
import { body } from "express-validator";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { searchWithAI } from "../controllers/searchController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();
router.use(authMiddleware);

router.post(
  "/",
  [
    body("query").isString().trim().isLength({ min: 2, max: 500 }),
    body("mode").optional().isIn(["general", "coding", "study", "creative"])
  ],
  asyncHandler(searchWithAI)
);

export default router;
