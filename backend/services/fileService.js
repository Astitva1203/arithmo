import pdf from "pdf-parse";
import mammoth from "mammoth";

export const extractText = async (file) => {
  if (!file) return "";

  if (file.mimetype === "application/pdf") {
    const parsed = await pdf(file.buffer);
    return parsed.text;
  }

  const isDocx =
    file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.originalname?.toLowerCase().endsWith(".docx");

  if (isDocx) {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return parsed.value;
  }

  return file.buffer.toString("utf-8");
};

export const imageToBase64 = (file) => {
  if (!file) return "";
  return file.buffer.toString("base64");
};
