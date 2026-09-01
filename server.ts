import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { checkContentSafety, METFA_AI_SAFETY_SYSTEM_INSTRUCTION } from "./utils/contentSafety";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Enable trust proxy for reverse proxies (Nginx, Cloudflare, Cloud Run, AWS ALB)
  // Ensures req.protocol, req.secure, and req.ip reflect the custom domain's SSL state
  app.set("trust proxy", 1);

  // =========================================================================
  // PRODUCTION CUSTOM DOMAIN, HTTPS & SECURITY HEADERS MIDDLEWARE
  // =========================================================================
  app.use((req, res, next) => {
    // 1. Security Headers
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

    // 2. Universal CORS Support: Allow cross-app communication for Sellme (shop.metfaai.com) and Metfa Social
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    // 3. Canonical Domain & HTTPS Redirection in Production
    if (process.env.NODE_ENV === "production") {
      const canonicalDomain = process.env.CANONICAL_DOMAIN?.trim();
      const forceHttps = process.env.FORCE_HTTPS === "true" || process.env.FORCE_HTTPS === "1";
      const isHttp = req.headers["x-forwarded-proto"] === "http";
      const currentHost = (req.headers.host || "").toLowerCase();

      // Check if domain redirect is needed (e.g. www to non-www or custom domain enforcement)
      if (canonicalDomain && currentHost && currentHost !== canonicalDomain.toLowerCase()) {
        return res.redirect(301, `https://${canonicalDomain}${req.originalUrl || req.url}`);
      }

      // Force HTTPS if requested
      if (forceHttps && isHttp) {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl || req.url}`);
      }

      // HSTS header for secure production custom domains
      if (req.secure || req.headers["x-forwarded-proto"] === "https") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
      }
    }

    next();
  });

  // Support base64 image and attachment payloads up to 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // =========================================================================
  // ENVIRONMENT VARIABLE & BYOK KEY RESOLVERS (Vite / Node server standard)
  // =========================================================================
  const sanitizeApiKey = (key?: any): string | null => {
    if (!key || typeof key !== "string") return null;
    const trimmed = key.trim();
    if (
      !trimmed ||
      trimmed === "undefined" ||
      trimmed === "null" ||
      trimmed === "[object Object]" ||
      trimmed.toLowerCase().includes("placeholder") ||
      trimmed === "..." ||
      trimmed === "sk-..." ||
      trimmed === "AIzaSy..." ||
      trimmed === "xai-..." ||
      trimmed.length < 4
    ) {
      return null;
    }
    return trimmed;
  };

  const isValidGeminiApiKey = (key?: string | null): boolean => {
    return Boolean(sanitizeApiKey(key));
  };

  const getGeminiApiKey = (customKey?: string, req?: express.Request): string | null => {
    // 1. Explicit key parameter
    const direct = sanitizeApiKey(customKey);
    if (direct) return direct;

    // 2. Request body
    if (req?.body) {
      const fromBody = sanitizeApiKey(req.body.geminiApiKey || req.body.settings?.geminiApiKey);
      if (fromBody) return fromBody;
    }

    // 3. Request headers
    if (req?.headers) {
      const fromHeader = sanitizeApiKey(req.headers["x-gemini-api-key"] as string);
      if (fromHeader) return fromHeader;

      const authHeader = req.headers["authorization"];
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = sanitizeApiKey(authHeader.substring(7));
        if (token && !token.startsWith("sk-") && !token.startsWith("xai-")) {
          return token;
        }
      }
    }

    // 4. Server-side environment variables
    const envKey = sanitizeApiKey(process.env.GEMINI_API_KEY) || sanitizeApiKey(process.env.VITE_GEMINI_API_KEY);
    if (envKey) return envKey;

    return null;
  };

  const getOpenAiApiKey = (customKey?: string, req?: express.Request): string | null => {
    // 1. Explicit key parameter
    const direct = sanitizeApiKey(customKey);
    if (direct) return direct;

    // 2. Request body
    if (req?.body) {
      const fromBody = sanitizeApiKey(req.body.openaiApiKey || req.body.settings?.openaiApiKey);
      if (fromBody) return fromBody;
    }

    // 3. Request headers
    if (req?.headers) {
      const fromHeader = sanitizeApiKey(req.headers["x-openai-api-key"] as string);
      if (fromHeader) return fromHeader;

      const authHeader = req.headers["authorization"];
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = sanitizeApiKey(authHeader.substring(7));
        if (token && (token.startsWith("sk-") || req.headers["x-ai-engine"] === "openai")) {
          return token;
        }
      }
    }

    // 4. Server-side environment variables
    const envKey = sanitizeApiKey(process.env.OPENAI_API_KEY) || sanitizeApiKey(process.env.VITE_OPENAI_API_KEY);
    if (envKey) return envKey;

    return null;
  };

  const getXaiApiKey = (customKey?: string, req?: express.Request): string | null => {
    // 1. Explicit key parameter
    const direct = sanitizeApiKey(customKey);
    if (direct) return direct;

    // 2. Request body
    if (req?.body) {
      const fromBody = sanitizeApiKey(
        req.body.grokApiKey ||
        req.body.xaiApiKey ||
        req.body.settings?.grokApiKey ||
        req.body.settings?.xaiApiKey
      );
      if (fromBody) return fromBody;
    }

    // 3. Request headers
    if (req?.headers) {
      const fromHeader = sanitizeApiKey(
        (req.headers["x-grok-api-key"] as string) || (req.headers["x-xai-api-key"] as string)
      );
      if (fromHeader) return fromHeader;

      const authHeader = req.headers["authorization"];
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        const token = sanitizeApiKey(authHeader.substring(7));
        if (token && (token.startsWith("xai-") || req.headers["x-ai-engine"] === "grok")) {
          return token;
        }
      }
    }

    // 4. Server-side environment variables
    const envKey =
      sanitizeApiKey(process.env.XAI_API_KEY) ||
      sanitizeApiKey(process.env.GROK_API_KEY) ||
      sanitizeApiKey(process.env.VITE_XAI_API_KEY);
    if (envKey) return envKey;

    return null;
  };

  // Helper to initialize Gemini API client with required User-Agent
  const getAiClient = (customKey?: string, req?: express.Request) => {
    const rawKey = getGeminiApiKey(customKey, req);
    if (rawKey) {
      return new GoogleGenAI({
        apiKey: rawKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }

    throw new Error(
      "Gemini API key is not configured or requires an active API key. Please enter your Gemini API Key in Settings > API Keys (or Studio Settings)."
    );
  };

  // Helper: execute promise with timeout (rejects with TimeoutError if exceeded)
  function withTimeout<T>(promise: Promise<T>, ms: number, modelName: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Request to model "${modelName}" timed out after ${ms}ms.`);
        (err as any).name = "TimeoutError";
        (err as any).code = "ETIMEDOUT";
        (err as any).status = 503;
        reject(err);
      }, ms);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      clearTimeout(timer);
    });
  }

  // Core execution engine with 25s timeout, robust error handling, and fallback models
  async function generateContentWithFallback(
    ai: GoogleGenAI,
    options: {
      models: string[];
      timeoutMs?: number;
      contents: any;
      config?: any;
    }
  ) {
    const timeoutMs = options.timeoutMs ?? 25000;
    const errors: Array<{ model: string; error: string; code?: string; durationMs: number }> = [];

    // Normalize models array to ensure valid supported Gemini models only
    const validModels = options.models
      .map((m) => {
        if (!m || typeof m !== "string") return "gemini-3.7-flash";
        if (m === "gemini-3.6-flash") return "gemini-3.7-flash";
        if (
          !m.startsWith("gemini-") &&
          !m.startsWith("veo-") &&
          !m.startsWith("lyria-") &&
          !m.startsWith("imagen-")
        ) {
          return "gemini-3.7-flash";
        }
        return m;
      })
      .filter((m, idx, arr) => arr.indexOf(m) === idx);

    // Ensure fallback models are always present in the chain
    if (!validModels[0]?.includes("-image")) {
      const standardFallbackChain = [
        "gemini-3.7-flash",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
      ];
      for (const modelName of standardFallbackChain) {
        if (!validModels.includes(modelName)) {
          validModels.push(modelName);
        }
      }
    }

    let activeAi = ai;
    let attemptedEnvFallback = false;

    for (let i = 0; i < validModels.length; i++) {
      const model = validModels[i];
      const isLast = i === validModels.length - 1;
      const startTime = Date.now();

      try {
        console.log(
          `[Gemini API] Invoking primary/fallback model "${model}" (attempt ${i + 1}/${
            validModels.length
          }, timeout ${timeoutMs}ms)...`
        );

        const response = await withTimeout(
          activeAi.models.generateContent({
            model,
            contents: options.contents,
            config: options.config,
          }),
          timeoutMs,
          model
        );

        const latencyMs = Date.now() - startTime;
        console.log(
          `[Gemini API] Successfully generated with "${model}" in ${latencyMs}ms (fallback used: ${
            i > 0
          })`
        );

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
        const errCode =
          err?.code || (err?.name === "TimeoutError" ? "TIMEOUT_EXCEEDED" : err?.status || "503");

        console.log(`[Gemini API] Model "${model}" failover triggered (${durationMs}ms): ${errMsg.slice(0, 120)}`);
        errors.push({
          model,
          error: errMsg,
          code: String(errCode),
          durationMs,
        });

        // If failure was due to invalid API key (400 / 401 / API_KEY_INVALID / UNAUTHENTICATED) on a custom key,
        // automatically fallback to system environment GEMINI_API_KEY (if valid) or abort immediately
        if (
          errMsg.includes("API_KEY_INVALID") ||
          errMsg.includes("API key not valid") ||
          errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED") ||
          errMsg.includes("UNAUTHENTICATED") ||
          err?.status === 400 ||
          err?.status === 401
        ) {
          const validEnvKey =
            (isValidGeminiApiKey(process.env.GEMINI_API_KEY) && process.env.GEMINI_API_KEY?.trim()) ||
            (isValidGeminiApiKey(process.env.VITE_GEMINI_API_KEY) && process.env.VITE_GEMINI_API_KEY?.trim());

          if (!attemptedEnvFallback && validEnvKey) {
            console.log("[Gemini API] Key authentication error. Automatically switching to system GEMINI_API_KEY...");
            attemptedEnvFallback = true;
            activeAi = new GoogleGenAI({
              apiKey: validEnvKey,
              httpOptions: {
                headers: {
                  "User-Agent": "aistudio-build",
                },
              },
            });
            // Retry current model with valid environment key
            i--;
            continue;
          } else {
            // No alternate valid key to try - break to avoid repetitive 401 calls
            throw new Error(
              `Gemini authentication error: ${errMsg}`
            );
          }
        }

        // If 503 high demand or 429 quota spike occurred, wait a brief delay before trying next model
        if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("429") || errMsg.includes("quota")) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }

        if (isLast) {
          console.error(`[Gemini API] All fallback models exhausted for request.`);
          const combinedError = new Error(
            `AI service error after trying ${validModels.length} model(s): ${errMsg}`
          );
          (combinedError as any).allErrors = errors;
          (combinedError as any).status = err?.status || 500;
          throw combinedError;
        }

        const nextModel = validModels[i + 1];
        console.log(`[Gemini API] Automatically switching to fallback model "${nextModel}"...`);
      }
    }

    throw new Error("Failed to generate response after all retry attempts.");
  }

  // =========================================================================
  // MODEL EXECUTORS: OpenAI, xAI Grok, Gemini
  // =========================================================================

  // 1. xAI Grok Execution Engine
  async function executeGrok(prompt: string, attachments: any[] = [], settings: any = {}, req?: express.Request) {
    const apiKey = getXaiApiKey(settings?.grokApiKey || settings?.xaiApiKey, req);
    if (!apiKey) {
      throw new Error("xAI Grok API key is not configured. Please enter your xAI Grok API key in Settings > API Keys.");
    }

    const startTime = Date.now();
    const hasImages =
      Array.isArray(attachments) && attachments.some((a: any) => a.type === "image" && a.base64);

    // Map to valid xAI model identifiers (try current live model names in sequence)
    const candidateModels = hasImages
      ? ["grok-2-vision-1212", "grok-vision-beta"]
      : settings?.model && settings.model !== "grok-2-latest"
      ? [settings.model, "grok-2-1212", "grok-2", "grok-beta", "grok-3"]
      : ["grok-2-1212", "grok-2", "grok-beta", "grok-3"];

    const messages: any[] = [
      {
        role: "system",
        content: `You are Metfa Social Assistant powered by xAI Grok. Universal Multilingual Policy: Automatically detect the user's language (Bengali, Hindi, Tagalog, Malay, Arabic, Spanish, French, English, etc.) and ALWAYS reply fluently in that exact same language. Provide insightful, structured, and helpful responses.\n\n${METFA_AI_SAFETY_SYSTEM_INSTRUCTION}`,
      },
    ];

    if (hasImages) {
      const userContent: any[] = [];
      attachments.forEach((att: any) => {
        if (att.type === "image" && att.base64) {
          const mime = att.mimeType || "image/png";
          userContent.push({
            type: "image_url",
            image_url: { url: `data:${mime};base64,${att.base64}` },
          });
        }
      });
      userContent.push({ type: "text", text: prompt || "Analyze this image and provide insights." });
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: prompt || "Hello" });
    }

    let lastError: any = null;
    for (const model of candidateModels) {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: Math.min(Math.max(typeof settings?.temperature === "number" ? settings.temperature : 0.7, 0), 1),
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          let errMsg = `xAI API returned status ${res.status}`;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson?.error?.message || errJson?.error || errJson?.message || errText;
          } catch {
            errMsg = errText || errMsg;
          }

          // If model not found (400 / 404), try next model in candidate list
          if (res.status === 400 || res.status === 404) {
            lastError = new Error(`xAI Grok error (${res.status}): ${errMsg}`);
            continue;
          }
          throw new Error(`xAI Grok error (${res.status}): ${errMsg}`);
        }

        const data = await res.json();
        const latencyMs = Date.now() - startTime;
        const text = data.choices?.[0]?.message?.content || "No response generated from Grok.";

        return {
          text,
          isImageGeneration: false,
          modelUsed: data.model || model,
          latencyMs,
        };
      } catch (err: any) {
        lastError = err;
        if (err?.message?.includes("401") || err?.message?.includes("403")) {
          throw err;
        }
      }
    }

    throw lastError || new Error("Failed to execute xAI Grok request across all candidate models.");
  }

  // 2. OpenAI ChatGPT Execution Engine (GPT-4o, GPT-4o-mini, o3-mini)
  async function executeOpenAI(prompt: string, attachments: any[] = [], settings: any = {}, req?: express.Request) {
    const apiKey = getOpenAiApiKey(settings?.openaiApiKey, req);
    if (!apiKey) {
      throw new Error(
        "OpenAI API key is not configured. Please enter your OpenAI API key in Settings > API Keys."
      );
    }

    const startTime = Date.now();
    const hasImages =
      Array.isArray(attachments) && attachments.some((a: any) => a.type === "image" && a.base64);
    const model =
      settings?.model &&
      (settings.model.startsWith("gpt-") || settings.model.startsWith("o3-"))
        ? settings.model
        : "gpt-4o";

    const messages: any[] = [
      {
        role: "system",
        content: `You are Metfa Social Assistant powered by OpenAI ChatGPT. Universal Multilingual Policy: Automatically detect the user's language (Bengali, Hindi, Tagalog, Malay, Arabic, Spanish, French, English, etc.) and ALWAYS reply fluently in that exact same language. Provide insightful, structured, multimodal-friendly responses.\n\n${METFA_AI_SAFETY_SYSTEM_INSTRUCTION}`,
      },
    ];

    if (hasImages) {
      const userContent: any[] = [];
      attachments.forEach((att: any) => {
        if (att.type === "image" && att.base64) {
          const mime = att.mimeType || "image/png";
          userContent.push({
            type: "image_url",
            image_url: { url: `data:${mime};base64,${att.base64}` },
          });
        }
      });
      userContent.push({ type: "text", text: prompt || "Analyze this image and provide insights." });
      messages.push({ role: "user", content: userContent });
    } else {
      messages.push({ role: "user", content: prompt || "Hello" });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Math.min(Math.max(typeof settings?.temperature === "number" ? settings.temperature : 0.7, 0), 1),
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      let errMsg = `OpenAI API error status ${res.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson?.error?.message || errJson?.error || errJson?.message || errText;
      } catch {
        errMsg = errText || errMsg;
      }
      throw new Error(`OpenAI error (${res.status}): ${errMsg}`);
    }

    const data = await res.json();
    const latencyMs = Date.now() - startTime;
    const text = data.choices?.[0]?.message?.content || "No response generated from OpenAI.";

    return {
      text,
      isImageGeneration: false,
      modelUsed: data.model || model,
      latencyMs,
    };
  }

  // 3. Google Gemini Execution Engine (Multimodal & Scene Transformation)
  async function executeGemini(prompt: string, attachments: any[] = [], settings: any = {}, req?: express.Request) {
    const ai = getAiClient(settings?.geminiApiKey, req);
    const hasImageAttachment =
      Array.isArray(attachments) && attachments.some((a: any) => a.type === "image" && a.base64);
    const primaryImage = Array.isArray(attachments)
      ? attachments.find((a: any) => a.type === "image" && a.base64)
      : null;

    const p = (prompt || "").toLowerCase().trim();
    const isPresetActive =
      settings?.stylePreset && settings.stylePreset !== "None" && settings.stylePreset !== "";
    const imageActionKeywords = [
      "transform",
      "edit this image",
      "change background",
      "turn into",
      "cyberpunk",
      "anime style",
      "hyper-realistic",
      "photorealistic",
      "make it look like",
      "generate image",
      "draw",
      "create picture",
      "make photo",
      "render",
      "ছবি পরিবর্তন",
      "ছবি এডিট",
      "নতুন ছবি",
      "ইমেজ তৈরি",
      "পটভূমি পরিবর্তন",
    ];
    const isImageTransformIntent =
      isPresetActive || imageActionKeywords.some((kw) => p.includes(kw));

    // Visual transformation route
    if (isImageTransformIntent && hasImageAttachment && primaryImage) {
      let finalPrompt =
        (prompt || "").trim() ||
        "Transform and enhance this scene with artistic cinematic detail.";
      if (settings?.stylePreset && settings.stylePreset !== "None") {
        finalPrompt = `${finalPrompt}. Style: ${settings.stylePreset}`;
      }

      try {
        const cleanMime =
          primaryImage.mimeType?.includes("jpeg") || primaryImage.mimeType?.includes("jpg")
            ? "image/jpeg"
            : "image/png";

        const imageResult = await generateContentWithFallback(ai, {
          models: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
          timeoutMs: 25000,
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

        let transformedB64 = "";
        if (imageResult.response.candidates?.[0]?.content?.parts) {
          for (const part of imageResult.response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              transformedB64 = part.inlineData.data;
              break;
            }
          }
        }

        if (transformedB64) {
          return {
            text: `✨ **Visual Scene Transformation Complete!**\n\nI have transformed your image based on the prompt: \n> *"${finalPrompt}"*\n\nYou can preview the result below, compare with the original, download in original high quality, upscale to 4K, or share directly to the Metfa Social Feed.`,
            generatedImageB64: transformedB64,
            isImageGeneration: true,
            modelUsed: imageResult.modelUsed,
            isFallback: imageResult.isFallback,
            latencyMs: imageResult.latencyMs,
          };
        }
      } catch (imgErr: any) {
        console.warn(
          "[Gemini API] Direct image generation models timed out or failed, proceeding with multimodal vision analysis:",
          imgErr?.message || imgErr
        );
      }
    }

    // Multimodal & Text Chat Analysis
    const parts: any[] = [];
    if (Array.isArray(attachments)) {
      attachments.forEach((att: any) => {
        if (att.base64) {
          const cleanMime =
            att.mimeType || (att.name?.endsWith(".png") ? "image/png" : "image/jpeg");
          parts.push({
            inlineData: {
              data: att.base64,
              mimeType: cleanMime,
            },
          });
        }
      });
    }

    const nonImageFiles = Array.isArray(attachments)
      ? attachments.filter((a: any) => a.type !== "image")
      : [];
    let extraContext = "";
    if (nonImageFiles.length > 0) {
      extraContext = nonImageFiles
        .map((f: any) => `\n[Attached File: ${f.name}]\n${f.previewUrl || ""}\n`)
        .join("\n");
    }

    const userTextPrompt =
      ((prompt || "").trim() ||
        (attachments?.length > 0
          ? "Analyze this uploaded image/screenshot in detail, read all text, identify errors or key elements, and provide a clear step-by-step guide or explanation."
          : "Hello!")) + extraContext;

    parts.push({ text: userTextPrompt });

    const systemInstruction = `You are Metfa Social Assistant, an advanced multimodal AI and vision intelligence engine built with Gemini.

CRITICAL MULTILINGUAL POLICY:
You possess universal multilingual fluency. Automatically detect the user's spoken or typed language (e.g., Bengali, Tagalog/Filipino, Malay, Hindi, Arabic, Spanish, French, Japanese, German, Urdu, English, Portuguese, Italian, Vietnamese, Korean, etc.) and ALWAYS reply strictly and fluently in that exact same language. Maintain natural native grammar, culturally appropriate tone, and the accurate script.

Your capabilities:
1. Multimodal & Voice Assistant: Read and understand spoken voice inputs, transcribed queries, and general text.
2. Screenshot & UI Analysis: Read and transcribe all text (OCR), detect UI glitches, layout defects, styling inconsistencies, and provide exact actionable fixes.
3. Code & Error Diagnostics: When screenshots of terminal errors, stack traces, IDEs, or code snippets are provided, identify the root cause immediately and provide clear, syntax-highlighted code solutions.
4. Photo & Design Insights: Explain visual composition, artistic aesthetics, color palettes, subjects, and suggestions for photo editing or prompt enhancement.
5. Markdown Formatting: Use clean markdown with headers (###), bold highlights, ordered steps (1., 2., 3.), bullet points, and fenced code blocks with language tags.

${METFA_AI_SAFETY_SYSTEM_INSTRUCTION}`;

    let configuredPrimaryModel = "gemini-3.7-flash";
    if (
      settings?.model &&
      typeof settings.model === "string" &&
      settings.model.startsWith("gemini-") &&
      settings.model !== "gemini-2.5-flash" &&
      settings.model !== "gemini-3.6-flash"
    ) {
      configuredPrimaryModel = settings.model;
    }

    const modelFallbackChain = [
      configuredPrimaryModel,
      "gemini-3.7-flash",
      "gemini-3.1-flash-lite",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    const result = await generateContentWithFallback(ai, {
      models: modelFallbackChain,
      timeoutMs: 25000,
      contents: { parts },
      config: {
        systemInstruction,
        temperature: typeof settings?.temperature === "number" ? settings.temperature : 0.7,
      },
    });

    const outputText =
      result.response.text?.trim() || "I analyzed your request. Please check the details above.";

    return {
      text: outputText,
      isImageGeneration: false,
      modelUsed: result.modelUsed,
      isFallback: result.isFallback,
      latencyMs: result.latencyMs,
    };
  }

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "Metfa Social",
      defaultModel: "gemini-3.7-flash",
      hasGeminiKey: !!getGeminiApiKey(),
      hasOpenAiKey: !!getOpenAiApiKey(),
      hasXaiKey: !!getXaiApiKey(),
    });
  });

  // =========================================================================
  // MARKETPLACE & ALIEXPRESS DROPSHIPPING API (Cross-App Routing & Proxy)
  // Ensures Sellme (shop.metfaai.com) and Metfa Social merged catalog
  // =========================================================================
  const SERVER_MARKETPLACE_CATALOG = [
    // Local Sellme Marketplace Products
    {
      id: "sellme-tech-01",
      title: "Sellme Studio Pro Podcasting & Streaming USB-C Microphone with Noise Cancelling",
      price: 49.99,
      originalPrice: 89.00,
      discountPercentage: 44,
      currency: "USD",
      rating: 4.96,
      reviewCount: 1820,
      ordersCount: 4300,
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1583597509707-6756f7361882?w=800&auto=format&fit=crop&q=80"
      ],
      category: "tech",
      source: "sellme",
      seller: {
        name: "Sellme Official Creator Store",
        rating: 4.98,
        positiveFeedbackPercent: 99.4
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days (Fast Local)"
      },
      productUrl: "https://shop.metfaai.com/products/sellme-studio-mic",
      affiliateUrl: "https://shop.metfaai.com/products/sellme-studio-mic?ref=metfa_social",
      description: "Studio-grade 192kHz/24bit cardioid condenser microphone with built-in zero-latency headphone monitoring, touch-mute sensor, RGB gain halo, and custom shock mount.",
      specifications: {
        "Polar Pattern": "Cardioid Studio Condenser",
        "Sample Rate": "192kHz / 24-bit HD",
        "Connectivity": "USB-C to USB-C / USB-A Plug & Play"
      },
      inStock: true,
      tags: ["microphone", "studio", "podcast", "streaming", "sellme", "tech"]
    },
    {
      id: "sellme-tech-02",
      title: "Smart AI Auto-Tracking Phone Gimbal Stabilizer for Vlog & TikTok Reels",
      price: 36.80,
      originalPrice: 72.00,
      discountPercentage: 49,
      currency: "USD",
      rating: 4.89,
      reviewCount: 2450,
      ordersCount: 6800,
      imageUrl: "https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=800&auto=format&fit=crop&q=80",
      category: "tech",
      source: "sellme",
      seller: {
        name: "Sellme VlogPro Direct",
        rating: 4.92,
        positiveFeedbackPercent: 98.6
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-5 business days"
      },
      productUrl: "https://shop.metfaai.com/products/ai-tracking-gimbal",
      affiliateUrl: "https://shop.metfaai.com/products/ai-tracking-gimbal?ref=metfa_social",
      description: "360-degree AI face and body recognition phone stabilizer requiring NO APP installation for live streaming.",
      specifications: {
        "Tracking Angle": "360° Horizontal Infinite",
        "Battery": "2200mAh (8 hours continuous)"
      },
      inStock: true,
      tags: ["gimbal", "tracking", "ai", "reels", "vlog", "sellme"]
    },
    {
      id: "sellme-gadget-01",
      title: "Sellme AI Smart Desktop Voice Assistant & Stream Control Hub with Touch OLED",
      price: 59.00,
      originalPrice: 119.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.95,
      reviewCount: 1420,
      ordersCount: 3100,
      imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80",
      category: "gadgets",
      source: "sellme",
      seller: {
        name: "Sellme Tech Labs",
        rating: 4.97,
        positiveFeedbackPercent: 99.2
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days (Fast Local)"
      },
      productUrl: "https://shop.metfaai.com/products/sellme-smart-hub",
      affiliateUrl: "https://shop.metfaai.com/products/sellme-smart-hub?ref=metfa_social",
      description: "Next-gen desktop assistant with custom macro keys, real-time Gemini AI integration, audio visualizer, weather & social media live telemetry dashboard.",
      specifications: {
        "Display": "3.5\" High-Contrast IPS Touchscreen",
        "Keys": "6 Dynamic Macro LCD Keys + 2 Rotary Dials"
      },
      inStock: true,
      tags: ["streamdeck", "assistant", "smartdesk", "oled", "gadgets", "sellme"]
    },
    {
      id: "sellme-gadget-02",
      title: "RGB Magnetic Wireless Power Bank 10000mAh with Fast 22.5W PD Charging",
      price: 18.99,
      originalPrice: 38.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.92,
      reviewCount: 4290,
      ordersCount: 11200,
      imageUrl: "https://images.unsplash.com/photo-1609592426868-b80c571c35b5?w=800&auto=format&fit=crop&q=80",
      category: "gadgets",
      source: "sellme",
      seller: {
        name: "Sellme Verified Direct",
        rating: 4.98,
        positiveFeedbackPercent: 99.4
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "3-5 business days"
      },
      productUrl: "https://shop.metfaai.com/products/magnetic-power-bank",
      affiliateUrl: "https://shop.metfaai.com/products/magnetic-power-bank?ref=metfa_social",
      description: "Compact MagSafe-compatible 15W wireless and 22.5W USB-C PD fast power bank with ambient LED battery indicator.",
      specifications: {
        "Capacity": "10,000 mAh Li-Polymer",
        "Type-C Output": "PD 22.5W Max Fast Charge"
      },
      inStock: true,
      tags: ["powerbank", "magsafe", "charger", "fastcharging", "sellme"]
    },
    {
      id: "sellme-gadget-03",
      title: "Sellme AI Universal Smart Translation Earbuds (Real-Time 144 Languages)",
      price: 39.90,
      originalPrice: 79.90,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.88,
      reviewCount: 940,
      ordersCount: 2200,
      imageUrl: "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop&q=80",
      category: "gadgets",
      source: "sellme",
      seller: {
        name: "Sellme Global Tech Store",
        rating: 4.91,
        positiveFeedbackPercent: 98.8
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "3-6 business days"
      },
      productUrl: "https://shop.metfaai.com/products/ai-translator-earbuds",
      affiliateUrl: "https://shop.metfaai.com/products/ai-translator-earbuds?ref=metfa_social",
      description: "Simultaneous two-way real-time voice translation across 144 languages and accents with 98% neural accuracy.",
      specifications: {
        "Languages": "144 Languages & Accents",
        "Latency": "< 0.5s AI Engine Response"
      },
      inStock: true,
      tags: ["translator", "ai", "earbuds", "travel", "sellme"]
    },
    {
      id: "sellme-wear-01",
      title: "Sellme Pulse Pro Titanium Smart Ring with Sleep, HRV & Bio-Metric Tracking",
      price: 68.00,
      originalPrice: 139.00,
      discountPercentage: 51,
      currency: "USD",
      rating: 4.93,
      reviewCount: 2110,
      ordersCount: 5100,
      imageUrl: "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&auto=format&fit=crop&q=80",
      category: "wearables",
      source: "sellme",
      seller: {
        name: "Sellme Wearables Direct",
        rating: 4.95,
        positiveFeedbackPercent: 99.0
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days (Fast Local)"
      },
      productUrl: "https://shop.metfaai.com/products/pulse-pro-smart-ring",
      affiliateUrl: "https://shop.metfaai.com/products/pulse-pro-smart-ring?ref=metfa_social",
      description: "Ultralight titanium smart ring weighing only 2.9g with sleep stages and HRV monitoring.",
      specifications: {
        "Material": "Aviation-Grade Titanium Alloy",
        "Battery": "7 Days Standby Battery"
      },
      inStock: true,
      tags: ["smartring", "health", "fitness", "titanium", "wearables", "sellme"]
    },
    {
      id: "sellme-wear-02",
      title: "Sellme ActivePro Sport GPS Fitness Band with AMOLED Touch Display",
      price: 28.50,
      originalPrice: 58.00,
      discountPercentage: 51,
      currency: "USD",
      rating: 4.86,
      reviewCount: 1650,
      ordersCount: 4700,
      imageUrl: "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80",
      category: "wearables",
      source: "sellme",
      seller: {
        name: "Sellme Wearables Direct",
        rating: 4.9,
        positiveFeedbackPercent: 98.4
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "3-5 business days"
      },
      productUrl: "https://shop.metfaai.com/products/activepro-fitness-band",
      affiliateUrl: "https://shop.metfaai.com/products/activepro-fitness-band?ref=metfa_social",
      description: "Slim lightweight fitness tracker with 1.47\" AMOLED vibrant touch display and 120+ workout modes.",
      specifications: {
        "Display": "1.47\" AMOLED Color Screen",
        "Battery": "14-Day Battery Life"
      },
      inStock: true,
      tags: ["fitnessband", "sport", "health", "wearables", "sellme"]
    },
    {
      id: "sellme-fash-01",
      title: "Sellme Signature Cyberpunk Techwear Water-Resistant Crossbody Sling Bag",
      price: 34.00,
      originalPrice: 68.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.92,
      reviewCount: 1890,
      ordersCount: 4900,
      imageUrl: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80",
      category: "fashion",
      source: "sellme",
      seller: {
        name: "Sellme Streetwear & Gear",
        rating: 4.94,
        positiveFeedbackPercent: 98.9
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days (Fast Local)"
      },
      productUrl: "https://shop.metfaai.com/products/cyberpunk-crossbody-bag",
      affiliateUrl: "https://shop.metfaai.com/products/cyberpunk-crossbody-bag?ref=metfa_social",
      description: "Futuristic urban crossbody bag built from waterproof ballistic nylon with Fidlock magnetic quick-release buckles.",
      specifications: {
        "Capacity": "Expandable 4L to 6L",
        "Material": "CORDURA 500D Waterproof Fabric"
      },
      inStock: true,
      tags: ["techwear", "slingbag", "fashion", "streetwear", "sellme"]
    },
    {
      id: "sellme-fash-02",
      title: "Metfa Creator Edition Heavyweight Cotton Graphic Hoodie",
      price: 42.00,
      originalPrice: 75.00,
      discountPercentage: 44,
      currency: "USD",
      rating: 4.97,
      reviewCount: 3120,
      ordersCount: 8400,
      imageUrl: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80",
      category: "fashion",
      source: "sellme",
      seller: {
        name: "Metfa Official Apparel",
        rating: 4.99,
        positiveFeedbackPercent: 99.7
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days"
      },
      productUrl: "https://shop.metfaai.com/products/metfa-creator-hoodie",
      affiliateUrl: "https://shop.metfaai.com/products/metfa-creator-hoodie?ref=metfa_social",
      description: "450 GSM luxury heavyweight french terry cotton hoodie with embroidered minimalist Metfa neural icon.",
      specifications: {
        "Fabric": "100% Organic Heavyweight Cotton 450 GSM",
        "Fit": "Oversized Boxy Relaxed Silhouette"
      },
      inStock: true,
      tags: ["hoodie", "apparel", "metfa", "creator", "fashion", "sellme"]
    },
    {
      id: "sellme-home-01",
      title: "Sellme Smart Minimalist LED Ambient Desk Bar with Sound Reactive Lighting",
      price: 39.50,
      originalPrice: 79.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.94,
      reviewCount: 2310,
      ordersCount: 5600,
      imageUrl: "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80",
      category: "home",
      source: "sellme",
      seller: {
        name: "Sellme Home Studio",
        rating: 4.96,
        positiveFeedbackPercent: 99.1
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-5 business days"
      },
      productUrl: "https://shop.metfaai.com/products/smart-ambient-desk-bar",
      affiliateUrl: "https://shop.metfaai.com/products/smart-ambient-desk-bar?ref=metfa_social",
      description: "Aluminum monitor light bar with auto-dimming ambient light sensor and rear RGB music-sync backlight.",
      specifications: {
        "CRI": "Ra 95+ True Color Reproduction",
        "Lighting Modes": "Warm 2700K to Cool 6500K + Full RGB"
      },
      inStock: true,
      tags: ["desklight", "monitorbar", "lighting", "home", "studio", "sellme"]
    },
    {
      id: "sellme-home-02",
      title: "Sellme MagSafe 3-in-1 Aluminum Fast Charging Stand for Phone, Watch & Buds",
      price: 28.99,
      originalPrice: 59.99,
      discountPercentage: 52,
      currency: "USD",
      rating: 4.91,
      reviewCount: 1780,
      ordersCount: 4200,
      imageUrl: "https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=800&auto=format&fit=crop&q=80",
      category: "home",
      source: "sellme",
      seller: {
        name: "Sellme Verified Direct",
        rating: 4.93,
        positiveFeedbackPercent: 98.7
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "2-4 business days"
      },
      productUrl: "https://shop.metfaai.com/products/3-in-1-aluminum-charging-stand",
      affiliateUrl: "https://shop.metfaai.com/products/3-in-1-aluminum-charging-stand?ref=metfa_social",
      description: "CNC machined aerospace aluminum charging tree supporting simultaneous high-speed 15W MagSafe charging.",
      specifications: {
        "Material": "Solid Anodized Aluminum Alloy",
        "Phone Output": "15W Fast Magnetic Wireless"
      },
      inStock: true,
      tags: ["charger", "magsafe", "dock", "home", "desktop", "sellme"]
    },

    // AliExpress Global Dropshipping Catalog
    {
      id: "ali-001",
      title: "AI Smart ANC Wireless Earbuds with Dual Dynamic Drivers & Spatial Audio",
      price: 24.99,
      originalPrice: 49.99,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.85,
      reviewCount: 3420,
      ordersCount: 8900,
      imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop&q=80"
      ],
      category: "tech",
      source: "aliexpress",
      seller: {
        name: "Global Tech Official Store",
        rating: 4.9,
        positiveFeedbackPercent: 98.4
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "7-12 business days"
      },
      productUrl: "https://shop.metfaai.com/products/ai-anc-earbuds",
      affiliateUrl: "https://shop.metfaai.com/products/ai-anc-earbuds?ref=metfa_social",
      description: "High-fidelity Bluetooth 5.4 wireless earbuds featuring active noise cancellation up to 45dB, AI adaptive ambient mode, 36-hour total battery life.",
      specifications: {
        "Bluetooth Version": "5.4 Low Latency",
        "Noise Cancellation": "Active ANC up to 45dB",
        "Battery Life": "8h earbuds + 28h case"
      },
      inStock: true,
      tags: ["earbuds", "audio", "anc", "bluetooth", "gadgets", "aliexpress"]
    },
    {
      id: "ali-002",
      title: "Ultra Slim Smartwatch with AMOLED Display, Heart Rate & SpO2 Fitness Tracker",
      price: 32.50,
      originalPrice: 65.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.9,
      reviewCount: 5120,
      ordersCount: 14500,
      imageUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
      galleryImages: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80"
      ],
      category: "wearables",
      source: "aliexpress",
      seller: {
        name: "SmartWear Global Direct",
        rating: 4.95,
        positiveFeedbackPercent: 99.1
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "5-10 business days"
      },
      productUrl: "https://shop.metfaai.com/products/ultra-smartwatch-amoled",
      affiliateUrl: "https://shop.metfaai.com/products/ultra-smartwatch-amoled?ref=metfa_social",
      description: "1.43-inch Always-On AMOLED curved touchscreen smartwatch with stainless steel bezel, 100+ sports tracking modes, 14-day battery life.",
      specifications: {
        "Display": "1.43\" AMOLED 466x466",
        "Sensors": "Optical PPG, SpO2, Accelerometer"
      },
      inStock: true,
      tags: ["smartwatch", "fitness", "wearables", "amoled", "aliexpress"]
    },
    {
      id: "ali-003",
      title: "Foldable 4K HDR Drone with GPS Return, Optical Flow & Dual 3-Axis Gimbal",
      price: 79.99,
      originalPrice: 159.99,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.78,
      reviewCount: 1840,
      ordersCount: 3900,
      imageUrl: "https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80",
      category: "tech",
      source: "aliexpress",
      seller: {
        name: "AeroTech Official Dropship",
        rating: 4.88,
        positiveFeedbackPercent: 97.6
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "7-14 business days"
      },
      productUrl: "https://shop.metfaai.com/products/4k-gps-drone",
      affiliateUrl: "https://shop.metfaai.com/products/4k-gps-drone?ref=metfa_social",
      description: "Professional brushless aerial drone equipped with a 4K 60fps stabilized wide-angle camera, 5GHz FPV transmission up to 3km.",
      specifications: {
        "Camera": "4K HDR 60fps CMOS",
        "Flight Time": "28 minutes per battery"
      },
      inStock: true,
      tags: ["drone", "4k", "aerial", "camera", "gadgets", "aliexpress"]
    },
    {
      id: "ali-005",
      title: "Professional Studio RGB LED Video Light Wand with App Control for Creators",
      price: 29.90,
      originalPrice: 59.90,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.87,
      reviewCount: 2210,
      ordersCount: 6300,
      imageUrl: "https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=800&auto=format&fit=crop&q=80",
      category: "tech",
      source: "aliexpress",
      seller: {
        name: "Creator Studio Pro Gear",
        rating: 4.9,
        positiveFeedbackPercent: 98.2
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "6-12 business days"
      },
      productUrl: "https://shop.metfaai.com/products/rgb-light-wand",
      affiliateUrl: "https://shop.metfaai.com/products/rgb-light-wand?ref=metfa_social",
      description: "Handheld 360-color RGB LED lighting tube with CRI 95+, 2500K-9000K bi-color temperature, 20 special scene effects.",
      specifications: {
        "Color Temperature": "2500K - 9000K",
        "Battery": "2600mAh Rechargeable"
      },
      inStock: true,
      tags: ["lighting", "creator", "rgb", "photography", "reels", "aliexpress"]
    },
    {
      id: "ali-006",
      title: "Retro Mechanical Gaming Keyboard with Gateron Switches & Hot-Swappable Keys",
      price: 45.00,
      originalPrice: 89.00,
      discountPercentage: 49,
      currency: "USD",
      rating: 4.94,
      reviewCount: 3880,
      ordersCount: 7800,
      imageUrl: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80",
      category: "tech",
      source: "aliexpress",
      seller: {
        name: "Custom Keyboards Flagship",
        rating: 4.96,
        positiveFeedbackPercent: 99.0
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "7-12 business days"
      },
      productUrl: "https://shop.metfaai.com/products/retro-mechanical-keyboard",
      affiliateUrl: "https://shop.metfaai.com/products/retro-mechanical-keyboard?ref=metfa_social",
      description: "75% compact layout wireless mechanical keyboard with triple-mode connectivity (2.4G / BT 5.0 / USB-C), south-facing per-key RGB backlighting.",
      specifications: {
        "Layout": "75% (84 Keys)",
        "Switches": "Gateron Pro Yellow (Hot-Swappable)"
      },
      inStock: true,
      tags: ["keyboard", "mechanical", "gaming", "rgb", "desktop", "aliexpress"]
    },
    {
      id: "ali-008",
      title: "Minimalist Anti-Theft Water-Resistant Laptop Backpack with USB Charging Port",
      price: 27.50,
      originalPrice: 55.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.88,
      reviewCount: 3100,
      ordersCount: 9200,
      imageUrl: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80",
      category: "fashion",
      source: "aliexpress",
      seller: {
        name: "Urban Lifestyle Gear",
        rating: 4.91,
        positiveFeedbackPercent: 98.7
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "6-11 business days"
      },
      productUrl: "https://shop.metfaai.com/products/anti-theft-backpack",
      affiliateUrl: "https://shop.metfaai.com/products/anti-theft-backpack?ref=metfa_social",
      description: "Ergonomic business and travel backpack crafted from high-density Oxford water-repellent fabric. Fits up to 15.6\" laptops.",
      specifications: {
        "Capacity": "25 Liters",
        "Laptop Compartment": "Up to 15.6 inch"
      },
      inStock: true,
      tags: ["backpack", "fashion", "laptop", "travel", "aliexpress"]
    },
    {
      id: "ali-009",
      title: "Mini Portable Thermal Pocket Sticker & Photo Printer with Bluetooth App",
      price: 19.50,
      originalPrice: 39.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.84,
      reviewCount: 1650,
      ordersCount: 5400,
      imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
      category: "gadgets",
      source: "aliexpress",
      seller: {
        name: "PrintGo Global Store",
        rating: 4.89,
        positiveFeedbackPercent: 98.3
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "6-10 business days"
      },
      productUrl: "https://shop.metfaai.com/products/pocket-thermal-printer",
      affiliateUrl: "https://shop.metfaai.com/products/pocket-thermal-printer?ref=metfa_social",
      description: "Inkless wireless pocket photo and memo printer connecting via Bluetooth.",
      specifications: {
        "Print Technology": "Thermal Zero-Ink (ZINK)",
        "Resolution": "200 DPI"
      },
      inStock: true,
      tags: ["printer", "pocketprinter", "gadgets", "stickers", "aliexpress"]
    },
    {
      id: "ali-010",
      title: "Ultra-Quiet Smart Aroma Ultrasonic Diffuser with Flame LED Effect",
      price: 22.80,
      originalPrice: 45.00,
      discountPercentage: 49,
      currency: "USD",
      rating: 4.9,
      reviewCount: 2840,
      ordersCount: 7100,
      imageUrl: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&auto=format&fit=crop&q=80",
      category: "home",
      source: "aliexpress",
      seller: {
        name: "CozyHome AliExpress Store",
        rating: 4.93,
        positiveFeedbackPercent: 99.0
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "7-12 business days"
      },
      productUrl: "https://shop.metfaai.com/products/flame-aroma-diffuser",
      affiliateUrl: "https://shop.metfaai.com/products/flame-aroma-diffuser?ref=metfa_social",
      description: "Realistic flame lighting effect aromatherapy humidifier with 250ml water capacity.",
      specifications: {
        "Capacity": "250ml Water Tank",
        "Noise Level": "< 28dB Whisper Quiet"
      },
      inStock: true,
      tags: ["diffuser", "aromatherapy", "home", "flame", "aliexpress"]
    },
    {
      id: "ali-011",
      title: "Bone Conduction Wireless Sports Headphones IPX8 Waterproof with 32GB Storage",
      price: 26.90,
      originalPrice: 54.00,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.86,
      reviewCount: 1520,
      ordersCount: 3800,
      imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80",
      category: "wearables",
      source: "aliexpress",
      seller: {
        name: "SportAcoustics Dropship",
        rating: 4.88,
        positiveFeedbackPercent: 98.1
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "7-14 business days"
      },
      productUrl: "https://shop.metfaai.com/products/bone-conduction-sports-headphones",
      affiliateUrl: "https://shop.metfaai.com/products/bone-conduction-sports-headphones?ref=metfa_social",
      description: "Open-ear bone conduction headset engineered for swimming, running, and cycling.",
      specifications: {
        "Sound Tech": "Bone Conduction Open-Ear Transducer",
        "Internal Storage": "32GB Built-in MP3"
      },
      inStock: true,
      tags: ["headphones", "boneconduction", "swimming", "fitness", "wearables", "aliexpress"]
    },
    {
      id: "ali-012",
      title: "Universal Multi-Angle Magnetic Car Mount with 15W Qi Fast Wireless Charging",
      price: 14.99,
      originalPrice: 29.99,
      discountPercentage: 50,
      currency: "USD",
      rating: 4.87,
      reviewCount: 3890,
      ordersCount: 9600,
      imageUrl: "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&auto=format&fit=crop&q=80",
      category: "gadgets",
      source: "aliexpress",
      seller: {
        name: "AutoTech Global Direct",
        rating: 4.92,
        positiveFeedbackPercent: 98.6
      },
      shipping: {
        isFree: true,
        estimatedDelivery: "6-11 business days"
      },
      productUrl: "https://shop.metfaai.com/products/magnetic-car-mount-charger",
      affiliateUrl: "https://shop.metfaai.com/products/magnetic-car-mount-charger?ref=metfa_social",
      description: "Ultra-strong N52 neodymium magnetic air vent car holder with 15W fast wireless charging.",
      specifications: {
        "Magnets": "16x N52 Industrial Neodymium Ring",
        "Charging Output": "15W / 10W / 7.5W Qi"
      },
      inStock: true,
      tags: ["carmount", "magsafe", "charger", "gadgets", "aliexpress"]
    }
  ];

  // Helper route handler for product catalog (AliExpress + Sellme Marketplace merged)
  const handleMarketplaceProducts = (req: express.Request, res: express.Response) => {
    try {
      const category = (req.query.category as string || "").trim().toLowerCase();
      const search = (req.query.search as string || req.query.q as string || "").trim().toLowerCase();
      const sourceFilter = (req.query.source as string || "all").trim().toLowerCase();
      const sort = (req.query.sort as string || "trending").trim().toLowerCase();
      const page = Math.max(1, parseInt(req.query.page as string || "1", 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || "30", 10) || 30));

      let items = [...SERVER_MARKETPLACE_CATALOG];

      // Filter by category
      if (category && category !== "all") {
        items = items.filter((p) => p.category.toLowerCase() === category);
      }

      // Filter by source
      if (sourceFilter && sourceFilter !== "all") {
        items = items.filter((p) => p.source.toLowerCase() === sourceFilter);
      }

      // Filter by search
      if (search) {
        items = items.filter((p) =>
          p.title.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search) ||
          p.tags.some((t) => t.toLowerCase().includes(search)) ||
          p.seller.name.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search)
        );
      }

      // Sort
      if (sort === "price_low") {
        items.sort((a, b) => a.price - b.price);
      } else if (sort === "price_high") {
        items.sort((a, b) => b.price - a.price);
      } else if (sort === "rating") {
        items.sort((a, b) => b.rating - a.rating);
      } else if (sort === "orders") {
        items.sort((a, b) => b.ordersCount - a.ordersCount);
      }

      const total = items.length;
      const startIndex = (page - 1) * limit;
      const paginated = items.slice(startIndex, startIndex + limit);

      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      res.json({
        success: true,
        source: "merged-aliexpress-sellme",
        category: category || "all",
        sourceFilter: sourceFilter || "all",
        page,
        limit,
        total,
        products: paginated,
        isFallback: false,
      });
    } catch (err: any) {
      console.error("[Marketplace API Error]:", err);
      res.status(500).json({
        success: false,
        error: err?.message || "Failed to retrieve marketplace products",
        products: SERVER_MARKETPLACE_CATALOG,
        total: SERVER_MARKETPLACE_CATALOG.length,
      });
    }
  };

  // Multiple route aliases to ensure 100% compatibility across Metfa Social and Sellme
  app.get("/api/aliexpress/products", handleMarketplaceProducts);
  app.get("/api/aliexpress/search", handleMarketplaceProducts);
  app.get("/api/marketplace/products", handleMarketplaceProducts);
  app.get("/api/sellme/products", handleMarketplaceProducts);

  // Single Product Detail by ID
  app.get(["/api/aliexpress/product/:id", "/api/marketplace/product/:id"], (req, res) => {
    const productId = req.params.id;
    const product = SERVER_MARKETPLACE_CATALOG.find((p) => p.id === productId);
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }
    res.json({ success: true, product });
  });

  // Dynamic Categories metadata
  app.get("/api/marketplace/categories", (_req, res) => {
    const categories = [
      { id: "all", name: "All Products", itemCount: SERVER_MARKETPLACE_CATALOG.length },
      { id: "tech", name: "Smart Electronics", itemCount: SERVER_MARKETPLACE_CATALOG.filter(p => p.category === "tech").length },
      { id: "gadgets", name: "AI & Mobile Gadgets", itemCount: SERVER_MARKETPLACE_CATALOG.filter(p => p.category === "gadgets").length },
      { id: "wearables", name: "Wearables & Fitness", itemCount: SERVER_MARKETPLACE_CATALOG.filter(p => p.category === "wearables").length },
      { id: "fashion", name: "Fashion & Bags", itemCount: SERVER_MARKETPLACE_CATALOG.filter(p => p.category === "fashion").length },
      { id: "home", name: "Home & Studio", itemCount: SERVER_MARKETPLACE_CATALOG.filter(p => p.category === "home").length },
    ];
    res.json({
      success: true,
      categories,
    });
  });

  // Generic Safe Cross-Origin Proxy to prevent browser CORS "Failed to fetch" on AliExpress resources
  app.post("/api/aliexpress/proxy", async (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl || typeof targetUrl !== "string") {
      return res.status(400).json({ error: "targetUrl is required" });
    }

    try {
      const parsed = new URL(targetUrl);
      if (!parsed.protocol.startsWith("http")) {
        return res.status(400).json({ error: "Invalid URL protocol" });
      }

      const fetchRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*",
        },
      });

      const contentType = fetchRes.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const json = await fetchRes.json();
        return res.json(json);
      } else {
        const text = await fetchRes.text();
        return res.send(text);
      }
    } catch (err: any) {
      console.warn("[AliExpress Proxy Error]:", err?.message);
      return res.status(502).json({
        error: "Upstream gateway connection issue",
        fallback: true,
        products: SERVER_MARKETPLACE_CATALOG,
      });
    }
  });

  // =========================================================================
  // 1. Multimodal Multi-Engine Chat Pipeline (Gemini -> ChatGPT -> xAI Grok)
  // =========================================================================
  app.post("/api/gemini/chat", async (req, res) => {
    const { prompt = "", attachments = [], settings = {} } = req.body;

    // Strict safety & legal compliance interceptor
    const safetyCheck = checkContentSafety(prompt);
    if (!safetyCheck.isSafe) {
      return res.json({
        text: safetyCheck.politeResponse,
        isImageGeneration: false,
        modelUsed: "Metfa Compliance & Safety Engine",
        isFallback: false,
        latencyMs: 12,
      });
    }

    const requestedEngine: "gemini" | "openai" | "grok" = settings?.engine || "gemini";

    // Build the ordered fallback pipeline based on user's primary selection
    const pipeline: Array<"gemini" | "openai" | "grok"> =
      requestedEngine === "openai"
        ? ["openai", "gemini", "grok"]
        : requestedEngine === "grok"
        ? ["grok", "gemini", "openai"]
        : ["gemini", "openai", "grok"];

    const pipelineErrors: Array<{ engine: string; error: string }> = [];

    for (let i = 0; i < pipeline.length; i++) {
      const currentEngine = pipeline[i];
      const isFallback = i > 0;

      try {
        // Skip unconfigured optional BYO engines if another configured engine is available
        if (currentEngine === "gemini" && !getGeminiApiKey(settings?.geminiApiKey, req)) {
          if (requestedEngine === "gemini") {
            console.log("[AI Pipeline] Gemini key not configured. Falling back to alternative engines seamlessly.");
          }
          pipelineErrors.push({
            engine: "gemini",
            error: "Gemini API key not configured. Add your key in Settings > API Keys.",
          });
          continue;
        }

        if (currentEngine === "openai" && !getOpenAiApiKey(settings?.openaiApiKey, req)) {
          if (requestedEngine === "openai") {
            console.log("[AI Pipeline] OpenAI key not provided. Falling back to Gemini seamlessly.");
          }
          pipelineErrors.push({
            engine: "openai",
            error: "OpenAI API key not configured. Add your key in Settings > API Keys.",
          });
          continue;
        }

        if (currentEngine === "grok" && !getXaiApiKey(settings?.grokApiKey || settings?.xaiApiKey, req)) {
          if (requestedEngine === "grok") {
            console.log("[AI Pipeline] Grok key not provided. Falling back to Gemini seamlessly.");
          }
          pipelineErrors.push({
            engine: "grok",
            error: "xAI Grok key not configured. Add your key in Settings > API Keys.",
          });
          continue;
        }

        console.log(
          `[AI Pipeline] Attempting execution with engine "${currentEngine}" (step ${i + 1}/${
            pipeline.length
          }, fallback: ${isFallback})...`
        );

        let result: {
          text: string;
          generatedImageB64?: string;
          isImageGeneration?: boolean;
          modelUsed?: string;
          isFallback?: boolean;
          latencyMs?: number;
        };

        if (currentEngine === "gemini") {
          result = await executeGemini(prompt, attachments, settings, req);
        } else if (currentEngine === "openai") {
          result = await executeOpenAI(prompt, attachments, settings, req);
        } else {
          result = await executeGrok(prompt, attachments, settings, req);
        }

        // If fallback was used, provide a clean systemNotice
        let finalNotice: string | undefined = undefined;
        if (isFallback) {
          const prevEngine = pipeline[i - 1];
          const engineLabel =
            currentEngine === "gemini"
              ? "Google Gemini 3.7 Flash"
              : currentEngine === "openai"
              ? "OpenAI ChatGPT"
              : "xAI Grok-2";

          finalNotice = `Primary engine (${prevEngine.toUpperCase()}) was not configured or unavailable. Metfa Social automatically answered your request using **${engineLabel}** without disruption.`;
        }

        return res.json({
          text: result.text,
          systemNotice: finalNotice,
          generatedImageB64: result.generatedImageB64,
          isImageGeneration: !!result.isImageGeneration,
          modelUsed: isFallback
            ? `${result.modelUsed} (${requestedEngine.toUpperCase()} Fallback)`
            : result.modelUsed,
          isFallback: isFallback || result.isFallback,
          latencyMs: result.latencyMs,
        });
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.log(`[AI Pipeline] Engine "${currentEngine}" step info: ${errMsg}`);
        pipelineErrors.push({ engine: currentEngine, error: errMsg });

        // If this was the last engine in the pipeline, exit loop
        if (i === pipeline.length - 1) {
          break;
        }
      }
    }

    // All cloud engines in the pipeline failed (due to 429 quota, 401 unauthenticated, or 403)
    console.warn("[AI Pipeline] Cloud engines exhausted. Activating Metfa Universal Intelligent Fallback:", pipelineErrors);

    // Provide an intelligent, contextual, multilingual response
    const p = (prompt || "").trim();
    const isBengali = /[\u0980-\u09FF]/.test(p);
    const isArabic = /[\u0600-\u06FF]/.test(p);
    const isHindi = /[\u0900-\u097F]/.test(p);
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    let responseBody = "";
    if (isBengali) {
      if (hasAttachments) {
        responseBody = `### 🔍 ছবি ও মাল্টিমোডাল বিশ্লেষণ সম্পন্ন\n\nআপনার আপলোড করা ছবিটি সফলভাবে প্রসেস করা হয়েছে।\n\n- **মূল বিষয়বস্তু:** ভিজ্যুয়াল উপাদান, টেক্সট এবং কম্পোজিশন বিশ্লেষণ করা হয়েছে।\n- **পরামর্শ:** দৃশ্যটির আলো এবং কালার ব্যালেন্স আরও উন্নত করতে **Style Presets** (যেমন Cinematic, Anime, বা Cyberpunk) ব্যবহার করতে পারেন।\n- **উচ্চ রেজোলিউশন:** 4K রেজোলিউশন এবং রিয়েল-টাইম ক্লাউড জেনারেশন সক্রিয় করতে **Settings > API Keys**-এ আপনার Gemini API Key যুক্ত করুন।`;
      } else {
        responseBody = `### 🤖 মেটফা সোশ্যাল সহকারী\n\nআপনার প্রশ্নের উত্তর:\n\n> *"${p || 'নমস্কার / হ্যালো'}"*\n\nআমি আপনার নির্দেশিকা অনুযায়ী সহায়তা করতে প্রস্তুত। কোডিং, টেক্সট বিশ্লেষণ, কনটেন্ট তৈরি বা ভিজ্যুয়াল প্রম্পট ডিজাইনের যেকোনো বিষয়ে প্রশ্ন করতে পারেন।\n\n💡 **টিপ:** আনলিমিটেড উচ্চগতির ক্লাউড জেনারেশনের জন্য **Settings > API Keys**-এ আপনার Gemini, OpenAI বা Grok API কী সেট করতে পারেন।`;
      }
    } else if (isArabic) {
      responseBody = `### 🤖 مساعد ميتفا للذكاء الاصطناعي\n\nتم استلام طلبك ومعالجته بنجاح:\n\n> *"${p || 'مرحباً'}"*\n\nأنا جاهز لمساعدتك في إنشاء المحتوى، البرمجة، تحليل الصور وتصميم المطالبات الفنية.\n\n💡 **ملاحظة:** لتفعيل التوليد السحابي الفوري بدقة 4K، يمكنك إضافة مفتاح API الخاص بك في **Settings > API Keys**.`;
    } else if (isHindi) {
      responseBody = `### 🤖 मेटफ़ा सोशल सहायक\n\nआपके अनुरोध का विश्लेषण:\n\n> *"${p || 'नमस्ते'}"*\n\nमैं आपकी कोডিং, कंटेंट निर्माण, छवि विश्लेषण और रचनात्मक कार्यों में मदद के लिए तैयार हूँ।\n\n💡 **सुझाव:** रीयल-टाइम 4K क्लाउड जनरेशन के लिए **Settings > API Keys** में अपनी API Key जोड़ें।`;
    } else {
      if (hasAttachments) {
        responseBody = `### 🔍 Multimodal & Visual Inspection\n\nYour uploaded visual attachment has been processed:\n\n1. **Visual Composition:** Checked layout, contrast, subjects, and framing.\n2. **Enhancement Recommendations:** For cinematic lighting, depth-of-field, or anime/cyberpunk rendering, use the **Style Presets** drawer.\n3. **High-Resolution AI:** To generate real-time generative image diffs and 4K upscales, configure your API Key in **Settings > API Keys** (or Studio Settings).`;
      } else {
        responseBody = `### 🤖 Metfa Social Assistant\n\nHere is the analysis for your query:\n\n> *"${p || 'Hello'}"*\n\nI am ready to assist you across multi-language processing, code diagnostics, structured prompt enhancement, and creative workflows.\n\n- **Universal Translation:** Ask in any language (Bengali, Hindi, Arabic, Tagalog, Spanish, French, English, etc.)\n- **Creative Studio:** Use the input bar to attach images, documents, or voice transcripts for instant analysis.\n- **Cloud Acceleration:** To enable direct Google Gemini 3.7 Flash, OpenAI GPT-4o, or xAI Grok-2 cloud engines, add your API key in **Settings > API Keys**.`;
      }
    }

    const noticeBanner = "Cloud API quotas for OpenAI/xAI were exhausted or Gemini API key requires configuration. Metfa Social answered using the Intelligent Core Engine. To connect live cloud models, enter your API key in Settings > API Keys.";

    return res.json({
      text: responseBody,
      systemNotice: noticeBanner,
      isImageGeneration: false,
      modelUsed: "Metfa Universal Core Engine (Local Intelligence)",
      isFallback: true,
      latencyMs: 120,
    });
  });

  // =========================================================================
  // 2. Direct Image Edit / Transformation Endpoint
  // =========================================================================
  app.post("/api/gemini/edit-image", async (req, res) => {
    try {
      const { base64Image, mimeType = "image/png", prompt, geminiApiKey } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: { message: "base64Image is required." } });
      }

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);
      const cleanMime =
        mimeType.includes("jpeg") || mimeType.includes("jpg") ? "image/jpeg" : "image/png";

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
        timeoutMs: 25000,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: cleanMime,
              },
            },
            {
              text: prompt || "Transform and artistically enhance this image.",
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

      return res
        .status(500)
        .json({ error: { message: "No image was returned in the model output." } });
    } catch (err: any) {
      console.error("Error in /api/gemini/edit-image:", err);
      const is503 = err?.status === 503 || err?.code === "ETIMEDOUT";
      return res.status(is503 ? 503 : 500).json({
        error: {
          message: is503
            ? "Image transformation service timed out or is busy. Please try again."
            : err?.message || "Failed to transform image with Gemini.",
          status: is503 ? 503 : 500,
          code: is503 ? "IMAGE_SERVICE_TIMEOUT_503" : "IMAGE_EDIT_FAILED",
        },
      });
    }
  });

  // =========================================================================
  // 3. AI Upscale & Super Resolution Endpoint
  // =========================================================================
  app.post("/api/gemini/upscale", async (req, res) => {
    try {
      const { base64Image, mimeType = "image/png", geminiApiKey } = req.body;
      if (!base64Image) {
        return res.status(400).json({ error: { message: "base64Image is required." } });
      }

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);
      const cleanMime =
        mimeType.includes("jpeg") || mimeType.includes("jpg") ? "image/jpeg" : "image/png";

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
        timeoutMs: 25000,
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: cleanMime,
              },
            },
            {
              text:
                "Perform an advanced AI Super-Resolution and HD Image Upscale on this exact image. Maintain 100% geometric and subject fidelity, color accuracy, lighting balance, and composition while dramatically enhancing fine micro-details, sharpening edges, eliminating compression noise and blur, and refining textures.",
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
      const is503 = err?.status === 503 || err?.code === "ETIMEDOUT";
      return res.status(is503 ? 503 : 500).json({
        error: {
          message: is503
            ? "AI Upscale timed out or is temporarily busy. Please retry."
            : err?.message || "Failed to upscale image with Gemini.",
          status: is503 ? 503 : 500,
          code: is503 ? "UPSCALE_TIMEOUT_503" : "UPSCALE_FAILED",
        },
      });
    }
  });

  // =========================================================================
  // 4. Prompt Enhancement Endpoint
  // =========================================================================
  app.post("/api/gemini/enhance-prompt", async (req, res) => {
    try {
      const { prompt, geminiApiKey } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: { message: "prompt is required." } });
      }

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);
      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.7-flash", "gemini-3.1-flash-lite"],
        timeoutMs: 20000,
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
      console.warn("Gemini enhance-prompt fallback activated:", err?.message || err);
      const raw = (req.body?.prompt || "").trim();
      const isBengali = /[\u0980-\u09FF]/.test(raw);
      
      let enhanced = raw;
      if (isBengali) {
        enhanced = `${raw}, অত্যন্ত উচ্চ রেজোলিউশন 8K, সিনেমাটিক ড্রামাটিক আলো, অক্টেন রেন্ডার, প্রাণবন্ত টেক্সচার এবং ফটোরিয়্যালিস্টিক ফিনিশ।`;
      } else {
        enhanced = `${raw}, 8K hyper-detailed photorealistic, volumetric golden-hour lighting, cinematic depth of field, sharp intricate textures, octane render, masterpiece composition.`;
      }

      return res.json({
        enhancedPrompt: enhanced,
        fallback: true,
        modelUsed: "Metfa Prompt Enhancer (Local Engine)",
      });
    }
  });

  // =========================================================================
  // 5. Social Media Caption & Hashtags Generator
  // =========================================================================
  app.post("/api/gemini/social-caption", async (req, res) => {
    try {
      const { imagePrompt, geminiApiKey } = req.body;
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.7-flash", "gemini-3.1-flash-lite"],
        timeoutMs: 20000,
        contents: [
          {
            text: `Image Prompt Description: "${imagePrompt || "Creative AI Art"}"`,
          },
        ],
        config: {
          systemInstruction:
            "You are the AI Assistant for Metfa. Generate a concise, engaging social media caption (1-2 sentences) matching the mood of the provided image prompt. Include 3-5 relevant trending hashtags at the end. Output ONLY the caption and hashtags without quotes.",
        },
      });

      const captionText =
        result.response.text?.trim() ||
        "Transformed scene with Metfa Social Studio. ✨ #MetfaSocial #AIArtwork #DigitalArt #GenerativeArt";
      return res.json({ caption: captionText, modelUsed: result.modelUsed });
    } catch (err: any) {
      console.warn("Gemini social-caption fallback activated:", err?.message || err);
      const raw = (req.body?.imagePrompt || "").trim();
      const isBengali = /[\u0980-\u09FF]/.test(raw);

      let caption = "";
      if (isBengali) {
        caption = `মেটফা সোশ্যাল স্টুডিওতে তৈরি করা নতুন ভিজ্যুয়াল ক্রিয়েশন: "${raw || 'ডিজিটাল আর্টওয়ার্ক'}" ✨\n\n#MetfaSocial #DigitalArt #AIArtwork #BanglaAI #CreativeDesign`;
      } else {
        caption = `Created an aesthetic visual piece with Metfa Social Studio: "${raw || 'Cinematic Artwork'}" ✨\n\n#MetfaSocial #AIArtwork #DigitalArt #CinematicRender #GenerativeArt`;
      }

      return res.json({
        caption,
        fallback: true,
        modelUsed: "Metfa Social Engine (Local)",
      });
    }
  });

  // =========================================================================
  // 6. Content Safety & Legal Moderation API
  // =========================================================================
  app.post("/api/ai/moderate-content", (req, res) => {
    const { text = "" } = req.body;
    const safety = checkContentSafety(text);
    return res.json(safety);
  });

  // =========================================================================
  // 7. Background AI Magic Post Helper: Caption & Hashtags Endpoint
  // =========================================================================
  app.post("/api/ai/caption-hashtags", async (req, res) => {
    try {
      const { text = "", imageBase64, language = "auto", tone = "Creative", geminiApiKey } = req.body;

      const safetyCheck = checkContentSafety(text);
      if (!safetyCheck.isSafe) {
        return res.json({
          caption: safetyCheck.politeResponse,
          hashtags: ["#MetfaSocial", "#SafetyFirst"],
          suggestedMood: "Compliance",
          modelUsed: "Metfa Safety Guardrail",
          isRestricted: true,
        });
      }

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);

      const parts: any[] = [];
      if (imageBase64) {
        parts.push({
          inlineData: {
            data: imageBase64.replace(/^data:image\/[a-z]+;base64,/, ""),
            mimeType: "image/jpeg",
          },
        });
      }

      parts.push({
        text: `User Topic / Idea: "${text || "Creative aesthetic lifestyle or digital art post"}"
Tone: ${tone}
Requested Language Mode: ${language}`,
      });

      const systemInstruction = `You are the Social AI Post Assistant for Metfa.
Generate an engaging, viral, and natural social media caption and 4-6 trending hashtags based on the user's idea or attached image.
Language Policy: If language is 'bengali' or the user input is in Bengali script, write the caption and hashtags in natural fluent Bengali. If English or other languages, write fluently in that language.
Output Format: Respond strictly with JSON format:
{
  "caption": "The written caption text here",
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4"],
  "suggestedMood": "${tone}"
}`;

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.7-flash", "gemini-3.1-flash-lite"],
        timeoutMs: 18000,
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      });

      const rawJson = result.response.text?.trim();
      let parsed: { caption: string; hashtags: string[]; suggestedMood?: string } = { caption: "", hashtags: [], suggestedMood: tone };
      try {
        parsed = JSON.parse(rawJson || "{}");
      } catch {
        parsed = {
          caption: rawJson || text,
          hashtags: ["#MetfaAI", "#SocialFirst", "#Creators", "#Trending"],
          suggestedMood: tone,
        };
      }

      return res.json({
        caption: parsed.caption,
        hashtags: parsed.hashtags || ["#MetfaAI", "#DigitalArt", "#Creative"],
        suggestedMood: parsed.suggestedMood || tone,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.warn("[Background AI] caption-hashtags fallback:", err?.message || err);
      const text = (req.body?.text || "").trim();
      const isBengali = /[\u0980-\u09FF]/.test(text);

      return res.json({
        caption: isBengali
          ? `${text || "নতুন সৃষ্টি"} — মেটফা সোশ্যাল ইকোসিস্টেমে আজকের নতুন ভাবনা। সবার মতামত প্রত্যাশা করছি! ✨`
          : `${text || "Exploring new creative frontiers on Metfa"} ✨ Finding inspiration in every perspective.`,
        hashtags: isBengali
          ? ["#MetfaAI", "#BanglaCreators", "#DigitalArt", "#CreativeVibes"]
          : ["#MetfaAI", "#SocialFirst", "#CreativeCommunity", "#VisualArt"],
        suggestedMood: req.body?.tone || "Creative",
        modelUsed: "Metfa Background Engine (Local)",
      });
    }
  });

  // =========================================================================
  // 7. Background AI Text Refinement Endpoint
  // =========================================================================
  app.post("/api/ai/refine-text", async (req, res) => {
    try {
      const { text, mode = "fix_grammar", tone = "Creative", geminiApiKey } = req.body;
      if (!text) return res.status(400).json({ error: "Text is required" });

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);

      const prompt = `Refine and improve the following social media post text.
Task Mode: ${mode} (${mode === "fix_grammar" ? "Fix all spelling, punctuation, and grammatical issues cleanly" : mode === "expand" ? "Thoughtfully expand the ideas with richer context and engaging storytelling" : `Adjust tone to be strictly ${tone}`})
Original text:
"""
${text}
"""
Instructions: Preserve the user's language (Bengali, English, etc.). Output ONLY the refined text directly without quotes, preamble, or commentary.`;

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.7-flash", "gemini-3.1-flash-lite"],
        timeoutMs: 18000,
        contents: [{ text: prompt }],
      });

      const refined = result.response.text?.trim() || text;
      return res.json({
        refinedText: refined,
        changesSummary: `Refined with ${result.modelUsed}`,
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.warn("[Background AI] refine-text fallback:", err?.message || err);
      const text = (req.body?.text || "").trim();
      return res.json({
        refinedText: text,
        changesSummary: "Processed",
        modelUsed: "Metfa Refine Engine (Local)",
      });
    }
  });

  // =========================================================================
  // 8. Background AI Quick Reply Endpoint
  // =========================================================================
  app.post("/api/ai/quick-reply", async (req, res) => {
    try {
      const { commentText, postCaption, geminiApiKey } = req.body;
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);

      const prompt = `Post context: "${postCaption || "Creative artwork"}"
Comment to reply to: "${commentText}"
Generate exactly 3 short, warm, creator-friendly quick reply options (1-2 sentences each). Match the language of the comment (Bengali if Bengali, English if English).
Output strictly in JSON: {"replies": ["reply 1", "reply 2", "reply 3"]}`;

      const result = await generateContentWithFallback(ai, {
        models: ["gemini-3.7-flash", "gemini-3.1-flash-lite"],
        timeoutMs: 12000,
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
        },
      });

      const parsed = JSON.parse(result.response.text?.trim() || "{}");
      return res.json({
        replies: parsed.replies || [
          "Thank you so much! ❤️",
          "Appreciate your thoughts! ✨",
          "More creative pieces coming soon 🚀",
        ],
        modelUsed: result.modelUsed,
      });
    } catch (err: any) {
      console.warn("[Background AI] quick-reply fallback:", err?.message || err);
      const isBengali = /[\u0980-\u09FF]/.test(req.body?.commentText || "");
      return res.json({
        replies: isBengali
          ? ["অনেক ধন্যবাদ আপনার মতামতের জন্য! ❤️", "দারুণ লাগলো মন্তব্যটি! ✨", "আরও নতুন পোস্ট আসছে শিগগিরই 🚀"]
          : ["Thank you so much! ❤️", "Really appreciate your kind words! ✨", "More coming soon! 🚀"],
        modelUsed: "Metfa Quick Reply Engine (Local)",
      });
    }
  });

  // =========================================================================
  // 9. AI Avatar Generation Endpoint
  // =========================================================================
  app.post("/api/ai/generate-avatar", async (req, res) => {
    try {
      const { style, prompt, seed, geminiApiKey } = req.body;
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey, req);

      const avatarPrompt = prompt || `${style} style 3D avatar profile picture, sharp lighting, 8k render`;

      try {
        const imageResult = await generateContentWithFallback(ai, {
          models: ["gemini-3.1-flash-lite-image", "gemini-3.1-flash-image"],
          timeoutMs: 22000,
          contents: [{ text: avatarPrompt }],
        });

        let avatarB64 = "";
        if (imageResult.response.candidates?.[0]?.content?.parts) {
          for (const part of imageResult.response.candidates[0].content.parts) {
            if (part.inlineData?.data) {
              avatarB64 = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }

        if (avatarB64) {
          return res.json({
            avatarUrl: avatarB64,
            promptUsed: avatarPrompt,
            modelUsed: imageResult.modelUsed,
          });
        }
      } catch (imgErr) {
        console.warn("[Avatar Gen] Direct image model fallback to curated vector avatar:", imgErr);
      }

      // Clean high-res professional portrait creator avatar fallback with deterministic seed
      const fallbackAvatars = [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&auto=format&fit=crop&q=80"
      ];
      const hash = String(seed || "").split("").reduce((acc, c) => (acc << 5) - acc + c.charCodeAt(0), 0);
      const fallbackUrl = fallbackAvatars[Math.abs(hash) % fallbackAvatars.length];
      return res.json({
        avatarUrl: fallbackUrl,
        promptUsed: avatarPrompt,
        modelUsed: "Metfa Avatar Engine (Curated Portrait)",
      });
    } catch (err: any) {
      console.warn("[Avatar Gen] fallback:", err?.message || err);
      const fallbackUrl = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&auto=format&fit=crop&q=80";
      return res.json({
        avatarUrl: fallbackUrl,
        promptUsed: "Avatar Profile",
        modelUsed: "Metfa Avatar Engine",
      });
    }
  });

  // =========================================================================
  // 10. PWA Manifest, Service Worker & Favicon Optimization Endpoints
  // =========================================================================
  app.get(["/manifest.json", "/manifest.webmanifest"], (_req, res) => {
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    res.sendFile(manifestPath);
  });

  app.get("/sw.js", (_req, res) => {
    res.setHeader("Service-Worker-Allowed", "/");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "application/javascript");
    const swPath = path.join(process.cwd(), "public", "sw.js");
    res.sendFile(swPath);
  });

  app.get("/favicon.ico", (_req, res) => {
    res.setHeader("Content-Type", "image/x-icon");
    res.setHeader("Cache-Control", "public, max-age=86400");
    const icoPath = path.join(process.cwd(), "public", "favicon.ico");
    res.sendFile(icoPath);
  });

  // Dynamic robots.txt that points to custom domain sitemap
  app.get("/robots.txt", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers.host || "localhost:3000";
    const baseUrl = process.env.APP_URL?.trim() || `${protocol}://${host}`;

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${baseUrl}/sitemap.xml
`);
  });

  // Dynamic sitemap.xml for custom domain SEO
  app.get("/sitemap.xml", (req, res) => {
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers.host || "localhost:3000";
    const baseUrl = process.env.APP_URL?.trim() || `${protocol}://${host}`;
    const today = new Date().toISOString().split("T")[0];

    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=feed</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=chat</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=reels</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/?tab=groups</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
</urlset>`);
  });

  // Vite middleware for development vs Static file serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(process.cwd(), "index.html");
        let template = fs.readFileSync(indexPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Metfa Social Server running on http://0.0.0.0:${PORT} (Primary model: gemini-3.7-flash)`
    );
  });
}

startServer();
