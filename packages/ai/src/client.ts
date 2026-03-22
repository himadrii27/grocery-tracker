import { GoogleGenerativeAI } from "@google/generative-ai";

const globalForGemini = globalThis as unknown as {
  gemini: GoogleGenerativeAI | undefined;
};

export const gemini =
  globalForGemini.gemini ??
  new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

if (process.env.NODE_ENV !== "production") {
  globalForGemini.gemini = gemini;
}

// gemini-2.5-flash: fast + capable, latest stable model
export const AI_MODEL = "gemini-2.5-flash" as const;
