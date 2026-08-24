import { ChatAttachment, StudioSettings } from "../types/chat";

export interface MultimodalResponse {
  text: string;
  generatedImageB64?: string;
  isImageGeneration?: boolean;
  modelUsed?: string;
  isFallback?: boolean;
  latencyMs?: number;
}

export async function sendMultimodalMessage(
  prompt: string,
  attachments: ChatAttachment[] = [],
  settingsOrHistory?: Partial<StudioSettings> | Array<{ role: 'user' | 'assistant'; content: string }>,
  maybeHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<MultimodalResponse> {
  // 26-second client timeout ensures the client never hangs indefinitely while allowing server retry logic
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 26000);

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

    const response = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        prompt,
        attachments,
        settings,
        history,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 503 || data?.error?.code === 'SERVICE_UNAVAILABLE_OR_TIMEOUT') {
        throw new Error(
          data?.error?.message ||
          "Gemini models are currently under heavy load or timed out after multiple automatic retries. Please click 'Try Again' in a moment."
        );
      }
      const errMsg = data?.error?.message || `Request failed with status ${response.status}`;
      throw new Error(errMsg);
    }

    return {
      text: data.text || "Response received.",
      generatedImageB64: data.generatedImageB64,
      isImageGeneration: !!data.isImageGeneration,
      modelUsed: data.modelUsed,
      isFallback: data.isFallback,
      latencyMs: data.latencyMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error in sendMultimodalMessage:", error);

    if (error.name === 'AbortError') {
      throw new Error(
        "Request timed out. The server was busy and did not respond in time. Please tap 'Try Again' to retry."
      );
    }

    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unexpected error occurred while communicating with Gemini.");
  }
}

export async function editImageWithPrompt(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 26000);

  try {
    const response = await fetch("/api/gemini/edit-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        base64Image,
        mimeType,
        prompt,
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
    console.error("Error calling Gemini API for image edit:", error);
    if (error.name === 'AbortError') {
      throw new Error("Image transformation timed out. Please retry.");
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred while contacting the Gemini API.");
  }
}

export async function upscaleImageWithGemini(base64Image: string, mimeType: string = 'image/png'): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 26000);

  try {
    const response = await fetch("/api/gemini/upscale", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        base64Image,
        mimeType,
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
    console.error("Error upscaling image with Gemini:", error);
    if (error.name === 'AbortError') {
      throw new Error("AI 4K Upscale timed out. Please retry.");
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred while upscaling the image.");
  }
}

export const upscaleImageWithAI = upscaleImageWithGemini;

export async function enhancePromptWithAI(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("/api/gemini/enhance-prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        prompt: userPrompt,
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
    console.error("Error enhancing prompt with Gemini:", error);
    return userPrompt;
  }
}

export async function generateSocialCaptionAndHashtags(imagePrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("/api/gemini/social-caption", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        imagePrompt,
      }),
    });

    clearTimeout(timeoutId);
    const data = await response.json().catch(() => ({}));
    return data.caption || "Transformed scene with Metfa AI Studio. ✨ #MetfaAI #AIArtwork #DigitalArt #GenerativeArt";
  } catch (error: any) {
    clearTimeout(timeoutId);
    console.error("Error generating social caption with Gemini:", error);
    return `Transformed scene with Metfa AI Studio. ✨ #MetfaAI #AIArtwork #DigitalArt #GenerativeArt`;
  }
}

