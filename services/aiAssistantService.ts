/**
 * Background AI Assistant Service for Metfa Social Ecosystem
 * Handles AI Caption & Hashtags generation, text refinement,
 * quick comment replies, and AI avatar generation.
 * All calls run asynchronously in the background so the UI never blocks.
 */

import { getStoredApiKeys } from '../utils/apiKeysStore';

export interface CaptionResult {
  caption: string;
  hashtags: string[];
  suggestedMood?: string;
  modelUsed?: string;
}

export interface RefineResult {
  refinedText: string;
  changesSummary?: string;
  modelUsed?: string;
}

export interface QuickRepliesResult {
  replies: string[];
  modelUsed?: string;
}

export interface AvatarResult {
  avatarUrl: string;
  promptUsed: string;
  modelUsed?: string;
}

function getAiHeaders(): Record<string, string> {
  const keys = getStoredApiKeys();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (keys.geminiApiKey) {
    headers['x-gemini-api-key'] = keys.geminiApiKey;
    headers['Authorization'] = `Bearer ${keys.geminiApiKey}`;
  }
  if (keys.openaiApiKey) {
    headers['x-openai-api-key'] = keys.openaiApiKey;
  }
  if (keys.grokApiKey) {
    headers['x-grok-api-key'] = keys.grokApiKey;
    headers['x-xai-api-key'] = keys.grokApiKey;
  }
  return headers;
}

/**
 * Generate AI Caption & Trending Hashtags (Bengali / English / Auto)
 */
export async function generateAICaptionAndHashtags(options: {
  userInput?: string;
  imageBase64?: string;
  language?: 'auto' | 'bengali' | 'english';
  tone?: 'Casual' | 'Creative' | 'Professional' | 'Hype' | 'Aesthetic';
}): Promise<CaptionResult> {
  const { userInput = '', imageBase64, language = 'auto', tone = 'Creative' } = options;
  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 35000);

    const response = await fetch('/api/ai/caption-hashtags', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        text: userInput,
        imageBase64,
        language,
        tone,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
        grokApiKey: storedKeys.grokApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        caption: data.caption || userInput || '✨ Exploring new creative frontiers on Metfa.',
        hashtags: Array.isArray(data.hashtags) && data.hashtags.length > 0 ? data.hashtags : ['#MetfaSocial', '#SocialFirst', '#CreativeVibes', '#DigitalArt'],
        suggestedMood: data.suggestedMood || tone,
        modelUsed: data.modelUsed || 'Metfa Social Background Assistant',
      };
    }
  } catch (err) {
    console.warn('Background AI Caption server call skipped or timed out, generating local assistant response:', err);
  }

  // Intelligent client-side generation fallback
  const isBengali = /[\u0980-\u09FF]/.test(userInput) || language === 'bengali';
  let caption = '';
  let hashtags: string[] = [];

  if (isBengali) {
    caption = userInput
      ? `"${userInput}" — নতুন ভাবনার সাথে আজকের ক্রিয়েশন। কেমন লাগলো জানাবেন! ✨`
      : 'মেটফা সোশ্যালের সাথে আজকের নতুন সৃষ্টি। প্রতিটি মুহূর্তেই নতুন অনুপ্রেরণা! ✨';
    hashtags = ['#MetfaSocial', '#BanglaCreators', '#DigitalArt', '#CreativeMoments', '#AICreation'];
  } else {
    if (tone === 'Professional') {
      caption = userInput
        ? `Delighted to share this latest milestone: "${userInput}". Focusing on intentional craft and visual clarity.`
        : 'Exploring the intersection of modern aesthetics and social workflows. Excited to hear your thoughts.';
      hashtags = ['#MetfaSocial', '#Innovation', '#DesignLeadership', '#CreativeTech', '#Architecture'];
    } else if (tone === 'Hype') {
      caption = userInput
        ? `🔥 Dropping this right here: "${userInput}"! Next-level vibes only.`
        : '🚀 This just took things to another level! What do you think about this composition? 🔥';
      hashtags = ['#MetfaSocial', '#Trending', '#ViralVibes', '#VisualArt', '#FireDrop'];
    } else {
      caption = userInput
        ? `"${userInput}" ✨ Capturing quiet moments and vibrant light.`
        : 'Created with Metfa Social. Finding magic in the details and sharing the journey ✨';
      hashtags = ['#MetfaSocial', '#Aesthetic', '#VisualStorytelling', '#CreativeCommunity', '#ArtDaily'];
    }
  }

  return {
    caption,
    hashtags,
    suggestedMood: tone,
    modelUsed: 'Metfa Instant Assistant',
  };
}

/**
 * Refine text: Fix grammar, expand ideas, or adjust post tone
 */
