import { validationResult } from "express-validator";
import Chat from "../models/Chat.js";
import { extractText, imageToBase64 } from "../services/fileService.js";
import { createCompletion, createVisionCompletion } from "../services/groqService.js";
import { sanitizeText } from "../utils/sanitize.js";

const attachToChat = async ({ userId, chatId, mode, userMessage, assistantMessage, title = "File Analysis" }) => {
  let chat = null;
  if (chatId) {
    chat = await Chat.findOne({ _id: chatId, userId });
  }

  if (!chat) {
    chat = await Chat.create({
      userId,
      mode,
      title,
      messages: []
    });
  }

  chat.mode = mode;
  chat.messages.push(
    { role: "user", content: userMessage, timestamp: new Date() },
    { role: "assistant", content: assistantMessage, timestamp: new Date() }
  );
  await chat.save();
  return chat;
};

export const analyzeFile = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (!req.file) {
    return res.status(400).json({ message: "File is required" });
  }
  const fileName = req.file.originalname?.toLowerCase() || "";
  const isPdf = req.file.mimetype === "application/pdf" || fileName.endsWith(".pdf");
  const isTxt = req.file.mimetype.startsWith("text/") || fileName.endsWith(".txt");
  const isDocx =
    req.file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx");

  if (!isPdf && !isTxt && !isDocx) {
    return res.status(400).json({ message: "Unsupported file type. Use PDF, TXT, or DOCX." });
  }

  const content = await extractText(req.file);
  if (!content || !content.trim()) {
    return res.status(400).json({ message: "Could not extract text from file" });
  }

  const mode = req.body.mode || "study";
  const question = sanitizeText(req.body.prompt || "Summarize and explain this document.");
  const userMessage = `Analyze this file (${req.file.originalname}): ${question}`;

  const completion = await createCompletion({
    mode,
    messages: [
      {
        role: "user",
        content: `${question}\n\nDocument content:\n${content.slice(0, 20000)}`
      }
    ]
  });

  const analysis =
    completion.choices?.[0]?.message?.content || "I could not generate analysis for this file. Please try again.";

  const chat = await attachToChat({
    userId: req.user.id,
    chatId: req.body.chatId,
    mode,
    userMessage,
    assistantMessage: analysis,
    title: "File Analysis"
  });

  return res.json({ analysis, chatId: chat._id });
};

export const analyzeImage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Image is required" });
  }
  const allowed = ["image/png", "image/jpg", "image/jpeg"];
  if (!allowed.includes(req.file.mimetype)) {
    return res.status(400).json({ message: "Unsupported image format. Use PNG, JPG, or JPEG." });
  }

  const base64Image = imageToBase64(req.file);
  const question = sanitizeText(req.body.prompt || "Describe and explain this image in detail.");
  const mode = req.body.mode || "general";

  const completion = await createVisionCompletion({
    prompt: question,
    base64Image,
    mimeType: req.file.mimetype || "image/jpeg"
  });

  const analysis =
    completion.choices?.[0]?.message?.content || "I could not analyze this image. Please try again.";

  const chat = await attachToChat({
    userId: req.user.id,
    chatId: req.body.chatId,
    mode,
    userMessage: `Analyze this image (${req.file.originalname}): ${question}`,
    assistantMessage: analysis,
    title: "Image Analysis"
  });

  return res.json({ analysis, chatId: chat._id });
};
