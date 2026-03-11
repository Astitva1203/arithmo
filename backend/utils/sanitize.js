import sanitizeHtml from "sanitize-html";

export const sanitizeText = (value = "") =>
  sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim();
