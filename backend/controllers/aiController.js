import { validationResult } from "express-validator";
import { extractText } from "../services/fileService.js";
import { createCompletion } from "../services/groqService.js";
import Chat from "../models/Chat.js";
import { sanitizeText } from "../utils/sanitize.js";

export const summarizeDocument = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const fileText = await extractText(req.file);
  const prompt = sanitizeText(req.body.text || fileText);
  const mode = req.body.mode || "study";
  const chatId = req.body.chatId;

  if (!prompt || prompt.trim().length < 20) {
    return res.status(400).json({ message: "Provide a text or file with enough content" });
  }

  const completion = await createCompletion({
    mode,
    messages: [
      {
        role: "user",
        content: `Summarize this document in concise bullet points and provide key action items:\n\n${prompt.slice(0, 15000)}`
      }
    ]
  });

  const summary = completion.choices?.[0]?.message?.content || "No summary generated";

  let chat = null;
  if (chatId) {
    chat = await Chat.findOne({ _id: chatId, userId: req.user.id });
  }

  if (!chat) {
    chat = await Chat.create({
      userId: req.user.id,
      mode,
      title: "Document Summary",
      messages: []
    });
  }

  chat.mode = mode;
  chat.messages.push(
    {
      role: "user",
      content: "Please summarize my uploaded document.",
      timestamp: new Date()
    },
    {
      role: "assistant",
      content: summary,
      timestamp: new Date()
    }
  );
  await chat.save();

  return res.json({ summary, chatId: chat._id });
};

export const codeAssist = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const language = sanitizeText(req.body.language || "plaintext");
  const task = req.body.task || "explain";
  const code = (req.body.code || "").trim();

  const instructionByTask = {
    explain: "Explain this code step by step in a clear and concise way.",
    debug: "Find bugs in this code and provide a corrected version with explanations.",
    optimize: "Optimize this code for readability and performance while preserving behavior."
  };

  const completion = await createCompletion({
    mode: "coding",
    messages: [
      {
        role: "user",
        content: `${instructionByTask[task] || instructionByTask.explain}\n\nLanguage: ${language}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``
      }
    ]
  });

  const response = completion.choices?.[0]?.message?.content || "No response generated.";
  return res.json({ response });
};
