import { validationResult } from "express-validator";
import { createCompletion } from "../services/groqService.js";
import { formatSearchContext, runWebSearch } from "../services/searchService.js";
import { sanitizeText } from "../utils/sanitize.js";

export const searchWithAI = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const query = sanitizeText(req.body.query || "");
  const mode = req.body.mode || "general";
  const results = await runWebSearch(query);
  const webContext = formatSearchContext(query, results);

  const completion = await createCompletion({
    mode,
    webContext,
    messages: [
      {
        role: "user",
        content: `Use web search results to answer this request:\n${query}`
      }
    ],
    instruction:
      "Provide a concise answer and include source references in plain language, then add a short 'Sources' list."
  });

  const answer = completion.choices?.[0]?.message?.content || "No web-assisted response generated.";
  return res.json({ query, answer, results });
};
