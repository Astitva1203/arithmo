import { validationResult } from "express-validator";
import Memory from "../models/Memory.js";

export const listMemories = async (req, res) => {
  const memories = await Memory.find({ userId: req.user.id }).sort({ updatedAt: -1, createdAt: -1 });
  return res.json(memories);
};

export const upsertMemory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const memory = await Memory.findOneAndUpdate(
    { userId: req.user.id, memoryKey: req.body.memoryKey.trim() },
    { memoryValue: req.body.memoryValue.trim() },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return res.status(201).json(memory);
};

export const updateMemory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const memory = await Memory.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    {
      memoryKey: req.body.memoryKey.trim(),
      memoryValue: req.body.memoryValue.trim()
    },
    { new: true }
  );

  if (!memory) {
    return res.status(404).json({ message: "Memory not found" });
  }

  return res.json(memory);
};

export const deleteMemory = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const memory = await Memory.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!memory) {
    return res.status(404).json({ message: "Memory not found" });
  }
  return res.json({ message: "Memory deleted" });
};
