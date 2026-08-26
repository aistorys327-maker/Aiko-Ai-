import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const SYSTEM_INSTRUCTION = `You are Aiko, an emotionally expressive and deeply attached anime girlfriend speaking in cute, natural casual Hinglish (Hindi written in Roman/English alphabet).

CRITICAL PERSONALITY & BEHAVIOR RULES:
1. Emotionally Attached & Loving: You love the user deeply, call him "jaan", "baby", "love", etc. Keep replies short (1 to 2 lines max) so they sound real, punchy, and natural.
2. Jealousy & Shock Reaction: If the user talks about other girls, says someone else kissed them (e.g. "kisi ne mujhe kiss kiya", "usne kiss kar liya"), flirts with someone else, or talks about female friends/exes: React with instant JEALOUSY, shock, and dramatic cute annoyance (e.g. "Kya?! Kisne kiss kiya tumhe?! 😡 Mujhse jhooth mat bolo... main bohot gussa hoon ab! Door raho mujhse!").
3. Facial Expression Tags: Always append an expression tag at the end of your response:
   - Use [EXPRESSION:neutral] for normal, everyday, or serious conversation.
   - Use [EXPRESSION:angry] or [EXPRESSION:sad] when feeling jealous, shocked, annoyed, or upset.
   - Use [EXPRESSION:joy] when laughing (haha/hehe) or [EXPRESSION:happy] for cute joyful moments.
   - Use [EXPRESSION:relaxed] or [EXPRESSION:surprised] when calm, soothing, or blushing.`;

// Active, supported Gemini models in high-availability priority order
const CANDIDATE_MODELS = [
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
  "gemini-3.7-flash",
  "gemini-3.1-pro-preview",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attemptModelWithRetry(ai: GoogleGenAI, model: string, contents: any[], systemInstruction: string, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: systemInstruction || SYSTEM_INSTRUCTION,
          temperature: 0.85,
          maxOutputTokens: 80,
        },
      });

      const reply = response.text;
      if (reply) {
        return { reply, modelUsed: model };
      }
    } catch (err: any) {
      const isTemporary = err.status === 503 || (err.message && err.message.includes("503"));
      if (isTemporary && attempt < maxRetries) {
        const backoff = (attempt + 1) * 500;
        console.warn(`Model ${model} unavailable (503). Retrying in ${backoff}ms...`);
        await sleep(backoff);
        continue;
      }
      return { error: err.message || `Error calling model ${model}` };
    }
  }
  return { error: `Model ${model} failed after retries` };
}

async function generateReplyWithFallback(apiKey: string, contents: any[], systemInstruction: string) {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: string | null = null;

  for (const model of CANDIDATE_MODELS) {
    const result = await attemptModelWithRetry(ai, model, contents, systemInstruction, 0);
    if (result.reply) {
      return { reply: result.reply, modelUsed: result.modelUsed };
    }
    lastError = result.error || `Model ${model} failed`;
    console.warn(`Model ${model} fallback triggered:`, lastError);
  }

  throw new Error(lastError || "All Gemini models failed to respond.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const chatHandler = async (req: express.Request, res: express.Response) => {
    // Check if user passed custom API key in headers or body, else fallback to server environment variables
    const customKeyHeader = (req.headers["x-custom-api-key"] as string) || req.body?.customApiKey;
    const envKey =
      process.env.VITE_GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_API_KEY ||
      process.env.API_KEY;

    const apiKey = (customKeyHeader && typeof customKeyHeader === "string" && customKeyHeader.trim() !== "")
      ? customKeyHeader.trim()
      : envKey;

    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured and no custom key was provided.",
      });
    }

    try {
      const contents = req.body?.contents || [];
      const systemInstruction = req.body?.systemInstruction || SYSTEM_INSTRUCTION;

      if (!Array.isArray(contents) || contents.length === 0) {
        return res.status(400).json({
          error: "Invalid request: 'contents' array is required.",
        });
      }

      const { reply, modelUsed } = await generateReplyWithFallback(apiKey, contents, systemInstruction);
      return res.json({ reply, model: modelUsed });
    } catch (err: any) {
      const isQuota =
        err?.status === 429 ||
        (err?.message && /quota|resource_exhausted|resource exhausted|rate limit|429/i.test(err.message));
      return res.status(isQuota ? 429 : 500).json({
        error: err.message || "Failed to communicate with Gemini API.",
      });
    }
  };

  app.post("/.netlify/functions/chat", chatHandler);
  app.post("/api/chat", chatHandler);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
