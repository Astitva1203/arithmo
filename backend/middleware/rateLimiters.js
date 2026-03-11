import rateLimit from "express-rate-limit";

const standardConfig = {
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || req.ip,
  message: { message: "Too many requests. Please slow down and try again." }
};

export const authRateLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 20
});

export const chatRateLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 20
});

export const filesRateLimiter = rateLimit({
  ...standardConfig,
  windowMs: 60 * 1000,
  max: 20
});
