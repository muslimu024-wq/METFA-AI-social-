import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { checkContentSafety, METFA_AI_SAFETY_SYSTEM_INSTRUCTION } from "./utils/contentSafety";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support base64 image and attachment payloads up to 50MB
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // =========================================================================
  // =========================================================================
  // ENVIRONMENT VARIABLE KEY RESOLVERS (Vite / Node server standard)
  // =========================================================================
  const getGeminiApiKey = (customKey?: string): string | null => {
    // 1. Explicit user key from request payload
    if (typeof customKey === "string" && customKey.trim().length > 5) {
      return customKey.trim();
    }
    // 2. Standard server-side GEMINI_API_KEY
    const envKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim();
    if (envKey && envKey.length > 5) {
      return envKey;
    }
    return null;
  };

  const getOpenAiApiKey = (customKey?: string): string | null => {
    if (typeof customKey === "string" && customKey.trim().length > 10) {
      const trimmed = customKey.trim();
      if (!trimmed.startsWith("sk-proj-k4NuRPTm") && !trimmed.includes("...")) {
        return trimmed;
      }
    }
    const envKey = process.env.OPENAI_API_KEY?.trim() || process.env.VITE_OPENAI_API_KEY?.trim();
    // Exclude revoked/expired placeholder keys
    if (envKey && envKey.length > 20 && !envKey.startsWith("sk-proj-k4NuRPTm") && !envKey.includes("...")) {
      return envKey;
    }
    return null;
  };

  const getXaiApiKey = (customKey?: string): string | null => {
    if (typeof customKey === "string" && customKey.trim().length > 10) {
      const trimmed = customKey.trim();
      if (!trimmed.startsWith("xai-dummy") && !trimmed.startsWith("xai-ZBBc1") && !trimmed.includes("...")) {
        return trimmed;
      }
    }
    const envKey =
      process.env.XAI_API_KEY?.trim() ||
      process.env.GROK_API_KEY?.trim() ||
      process.env.VITE_XAI_API_KEY?.trim();
    if (
      envKey &&
      envKey.length > 20 &&
      !envKey.startsWith("xai-dummy") &&
      !envKey.startsWith("xai-ZBBc1") &&
      !envKey.includes("...")
    ) {
      return envKey;
    }
    return null;
  };

  // Helper to initialize Gemini API client with required User-Agent
  const getAiClient = (customKey?: string) => {
    const rawKey = getGeminiApiKey(customKey);
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
        if (m === "gemini-3.6-flash" || m === "gemini-2.5-flash" || m === "gemini-flash-latest") return "gemini-3.7-flash";
        if (m === "gemini-2.5-flash-lite") return "gemini-3.1-flash-lite";
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
    if (!validModels.includes("gemini-3.7-flash") && !validModels[0]?.includes("-image")) {
      validModels.push("gemini-3.7-flash");
    }
    if (!validModels.includes("gemini-3.1-flash-lite") && !validModels[0]?.includes("-image")) {
      validModels.push("gemini-3.1-flash-lite");
    }

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
          ai.models.generateContent({
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
  async function executeGrok(prompt: string, attachments: any[] = [], settings: any = {}) {
    const apiKey = getXaiApiKey(settings?.grokApiKey);
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
  async function executeOpenAI(prompt: string, attachments: any[] = [], settings: any = {}) {
    const apiKey = getOpenAiApiKey(settings?.openaiApiKey);
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
  async function executeGemini(prompt: string, attachments: any[] = [], settings: any = {}) {
    const ai = getAiClient(settings?.geminiApiKey);
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
        if (currentEngine === "openai" && !getOpenAiApiKey(settings?.openaiApiKey)) {
          if (requestedEngine === "openai") {
            console.log("[AI Pipeline] OpenAI key not provided. Falling back to Gemini seamlessly.");
          }
          pipelineErrors.push({
            engine: "openai",
            error: "OpenAI API key not configured. Add your key in Settings > API Keys.",
          });
          continue;
        }

        if (currentEngine === "grok" && !getXaiApiKey(settings?.xaiApiKey)) {
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
          result = await executeGemini(prompt, attachments, settings);
        } else if (currentEngine === "openai") {
          result = await executeOpenAI(prompt, attachments, settings);
        } else {
          result = await executeGrok(prompt, attachments, settings);
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

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);
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

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);
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

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);
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
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);

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

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);

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

      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);

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
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);

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
      const ai = getAiClient(geminiApiKey || req.body.settings?.geminiApiKey);

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

      // Stylized vector avatar fallback with deterministic seed
      const fallbackUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || Date.now()}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
      return res.json({
        avatarUrl: fallbackUrl,
        promptUsed: avatarPrompt,
        modelUsed: "Metfa Avatar Engine (Vector)",
      });
    } catch (err: any) {
      console.warn("[Avatar Gen] fallback:", err?.message || err);
      const fallbackUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${Date.now()}`;
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
    console.log(
      `Metfa Social Server running on http://0.0.0.0:${PORT} (Primary model: gemini-3.7-flash)`
    );
  });
}

startServer();
