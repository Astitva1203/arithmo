import { z } from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const authSignupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  ageConfirmed: z.literal(true),
  policyVersion: z.string().min(4).max(32).optional()
});

export const authLoginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const chatMessageSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  chatId: z.string().regex(objectIdRegex).optional().nullable(),
  mode: z.enum(["general", "coding", "study", "creative"]).optional(),
  stream: z.boolean().optional(),
  useWebSearch: z.boolean().optional()
});

export const validateBody =
  (schema) =>
  (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
