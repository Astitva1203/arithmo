import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { validationResult } from "express-validator";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import Memory from "../models/Memory.js";
import PinnedMessage from "../models/PinnedMessage.js";
import PromptTemplate from "../models/PromptTemplate.js";
import { sanitizeText } from "../utils/sanitize.js";

const createToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });

const shapeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  createdAt: user.createdAt,
  hasCompletedOnboarding: user.hasCompletedOnboarding,
  responseStyle: user.responseStyle,
  responseLength: user.responseLength,
  legalConsent: user.legalConsent
});

export const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const name = sanitizeText(req.body.name || "");
  const email = sanitizeText(req.body.email || "").toLowerCase();
  const password = req.body.password;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ message: "Email already in use" });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const policyVersion = sanitizeText(req.body.policyVersion || "2026-03-11");
  const acceptedAt = new Date();
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    legalConsent: {
      acceptedTermsAt: acceptedAt,
      acceptedPrivacyAt: acceptedAt,
      ageConfirmed: true,
      policyVersion
    }
  });

  const token = createToken(user._id.toString());

  return res.status(201).json({
    token,
    user: shapeUser(user)
  });
};

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const email = sanitizeText(req.body.email || "").toLowerCase();
  const password = req.body.password;
  const user = await User.findOne({ email });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken(user._id.toString());

  return res.json({
    token,
    user: shapeUser(user)
  });
};

export const getMe = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: shapeUser(user) });
};

export const updatePreferences = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });

  const { responseStyle, responseLength } = req.body;
  if (responseStyle) user.responseStyle = responseStyle;
  if (responseLength) user.responseLength = responseLength;

  await user.save();
  return res.json({ user: shapeUser(user) });
};

export const completeOnboarding = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  user.hasCompletedOnboarding = req.body?.completed !== false;
  await user.save();
  return res.json({ user: shapeUser(user) });
};

export const deleteAccount = async (req, res) => {
  const userId = req.user.id;
  await Promise.all([
    User.findByIdAndDelete(userId),
    Chat.deleteMany({ userId }),
    Memory.deleteMany({ userId }),
    PinnedMessage.deleteMany({ userId }),
    PromptTemplate.deleteMany({ userId })
  ]);

  return res.json({ message: "Account deleted" });
};
