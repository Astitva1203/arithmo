import { validationResult } from "express-validator";
import PinnedMessage from "../models/PinnedMessage.js";
import { sanitizeText } from "../utils/sanitize.js";

export const listPinnedMessages = async (req, res) => {
  const pins = await PinnedMessage.find({ userId: req.user.id }).sort({ createdAt: -1 });
  return res.json(pins);
};

export const pinMessage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const pin = await PinnedMessage.findOneAndUpdate(
    { userId: req.user.id, messageId: req.body.messageId },
    {
      chatId: req.body.chatId,
      content: sanitizeText(req.body.content || ""),
      messageId: req.body.messageId
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.status(201).json(pin);
};

export const unpinMessage = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const deleted = await PinnedMessage.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!deleted) return res.status(404).json({ message: "Pinned message not found" });
  return res.json({ message: "Unpinned" });
};
