import { Router } from "express";
import { body } from "express-validator";
import {
  completeOnboarding,
  deleteAccount,
  getMe,
  login,
  signup,
  updatePreferences
} from "../controllers/authController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authLoginSchema, authSignupSchema, validateBody } from "../middleware/zodValidation.js";

const router = Router();

router.post("/signup", validateBody(authSignupSchema), asyncHandler(signup));

router.post("/login", validateBody(authLoginSchema), asyncHandler(login));

router.get("/me", authMiddleware, asyncHandler(getMe));
router.patch(
  "/preferences",
  authMiddleware,
  [
    body("responseStyle").optional().isIn(["professional", "friendly", "teacher", "concise"]),
    body("responseLength").optional().isIn(["short", "normal", "detailed"])
  ],
  asyncHandler(updatePreferences)
);
router.post("/onboarding", authMiddleware, [body("completed").optional().isBoolean()], asyncHandler(completeOnboarding));
router.delete("/me", authMiddleware, asyncHandler(deleteAccount));

export default router;
