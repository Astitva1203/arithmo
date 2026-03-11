import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import dotenv from "dotenv";
import { connectDB } from "./utils/connectDB.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import memoryRoutes from "./routes/memoryRoutes.js";
import filesRoutes from "./routes/filesRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import pinRoutes from "./routes/pinRoutes.js";
import promptRoutes from "./routes/promptRoutes.js";
import { authRateLimiter, chatRateLimiter, filesRateLimiter } from "./middleware/rateLimiters.js";
import { errorHandler, notFoundHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((origin) => origin.trim().replace(/\/+$/, ""))
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.trim().replace(/\/+$/, "");
      const isExplicitlyAllowed = allowedOrigins.includes(normalized);
      let isVercelPreview = false;
      try {
        isVercelPreview = /\.vercel\.app$/i.test(new URL(normalized).hostname);
      } catch {
        isVercelPreview = false;
      }
      if (isExplicitlyAllowed || isVercelPreview) {
        return callback(null, true);
      }
      return callback(new Error("CORS blocked for this origin"));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan("dev"));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Arithmo API" });
});

app.use("/api/auth", authRateLimiter, authRoutes);
app.use("/api/chat", chatRateLimiter, chatRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/memory", memoryRoutes);
app.use("/api/files", filesRateLimiter, filesRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/pins", pinRoutes);
app.use("/api/prompts", promptRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Backend running on port ${port}`);
  });
});
