import Groq from "groq-sdk";

let groqClient = null;

const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing. Add it to backend/.env and restart the backend.");
  }

  if (!groqClient) {
    groqClient = new Groq({ apiKey });
  }

  return groqClient;
};

const modePrompts = {
  general: "You are Arithmo, a helpful and accurate AI assistant.",
  coding: "You are Arithmo Coding Assistant. Give robust, runnable coding help and explain tradeoffs.",
  study: "You are Arithmo Study Helper. Explain concepts clearly with step-by-step reasoning.",
  creative: "You are Arithmo Creative Partner. Be imaginative, vivid, and constructive."
};

export const createCompletion = async ({
  messages,
  mode = "general",
  stream = false,
  memoryContext = "",
  webContext = "",
  instruction = ""
}) => {
  const systemParts = [modePrompts[mode] || modePrompts.general];
  if (memoryContext) systemParts.push(memoryContext);
  if (webContext) {
    systemParts.push(`Use these web results as supporting context. Cite sources as [1], [2], etc.\n${webContext}`);
  }
  if (instruction) systemParts.push(instruction);

  const systemMessage = {
    role: "system",
    content: systemParts.join("\n\n")
  };

  const groq = getGroqClient();

  return groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    messages: [systemMessage, ...messages],
    temperature: 0.6,
    stream
  });
};

export const createVisionCompletion = async ({ prompt, base64Image, mimeType = "image/jpeg" }) => {
  const groq = getGroqClient();

  return groq.chat.completions.create({
    model: process.env.GROQ_VISION_MODEL || "llama-3.2-11b-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt || "Describe this image in detail." },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ]
  });
};
