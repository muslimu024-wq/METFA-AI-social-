import { ChatAttachment, StudioSettings } from "../types/chat";
import { getStoredApiKeys } from "../utils/apiKeysStore";

export interface MultimodalResponse {
  text: string;
  systemNotice?: string;
  generatedImageB64?: string;
  isImageGeneration?: boolean;
  modelUsed?: string;
  isFallback?: boolean;
  latencyMs?: number;
  tokensUsed?: number;
}

export async function sendMultimodalMessage(
  prompt: string,
  attachments: ChatAttachment[] = [],
  settingsOrHistory?: Partial<StudioSettings> | Array<{ role: 'user' | 'assistant'; content: string }>,
  maybeHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<MultimodalResponse> {
  // 60-second client timeout ensures sufficient time for multimodal reasoning and image analysis while preventing indefinite hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 60000);

  try {
    let settings: Partial<StudioSettings> | undefined;
    let history: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;

    if (Array.isArray(settingsOrHistory)) {
      history = settingsOrHistory;
      settings = undefined;
    } else {
      settings = settingsOrHistory;
      history = maybeHistory;
    }

    const storedKeys = getStoredApiKeys();
    const effectiveGeminiKey = (settings?.geminiApiKey || storedKeys.geminiApiKey || "").trim();
    const effectiveOpenAiKey = (settings?.openaiApiKey || storedKeys.openaiApiKey || "").trim();
    const effectiveGrokKey = (settings?.grokApiKey || storedKeys.grokApiKey || "").trim();
    const effectiveClaudeKey = (settings?.claudeApiKey || storedKeys.claudeApiKey || "").trim();
    const activeEngine = settings?.engine || 'gemini';

    const effectiveSettings: Partial<StudioSettings> = {
      ...settings,
      engine: activeEngine,
      geminiApiKey: effectiveGeminiKey,
      openaiApiKey: effectiveOpenAiKey,
      grokApiKey: effectiveGrokKey,
      claudeApiKey: effectiveClaudeKey,
    };

    // Construct headers including custom BYOK keys and engine metadata
    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "x-ai-engine": activeEngine,
    };

    if (effectiveGeminiKey) {
      requestHeaders["x-gemini-api-key"] = effectiveGeminiKey;
    }
    if (effectiveOpenAiKey) {
      requestHeaders["x-openai-api-key"] = effectiveOpenAiKey;
    }
    if (effectiveGrokKey) {
      requestHeaders["x-grok-api-key"] = effectiveGrokKey;
      requestHeaders["x-xai-api-key"] = effectiveGrokKey;
    }

    // Set authorization header matching active engine if key is present
    if (activeEngine === 'openai' && effectiveOpenAiKey) {
      requestHeaders["Authorization"] = `Bearer ${effectiveOpenAiKey}`;
    } else if (activeEngine === 'grok' && effectiveGrokKey) {
      requestHeaders["Authorization"] = `Bearer ${effectiveGrokKey}`;
    } else if (effectiveGeminiKey) {
      requestHeaders["Authorization"] = `Bearer ${effectiveGeminiKey}`;
    }

    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: requestHeaders,
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        attachments,
        settings: effectiveSettings,
        history,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 503 || data?.error?.code === 'SERVICE_UNAVAILABLE_OR_TIMEOUT') {
        throw new Error(
          data?.error?.message ||
          "Gemini models are currently under heavy load. Please click 'Try Again' in a moment."
        );
      }
      const errMsg = data?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(errMsg);
    }

    return {
      text: data.text || "Response received.",
      systemNotice: data.systemNotice,
      generatedImageB64: data.generatedImageB64,
      isImageGeneration: !!data.isImageGeneration,
      modelUsed: data.modelUsed,
      isFallback: data.isFallback,
      latencyMs: data.latencyMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort =
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('signal is aborted') ||
      controller.signal.aborted;

    if (isAbort) {
      console.warn("sendMultimodalMessage request reached timeout limit.");
      throw new Error(
        "Request timed out. The server was busy and did not respond in time. Please tap 'Try Again' to retry."
      );
    }

    console.error("Error in sendMultimodalMessage:", error);

    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unexpected error occurred while communicating with the AI service.");
  }
}

export async function editImageWithPrompt(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 60000);

  try {
    const storedKeys = getStoredApiKeys();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (storedKeys.geminiApiKey) {
      headers["x-gemini-api-key"] = storedKeys.geminiApiKey;
      headers["Authorization"] = `Bearer ${storedKeys.geminiApiKey}`;
    }

    const response = await fetch("/api/gemini/edit-image", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        base64Image,
        mimeType,
        prompt,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.imageB64) {
      throw new Error(
        data?.error?.message || "Image transformation service is temporarily unavailable. Please try again."
      );
    }

    return data.imageB64;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort =
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('signal is aborted') ||
      controller.signal.aborted;

    if (isAbort) {
      throw new Error("Image transformation timed out. Please retry.");
    }
    console.error("Error calling Gemini API for image edit:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred while contacting the Gemini API.");
  }
}

export async function upscaleImageWithGemini(base64Image: string, mimeType: string = 'image/png'): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 60000);

  try {
    const storedKeys = getStoredApiKeys();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (storedKeys.geminiApiKey) {
      headers["x-gemini-api-key"] = storedKeys.geminiApiKey;
      headers["Authorization"] = `Bearer ${storedKeys.geminiApiKey}`;
    }

    const response = await fetch("/api/gemini/upscale", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        base64Image,
        mimeType,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.imageB64) {
      throw new Error(
        data?.error?.message || "AI Upscaling service is busy or timed out. Please retry in a moment."
      );
    }

    return data.imageB64;
  } catch (error: any) {
    clearTimeout(timeoutId);
    const isAbort =
      error?.name === 'AbortError' ||
      error?.message?.includes('aborted') ||
      error?.message?.includes('signal is aborted') ||
      controller.signal.aborted;

    if (isAbort) {
      throw new Error("AI 4K Upscale timed out. Please retry.");
    }
    console.error("Error upscaling image with Gemini:", error);
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred while upscaling the image.");
  }
}

export const upscaleImageWithAI = upscaleImageWithGemini;

export async function enhancePromptWithAI(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 30000);

  try {
    const storedKeys = getStoredApiKeys();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (storedKeys.geminiApiKey) {
      headers["x-gemini-api-key"] = storedKeys.geminiApiKey;
      headers["Authorization"] = `Bearer ${storedKeys.geminiApiKey}`;
    }

    const response = await fetch("/api/gemini/enhance-prompt", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        prompt: userPrompt,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok || !data.enhancedPrompt) {
      return userPrompt;
    }

    return data.enhancedPrompt;
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn("Prompt enhance fallback triggered:", error?.message || error);
    return userPrompt;
  }
}

export async function generateSocialCaptionAndHashtags(imagePrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {
      // ignore
    }
  }, 30000);

  try {
    const storedKeys = getStoredApiKeys();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (storedKeys.geminiApiKey) {
      headers["x-gemini-api-key"] = storedKeys.geminiApiKey;
      headers["Authorization"] = `Bearer ${storedKeys.geminiApiKey}`;
    }

    const response = await fetch("/api/gemini/social-caption", {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        imagePrompt,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    return data.caption || "Transformed scene with Metfa Social Studio. ✨ #MetfaSocial #AIArtwork #DigitalArt #GenerativeArt";
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.warn("Social caption generation fallback triggered:", error?.message || error);
    return `Transformed scene with Metfa Social Studio. ✨ #MetfaSocial #AIArtwork #DigitalArt #GenerativeArt`;
  }
}
