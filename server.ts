import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required.");
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Elfen Lied: Vector Survivor Soundtrack & Engine" });
  });

  // Music Generation API using Lyria
  app.post("/api/generate-music", async (req, res) => {
    try {
      const { prompt, model = "lyria-3-clip-preview" } = req.body;
      const ai = getAi();

      const defaultPrompt =
        "Dark atmospheric melancholic synthwave in the signature style of Desolate Thoughts: slow haunting gothic piano chords, distorted deep 808 reese bassline, ethereal choir ambience, vinyl dust crackle, slow emotional Elfen Lied anime atmosphere, witch house, and dark reverb.";

      const finalPrompt = prompt && prompt.trim().length > 0 ? prompt.trim() : defaultPrompt;
      const selectedModel = model === "lyria-3-pro-preview" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

      const response = await ai.models.generateContentStream({
        model: selectedModel,
        contents: finalPrompt,
      });

      let audioBase64 = "";
      let lyrics = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
          if (part.text && !lyrics) {
            lyrics = part.text;
          }
        }
      }

      if (!audioBase64) {
        return res.status(500).json({ error: "No audio generated from Lyria model." });
      }

      res.json({
        audioBase64,
        mimeType,
        lyrics,
        prompt: finalPrompt,
        model: selectedModel,
      });
    } catch (err: any) {
      console.error("Music generation error:", err);
      res.status(500).json({
        error: err.message || "Failed to generate music track with Gemini Lyria.",
      });
    }
  });

  // Vite middleware in dev or static files in production
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
