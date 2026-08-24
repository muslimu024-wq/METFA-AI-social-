import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support base64 image and attachment payloads up to 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Helper to initialize Gemini API client with required User-Agent
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the server environment. Please configure your API key in Settings > Secrets.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  };

  // Helper: execute promise with timeout (rejects with TimeoutError if exceeded)
  function withTimeout<T>(promise: Promise<T>, ms: number, modelName: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Request to model "${modelName}" timed out after ${ms}ms.`);
        (err as any).name = 'TimeoutError';
        (err as any).code = 'ETIMEDOUT';
        (err as any).status = 503;
        reject(err);
      }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timer);
    });
  }

  // Helper: checks if error is retryable (503 UNAVAILABLE, Timeout, Overloaded, Network)
  function isRetryableError(err: any): boolean {
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    const status = err.status || err.statusCode || err.code;

    if (status === 503 || status === '503' || status === 'UNAVAILABLE' || status === 'ETIMEDOUT') return true;
    if (err.name === 'TimeoutError') return true;
    if (
      msg.includes('503') ||
      msg.includes('unavailable') ||
      msg.includes('overloaded') ||
      msg.includes('timed out') ||
      msg.includes('timeout') ||
      msg.includes('high demand') ||
      msg.includes('resource exhausted') ||
      msg.includes('fetch failed') ||
      msg.includes('econnreset')
    ) {
      return true;
    }
    return false;
  }

  // Core execution engine with 8s timeout, 503 handling, and fallback models
  async function generateContentWithFallback(
    ai: GoogleGenAI,
    options: {
      models: string[];
      timeoutMs?: number;
      contents: any;
      config?: any;
    }
  ) {
    const timeoutMs = options.timeoutMs ?? 8000; // 8 seconds default
    const errors: Array<{ model: string; error: string; code?: string; durationMs: number }> = [];

    for (let i = 0; i < options.models.length; i++) {
      const model = options.models[i];
      const isLast = i === options.models.length - 1;
      const startTime = Date.now();

      try {
        console.log(`[Gemini API] Invoking primary/fallback model "${model}" (attempt ${i + 1}/${options.models.length}, timeout ${timeoutMs}ms)...`);
        
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          }),
          timeoutMs,
          model
        );

        const latencyMs = Date.now() - startTime;
        console.log(`[Gemini API] Successfully generated with "${model}" in ${latencyMs}ms (fallback used: ${i > 0})`);

        return {
          response,
          modelUsed: model,
          isFallback: i > 0,
          attemptNumber: i + 1,
          latencyMs,
        };
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        const errMsg = err?.message || String(err);
        const errCode = err?.code || (err?.name === 'TimeoutError' ? 'TIMEOUT_8S' : (err?.status || '503'));
        
        console.warn(`[Gemini API] Model "${model}" failed after ${durationMs}ms (Error: ${errMsg})`);
        errors.push({
          model,
          error: errMsg,
          code: String(errCode),
          durationMs,
        });

        if (isLast) {
          console.error(`[Gemini API] All fallback models exhausted for request.`);
          const combinedError = new Error(
            `AI service is currently busy or experiencing high latency after trying ${options.models.length} model(s). ${errMsg}`
          );
          (combinedError as any).allErrors = errors;
          (combinedError as any).status = 503;
          throw combinedError;
        }

        const nextModel = options.models[i + 1];
        console.log(`[Gemini API] Automatically switching to fallback model "${nextModel}"...`);
      }
    }

    throw new Error("Failed to generate response after all retry attempts.");
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Metfa AI", defaultModel: "gemini-2.5-flash" });
  });

  // 1. Multimodal Chat / Vision / Code Debugging & Scene Inpainting Endpoint
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { prompt, attachments = [], settings = {} } = req.body;
      const ai = getAiClient();

      const hasImageAttachment = Array.isArray(attachments) && attachments.some((a: any) => a.type === 'image' && a.base64);
      const primaryImage = Array.isArray(attachments) ? attachments.find((a: any) => a.type === 'image' && a.base64) : null;
      
      const p = (prompt || '').toLowerCase().trim();
      const isPresetActive = settings?.stylePreset && settings.stylePreset !== 'None' && settings.stylePreset !== '';
      const imageActionKeywords = [
        'transform', 'edit this image', 'change background', 'turn into', 'cyberpunk',
        'anime style', 'hyper-realistic', 'photorealistic', 'make it look like',
        'generate image', 'draw', 'create picture', 'make photo', 'render',
        'ছবি পরিবর্তন', 'ছবি এডিট', 'নতুন ছবি', 'ইমেজ তৈরি', 'পটভূমি পরিবর্তন'
      ];
      const isImageTransformIntent = isPresetActive || imageActionKeywords.some(kw => p.includes(kw));

      // Visual transformation route when user uploaded an image and specified image transformation
      if (isImageTransformIntent && hasImageAttachment && primaryImage) {
        let finalPrompt = (prompt || '').trim() || 'Transform and enhance this scene with artistic cinematic detail.';
        if (settings?.stylePreset && settings.stylePreset !== 'None') {
          finalPrompt = `${finalPrompt}. Style: ${settings.stylePreset}`;
        }

        try {
          const cleanMime = primaryImage.mimeType?.includes('jpeg') || primaryImage.mimeType?.includes('jpg') ? 'image/jpeg' : 'image/png';
          
          // Try image generation models with 8s timeout and fallback
          const imageResult = await generateContentWithFallback(ai, {
            models: ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'],
            timeoutMs: 8000,
            contents: {
              parts: [
                {
                  inlineData: {
                    data: primaryImage.base64,
                    mimeType: cleanMime,
                  },
                },
                {
                  text: finalPrompt,
                },
              ],
            },
          });

          let transformedB64 = '';
          if (imageResult.response.candidates?.[0]?.content?.parts) {
            for (const part of imageResult.response.candidates[0].content.parts) {
              if (part.inlineData?.data) {
                transformedB64 = part.inlineData.data;
                break;
              }
            }
          }

          if (transformedB64) {
            return res.json({
              text: `✨ **Visual Scene Transformation Complete!**\n\nI have transformed your image based on the prompt: \n> *"${finalPrompt}"*\n\nYou can preview the result below, compare with the original, upscale to 4K, or share directly to the Metfa Social Feed.`,
              generatedImageB64: transformedB64,
              isImageGeneration: true,
              modelUsed: imageResult.modelUsed,
              isFallback: imageResult.isFallback,
              latencyMs: imageResult.latencyMs,
            });
          }
        } catch (imgErr: any) {
          console.warn("[Gemini API] Direct image generation models timed out or failed, proceeding with multimodal vision analysis fallback:", imgErr?.message || imgErr);
        }
      }

      // Multimodal Analysis (OCR, Code debugging, Vision Reasoning)
      const parts: any[] = [];
      if (Array.isArray(attachments)) {
        attachments.forEach((att: any) => {
          if (att.base64) {
            const cleanMime = att.mimeType || (att.name?.endsWith('.png') ? 'image/png' : 'image/jpeg');
            parts.push({
              inlineData: {
                data: att.base64,
                mimeType: cleanMime,
              },
            });
          }
        });
      }

      const nonImageFiles = Array.isArray(attachments) ? attachments.filter((a: any) => a.type !== 'image') : [];
      let extraContext = '';
      if (nonImageFiles.length > 0) {
        extraContext = nonImageFiles
          .map((f: any) => `\n[Attached File: ${f.name}]\n${f.previewUrl || ''}\n`)
          .join('\n');
      }

      const userTextPrompt = ((prompt || '').trim() || (attachments?.length > 0 ? "Analyze this uploaded image/screenshot in detail, read all text, identify errors or key elements, and provide a clear step-by-step guide or explanation." : "Hello!")) + extraContext;

      parts.push({ text: userTextPrompt });

      const systemInstruction = `You are Metfa AI Assistant, an advanced multimodal AI and vision intelligence engine built with Gemini.

Your capabilities:
1. Screenshot & UI Analysis: Read and transcribe all text (OCR), detect UI glitches, layout defects, styling inconsistencies, and provide exact actionable fixes.
2. Code & Error Diagnostics: When screenshots of terminal errors, stack traces, IDEs, or code snippets are provided, identify the root cause immediately and provide clear, syntax-highlighted code solutions.
3. Photo & Design Insights: Explain visual composition, artistic aesthetics, color palettes, subjects, and suggestions for photo editing or prompt enhancement.
4. Language Support: Seamlessly communicate in Bengali (বাংলা) or English according to the user's query language or preferences. If the user asks in Bengali, answer in helpful, natural Bengali.
5. Markdown Formatting: Use clean markdown with headers (###), bold highlights, ordered steps (1., 2., 3.), bullet points, and fenced code blocks with language tags (\`\`\`ts, \`\`\`tsx, \`\`\`python, etc.).
6. Speed & Clarity: Provide prompt, high-density, accurate solutions.`;

      // Configure primary model gemini-2.5-flash with automated fallbacks
      const configuredPrimaryModel = settings?.model && settings.model !== 'gemini-3.1-flash-lite-image'
        ? settings.model
        : 'gemini-2.5-flash';

      // Fallback hierarchy: Primary (gemini-2.5-flash) -> gemini-2.5-flash-lite -> gemini-3.1-flash-lite
      const modelFallbackChain = [
        configuredPrimaryModel,
        'gemini-2.5-flash-lite',
        'gemini-3.1-flash-lite',
      ].filter((m, idx, arr) => arr.indexOf(m) === idx);

      const result = await generateContentWithFallback(ai, {
        models: modelFallbackChain,
        timeoutMs: 8000,
        contents: {
          parts,
        },
        config: {
          systemInstruction,
          temperature: typeof settings?.temperature === 'number' ? settings.temperature : 0.7,
        },
      });

      const outputText = result.response.text?.trim() || "I analyzed your request. Please check the details above.";
      return res.json({
        text: outputText,
        isImageGeneration: false,
        modelUsed: result.modelUsed,
        isFallback: result.isFallback,
        latencyMs: result.latencyMs,
      });
    } catch (err: any) {
      console.error("Error in /api/gemini/chat:", err);
      const is503OrTimeout = err?.status === 503 || err?.code === 'ETIMEDOUT' || (err?.message && (err.message.includes('503') || err.message.includes('timed out') || err.message.includes('busy')));
      return res.status(is503OrTimeout ? 503 : 500).json({
        error: {
          message: is503OrTimeout
            ? "The Gemini service is temporarily experiencing high traffic or timed out. Please retry in a moment."
            : (err?.message || "An unexpected error occurred while communicating with Gemini."),
          code: is503OrTimeout ? "SERVICE_UNAVAILABLE_OR_TIMEOUT" : (err?.code || "SERVER_ERROR"),
          status: is503OrTimeout ? 503 : 500,
          allErrors: err?.allErrors,
        },
      });
    }
  });

  // 2. Direct Image Edit / Transformation Endpoint with 8s timeout & fallback
  app.post("/api/gemini/edit-image", async (req, res) => {
    try {
      const { base64Image, mimeType = "image/png", prompt } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: { message: "base64Image is required." } });
      }

      const ai = getAiClient();
      const cleanMime = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'image/jpeg' : 'image/png';
      
      const result = await generateContentWithFallback(ai, {
        models: ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'],
        timeoutMs: 8000,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: cleanMime,
              },
            },
            {
              text: prompt || 'Transform and artistically enhance this image.',
            },
          ],
        },
      });

      if (result.response.candidates?.[0]?.content?.parts) {
        for (const part of result.response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return res.json({
              imageB64: part.inlineData.data,
              modelUsed: result.modelUsed,
              latencyMs: result.latencyMs,
            });
          }
        }
      }

      return res.status(500).json({ error: { message: "No image was returned in the model output." } });
    } catch (err: any) {
      console.error("Error in /api/gemini/edit-image:", err);
      const is503 = err?.status === 503 || err?.code === 'ETIMEDOUT';
      return res.status(is503 ? 503 : 500).json({
        error: {
          message: is503
            ? "Image transformation service timed out (8s) or is busy. Please try again."
            : (err?.message || "Failed to transform image with Gemini."),
          status: is503 ? 503 : 500,
          code: is503 ? "IMAGE_SERVICE_TIMEOUT_503" : "IMAGE_EDIT_FAILED",
        },
      });
    }
  });

  // 3. AI Upscale & Super Resolution Endpoint with 8s timeout & fallback
  app.post("/api/gemini/upscale", async (req, res) => {
    try {
      const { base64Image, mimeType = "image/png" } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: { message: "base64Image is required." } });
      }

      const ai = getAiClient();
      const cleanMime = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'image/jpeg' : 'image/png';

      const result = await generateContentWithFallback(ai, {
        models: ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image'],
        timeoutMs: 8000,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: cleanMime,
              },
            },
            {
              text: 'Perform an advanced AI Super-Resolution and HD Image Upscale on this exact image. Maintain 100% geometric and subject fidelity, color accuracy, lighting balance, and composition while dramatically enhancing fine micro-details, sharpening edges, eliminating compression noise and blur, and refining textures.',
            },
          ],
        },
      });

      if (result.response.candidates?.[0]?.content?.parts) {
        for (const part of result.response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            return res.json({
              imageB64: part.inlineData.data,
              modelUsed: result.modelUsed,
              latencyMs: result.latencyMs,
            });
          }
        }
      }

      return res.status(500).json({ error: { message: "No upscaled image returned." } });
    } catch (err: any) {
      console.error("Error in /api/gemini/upscale:", err);
      const is503 = err?.status === 503 || err?.code === 'ETIMEDOUT';
      return res.status(is503 ? 503 : 500).json({
        error: {
          message: is503
            ? "AI Upscale timed out (8s) or is temporarily busy. Please retry."
            : (err?.message || "Failed to upscale image with Gemini."),
          status: is503 ? 503 : 500,
          code: is503 ? "UPSCALE_TIMEOUT_503" : "UPSCALE_FAILED",
        },
      });
    }
  });

  // 4. Prompt Enhancement Endpoint with gemini-2.5-flash and fallback
  app.post("/api/gemini/enhance-prompt", async (req, res) => {
    try {
      const { prompt } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: { message: "prompt is required." } });
      }

      const ai = getAiClient();
      const result = await generateContentWithFallback(ai, {
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'],
        timeoutMs: 8000,
        contents: [
          {
            text: `You are an expert creative prompt engineer specializing in hyper-realistic, high-fidelity AI image transformations and creative scene editing.
Rewrite and significantly enhance the following image transformation prompt.
Incorporate rich sensory aesthetics, precise lighting (e.g. volumetric, golden hour, cinematic chiaroscuro), camera angle and depth of field, high-definition textural nuances, mood, atmospheric elements, and character details, while preserving the user's core intent and language (if written in Bengali, preserve Bengali with elevated descriptive elegance; if English, output pristine English).
Do NOT include any preamble, conversational greetings, markdown commentary, or quotation marks. Output ONLY the enhanced prompt text directly.

Original prompt:
"""
${prompt}
"""`,
          },
        ],
      });

      const enhancedText = result.response.text?.trim() || prompt;
      return res.json({ enhancedPrompt: enhancedText, modelUsed: result.modelUsed });
    } catch (err: any) {
      console.error("Error in /api/gemini/enhance-prompt:", err);
      // Graceful fallback to original prompt on error
      return res.json({
        enhancedPrompt: req.body?.prompt || "Cinematic high-detail visual transformation",
        fallback: true,
      });
    }
  });

  // 5. Social Media Caption & Hashtags Generator with gemini-2.5-flash and fallback
  app.post("/api/gemini/social-caption", async (req, res) => {
    try {
      const { imagePrompt } = req.body;
      const ai = getAiClient();

      const result = await generateContentWithFallback(ai, {
        models: ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
        timeoutMs: 8000,
        contents: [
          {
            text: `Image Prompt Description: "${imagePrompt || 'Creative AI Art'}"`,
          },
        ],
        config: {
          systemInstruction:
            'You are the AI Assistant for Metfa. Generate a concise, engaging social media caption (1-2 sentences) matching the mood of the provided image prompt. Include 3-5 relevant trending hashtags at the end. Output ONLY the caption and hashtags without quotes.',
        },
      });

      const captionText = result.response.text?.trim() || "Transformed scene with Metfa AI Studio. ✨ #MetfaAI #AIArtwork #DigitalArt #GenerativeArt";
      return res.json({ caption: captionText, modelUsed: result.modelUsed });
    } catch (err: any) {
      console.error("Error in /api/gemini/social-caption:", err);
      return res.json({ caption: "Transformed scene with Metfa AI Studio. ✨ #MetfaAI #AIArtwork #DigitalArt #GenerativeArt" });
    }
  });

  // Vite middleware for development vs Static file serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Metfa AI Server running on http://0.0.0.0:${PORT} (Primary model: gemini-2.5-flash)`);
  });
}

startServer();

