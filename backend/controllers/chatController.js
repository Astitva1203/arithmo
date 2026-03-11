import { validationResult } from "express-validator";
import PDFDocument from "pdfkit";
import MarkdownIt from "markdown-it";
import Chat from "../models/Chat.js";
import { createCompletion } from "../services/groqService.js";
import User from "../models/User.js";
import {
  extractMemoriesFromText,
  getMemoryContext,
  saveMemories
} from "../services/memoryService.js";
import { formatSearchContext, runWebSearch } from "../services/searchService.js";
import { sanitizeText } from "../utils/sanitize.js";

const buildMessages = (messages = []) =>
  messages.map((item) => ({ role: item.role, content: item.content }));
const md = new MarkdownIt();

const autoTitle = (content = "") =>
  content
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ") || "New Chat";

const styleInstructions = {
  professional: "You are a professional assistant. Respond clearly and formally.",
  friendly: "You are a friendly assistant. Be warm, helpful, and approachable.",
  teacher: "You are a teacher. Explain with clear steps and examples.",
  concise: "You are concise. Keep answers direct with minimal filler."
};

const lengthInstructions = {
  short: "Answer briefly in a few sentences.",
  normal: "Provide a balanced answer with practical detail.",
  detailed: "Provide a detailed explanation with clear structure."
};

const getChatOr404 = async (chatId, userId, res) => {
  const chat = await Chat.findOne({ _id: chatId, userId });
  if (!chat) {
    res.status(404).json({ message: "Chat not found" });
    return null;
  }
  return chat;
};

export const sendMessage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.user.id;
  const { chatId, mode = "general", stream = false, useWebSearch = false } = req.body;
  const content = sanitizeText(req.body.content || "");
  const extractedMemories = extractMemoriesFromText(content);
  await saveMemories({ userId, memories: extractedMemories });
  const memoryContext = await getMemoryContext(userId);
  const user = await User.findById(userId).select("responseStyle responseLength");
  const instruction = [styleInstructions[user?.responseStyle || "friendly"], lengthInstructions[user?.responseLength || "normal"]]
    .filter(Boolean)
    .join(" ");

  let chat = chatId ? await Chat.findOne({ _id: chatId, userId }) : null;

  if (!chat) {
    chat = await Chat.create({
      userId,
      mode,
      title: autoTitle(content),
      messages: []
    });
  }

  chat.mode = mode;
  chat.messages.push({ role: "user", content, timestamp: new Date() });

  const promptMessages = buildMessages(chat.messages);
  let webContext = "";
  let searchResults = [];
  if (useWebSearch) {
    searchResults = await runWebSearch(content);
    webContext = formatSearchContext(content, searchResults);
  }

  if (stream) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive"
    });

    const completion = await createCompletion({
      messages: promptMessages,
      mode,
      stream: true,
      memoryContext,
      webContext,
      instruction
    });

    let assistantText = "";

    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        assistantText += delta;
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ token: delta })}\n\n`);
        }
      }
    }

    if (!assistantText) {
      assistantText = "I could not generate a response this time. Please try again.";
    }

    chat.messages.push({
      role: "assistant",
      content: assistantText,
      timestamp: new Date()
    });
    await chat.save();

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ done: true, chatId: chat._id, sources: searchResults })}\n\n`);
    }
    return res.end();
  }

  const completion = await createCompletion({
    messages: promptMessages,
    mode,
    stream: false,
    memoryContext,
    webContext,
    instruction
  });

  const assistantText =
    completion.choices?.[0]?.message?.content || "I could not generate a response this time. Please try again.";
  chat.messages.push({
    role: "assistant",
    content: assistantText,
    timestamp: new Date()
  });
  await chat.save();

  return res.json({
    chatId: chat._id,
    sources: searchResults,
    message: {
      role: "assistant",
      content: assistantText,
      timestamp: new Date()
    }
  });
};

export const regenerateResponse = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const chat = await getChatOr404(req.params.id, req.user.id, res);
  if (!chat) return;

  if (!chat.messages.length) {
    return res.status(400).json({ message: "Chat has no messages" });
  }

  if (chat.messages[chat.messages.length - 1]?.role === "assistant") {
    chat.messages.pop();
  }

  const hasUserPrompt = chat.messages.some((m) => m.role === "user");
  if (!hasUserPrompt) {
    return res.status(400).json({ message: "No user prompt found to regenerate" });
  }

  const memoryContext = await getMemoryContext(req.user.id);
  const user = await User.findById(req.user.id).select("responseStyle responseLength");
  const instruction = [styleInstructions[user?.responseStyle || "friendly"], lengthInstructions[user?.responseLength || "normal"]]
    .filter(Boolean)
    .join(" ");

  const completion = await createCompletion({
    messages: buildMessages(chat.messages),
    mode: chat.mode,
    stream: false,
    memoryContext,
    instruction
  });

  const assistantText = completion.choices?.[0]?.message?.content || "";
  chat.messages.push({
    role: "assistant",
    content: assistantText,
    timestamp: new Date()
  });
  await chat.save();

  return res.json({
    chatId: chat._id,
    message: {
      role: "assistant",
      content: assistantText,
      timestamp: new Date()
    }
  });
};

