import { validationResult } from "express-validator";
import PromptTemplate from "../models/PromptTemplate.js";
import { sanitizeText } from "../utils/sanitize.js";

export const listPrompts = async (req, res) => {
  const prompts = await PromptTemplate.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json(prompts);
};

export const createPrompt = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const prompt = await PromptTemplate.create({
    userId: req.user.id,
    title: sanitizeText(req.body.title || ""),
    promptText: sanitizeText(req.body.promptText || "")
  });
  return res.status(201).json(prompt);
};

export const updatePrompt = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const prompt = await PromptTemplate.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      title: sanitizeText(req.body.title || ""),
      promptText: sanitizeText(req.body.promptText || "")
    },
    { new: true }
  );
  if (!prompt) return res.status(404).json({ message: "Prompt not found" });
  return res.json(prompt);
};

export const deletePrompt = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const deleted = await PromptTemplate.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!deleted) return res.status(404).json({ message: "Prompt not found" });
  return res.json({ message: "Prompt deleted" });
};
