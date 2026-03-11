import Memory from "../models/Memory.js";

const patterns = [
  {
    regex: /i\s+am\s+learning\s+([a-zA-Z0-9+#.\- ]{2,40})/i,
    key: "learning_language"
  },
  {
    regex: /my\s+preferred\s+programming\s+language\s+is\s+([a-zA-Z0-9+#.\- ]{2,40})/i,
    key: "preferred_programming_language"
  },
  {
    regex: /i\s+am\s+interested\s+in\s+([a-zA-Z0-9,\- ]{3,80})/i,
    key: "study_interests"
  },
  {
    regex: /my\s+favorite\s+topic\s+is\s+([a-zA-Z0-9,\- ]{3,80})/i,
    key: "favorite_topics"
  },
  {
    regex: /please\s+always\s+([^.\n!]{3,120})/i,
    key: "personal_instruction"
  }
];

export const extractMemoriesFromText = (text = "") => {
  const matches = [];

  for (const rule of patterns) {
    const match = text.match(rule.regex);
    if (match?.[1]) {
      matches.push({ memoryKey: rule.key, memoryValue: match[1].trim() });
    }
  }

  return matches;
};

export const saveMemories = async ({ userId, memories }) => {
  if (!memories?.length) return;

  await Promise.all(
    memories.map((memory) =>
      Memory.findOneAndUpdate(
        { userId, memoryKey: memory.memoryKey },
        { memoryValue: memory.memoryValue },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );
};

export const getMemoryContext = async (userId) => {
  const memories = await Memory.find({ userId }).sort({ updatedAt: -1 }).limit(20);
  if (!memories.length) return "";

  const lines = memories.map((m) => `- ${m.memoryKey}: ${m.memoryValue}`);
  return `Known user memory:\n${lines.join("\n")}`;
};