export const renameChat = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const chat = await getChatOr404(req.params.id, req.user.id, res);
  if (!chat) return;

  chat.title = req.body.title.trim();
  await chat.save();

  return res.json({ message: "Chat title updated", chat });
};

export const getHistory = async (req, res) => {
  const chats = await Chat.find({ userId: req.user.id })
    .sort({ updatedAt: -1 })
    .select("title mode isBookmarked updatedAt createdAt messages");

  return res.json(chats);
};

export const searchChats = async (req, res) => {
  const query = sanitizeText(req.query.q || "");
  if (!query) {
    return res.json([]);
  }

  const regex = new RegExp(query, "i");
  const chats = await Chat.find({
    userId: req.user.id,
    $or: [{ title: regex }, { "messages.content": regex }]
  })
    .sort({ updatedAt: -1 })
    .select("title mode isBookmarked updatedAt createdAt messages");

  return res.json(chats);
};

export const getChatById = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.id });
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }
  return res.json(chat);
};

export const deleteChat = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const deleted = await Chat.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!deleted) {
    return res.status(404).json({ message: "Chat not found" });
  }

  return res.json({ message: "Chat deleted" });
};

export const clearChats = async (req, res) => {
  await Chat.deleteMany({ userId: req.user.id });
  return res.json({ message: "All chats cleared" });
};

export const setBookmark = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.id, userId: req.user.id });
  if (!chat) return res.status(404).json({ message: "Chat not found" });
  chat.isBookmarked = Boolean(req.body?.isBookmarked);
  await chat.save();
  return res.json({ chat });
};

export const editMessageAndRegenerate = async (req, res) => {
  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) return res.status(404).json({ message: "Chat not found" });

  const messageIndex = chat.messages.findIndex((m) => m._id?.toString() === req.params.messageId && m.role === "user");
  if (messageIndex === -1) {
    return res.status(404).json({ message: "Editable user message not found" });
  }

  const updatedContent = sanitizeText(req.body.content || "");
  chat.messages[messageIndex].content = updatedContent;
  chat.messages[messageIndex].timestamp = new Date();

  chat.messages = chat.messages.slice(0, messageIndex + 1);
  chat.title = autoTitle(chat.messages[0]?.content || "New Chat");

  const memoryContext = await getMemoryContext(req.user.id);
  const user = await User.findById(req.user.id).select("responseStyle responseLength");
  const instruction = [styleInstructions[user?.responseStyle || "friendly"], lengthInstructions[user?.responseLength || "normal"]]
    .filter(Boolean)
    .join(" ");

  const completion = await createCompletion({
    messages: buildMessages(chat.messages),
    mode: chat.mode,
    stream: false,
    memoryContext,
    instruction
  });

  const assistantText = completion.choices?.[0]?.message?.content || "No response generated.";
  chat.messages.push({
    role: "assistant",
    content: assistantText,
    timestamp: new Date()
  });
  await chat.save();

  return res.json({ chatId: chat._id, chat });
};

const buildTranscript = (chat) => {
  const lines = [`# ${chat.title || "Arithmo Chat"}`, ""];
  for (const msg of chat.messages || []) {
    lines.push(`## ${msg.role === "user" ? "User" : "Arithmo"} (${new Date(msg.timestamp).toLocaleString()})`);
    lines.push(msg.content || "");
    lines.push("");
  }
  return lines.join("\n");
};

const buildPdf = (chat, transcript) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(chat.title || "Arithmo Chat");
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor("#4b5563").text(`Exported: ${new Date().toLocaleString()}`);
    doc.moveDown();
    const html = md.render(transcript);
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    doc.fillColor("#111827").fontSize(11).text(text);
    doc.end();
  });

export const exportChat = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user.id });
  if (!chat) {
    return res.status(404).json({ message: "Chat not found" });
  }

  const format = (req.query.format || "md").toString().toLowerCase();
  const transcript = buildTranscript(chat);
  const fileBase = (chat.title || "arithmo-chat").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();

  if (format === "txt") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.txt"`);
    return res.send(transcript);
  }

  if (format === "pdf") {
    const buffer = await buildPdf(chat, transcript);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.pdf"`);
    return res.send(buffer);
  }

  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileBase}.md"`);
  return res.send(transcript);
};