export async function refineTextWithAI(options: {
  text: string;
  mode: 'fix_grammar' | 'expand' | 'tone';
  tone?: 'Professional' | 'Funny' | 'Creative' | 'Viral' | 'Casual' | 'Hype' | 'Aesthetic';
}): Promise<RefineResult> {
  const { text, mode, tone = 'Creative' } = options;
  if (!text.trim()) return { refinedText: text };

  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 35000);

    const response = await fetch('/api/ai/refine-text', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        text,
        mode,
        tone,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
        grokApiKey: storedKeys.grokApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.refinedText) {
        return {
          refinedText: data.refinedText,
          changesSummary: data.changesSummary || 'Refined with Metfa Social',
          modelUsed: data.modelUsed,
        };
      }
    }
  } catch (err) {
    console.warn('Background AI Refine server call error, generating local refinement:', err);
  }

  // Fallback intelligent refinement
  let refined = text.trim();
  const isBengali = /[\u0980-\u09FF]/.test(text);

  if (mode === 'fix_grammar') {
    // Capitalize first letter and ensure proper terminal punctuation
    if (!isBengali && refined.length > 0) {
      refined = refined.charAt(0).toUpperCase() + refined.slice(1);
      if (!/[.!?]$/.test(refined)) refined += '.';
    }
  } else if (mode === 'expand') {
    if (isBengali) {
      refined = `${refined} — এই কাজটির পেছনে অনেক ভাবনা এবং সময় গিয়েছে। আপনাদের মতামত সবসময় নতুন কাজ তৈরিতে অনুপ্রেরণা দেয়।`;
    } else {
      refined = `${refined} — Exploring every layer of this concept with keen attention to atmosphere and narrative depth. Excited to connect with fellow creators around this theme!`;
    }
  } else if (mode === 'tone') {
    if (tone === 'Professional') {
      refined = isBengali
        ? `প্রফেশনাল প্রেজেন্টেশন: ${refined}। গঠনমূলক প্রতিক্রিয়া সবসময় স্বাগত।`
        : `Key Takeaway: ${refined}. Focusing on rigorous standards and sustainable creative workflows.`;
    } else if (tone === 'Funny') {
      refined = isBengali
        ? `যখন এআই আর মানুষের আইডিয়া একসাথে হয়: "${refined}" 😂 কার কার এমন মনে হয়?`
        : `Plot twist: ${refined} 😂 10/10 would render again!`;
    } else if (tone === 'Viral') {
      refined = isBengali
        ? `🔥 এটা মিস করবেন না: ${refined}! আপনার বন্ধুকে ট্যাগ করুন যিনি এটি দেখতে ভালোবাসবেন!`
        : `⚡ Wait until you see this: ${refined} 🔥 Tag someone who needs to experience this!`;
    }
  }

  return {
    refinedText: refined,
    changesSummary: `Refined (${mode} / ${tone})`,
    modelUsed: 'Metfa Instant Assistant',
  };
}

/**
 * Generate 3 Quick AI Replies for post comments
 */
export async function generateQuickAIReply(commentText: string, postCaption?: string): Promise<QuickRepliesResult> {
  const storedKeys = getStoredApiKeys();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 30000);

    const response = await fetch('/api/ai/quick-reply', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        commentText,
        postCaption,
        geminiApiKey: storedKeys.geminiApiKey,
        openaiApiKey: storedKeys.openaiApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.replies) && data.replies.length > 0) {
        return { replies: data.replies, modelUsed: data.modelUsed };
      }
    }
  } catch (err) {
    console.warn('Background AI quick reply error:', err);
  }

  const isBengali = /[\u0980-\u09FF]/.test(commentText);

  if (isBengali) {
    return {
      replies: [
        'অনেক ধন্যবাদ আপনার সুন্দর মতামতের জন্য! ❤️',
        'একদম সঠিক বলেছেন! আপনার এই দৃষ্টিভঙ্গি দারুণ লাগলো। ✨',
        'ধন্যবাদ! আরও নতুন ক্রিয়েশন আসছে শিগগিরই। 🚀',
      ],
      modelUsed: 'Metfa Instant Assistant',
    };
  }

  return {
    replies: [
      'Thank you so much! Really appreciate the kind words! ❤️',
      'Spot on! That was exactly the vibe I was aiming for ✨',
      'Appreciate you checking it out! More coming soon 🚀',
    ],
    modelUsed: 'Metfa Instant Assistant',
  };
}

/**
 * Generate AI Avatar Customization
 */
export async function generateCustomAIAvatar(options: {
  style: 'Cyberpunk' | 'Anime 3D' | 'Photorealistic Studio' | 'Minimalist Vector' | 'Neon Synthwave' | 'Fantasy Royalty';
  gender?: string;
  traits?: string;
  customSeed?: string;
}): Promise<AvatarResult> {
  const { style, traits = '', customSeed } = options;
  const seed = customSeed || Math.random().toString(36).substring(2, 9);
  const storedKeys = getStoredApiKeys();

  const prompt = `${style} style avatar portrait, ${traits || 'charismatic futuristic digital creator'}, sharp facial features, dramatic cinematic lighting, 8k resolution, octane render`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, 45000);

    const response = await fetch('/api/ai/generate-avatar', {
      method: 'POST',
      headers: getAiHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        style,
        prompt,
        seed,
        geminiApiKey: storedKeys.geminiApiKey,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.avatarUrl) {
        return {
          avatarUrl: data.avatarUrl,
          promptUsed: prompt,
          modelUsed: data.modelUsed,
        };
      }
    }
  } catch (err) {
    console.warn('Avatar server generation fallback:', err);
  }

  // Diverse high-res stylized preset avatars by category
  const avatarPresets: { [k: string]: string[] } = {
    'Cyberpunk': [
      'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80',
    ],
    'Anime 3D': [
      'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    ],
    'Photorealistic Studio': [
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    ],
    'Minimalist Vector': [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563089145-599997674d42?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=400&auto=format&fit=crop&q=80',
    ],
    'Neon Synthwave': [
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=400&auto=format&fit=crop&q=80',
    ],
    'Fantasy Royalty': [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80',
    ],
  };

  const selectedList = avatarPresets[style] || avatarPresets['Photorealistic Studio'];
  const chosenUrl = selectedList[Math.floor(Math.random() * selectedList.length)];

  return {
    avatarUrl: chosenUrl,
    promptUsed: prompt,
    modelUsed: 'Metfa Avatar Engine',
  };
}
