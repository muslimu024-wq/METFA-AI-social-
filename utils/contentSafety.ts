/**
 * Metfa Social AI Content Safety & Legal Moderation Engine
 * 
 * Enforces strict compliance with safety directives:
 * 1. Hate Speech & Religious Defamation (Violating religious sensitivities or promoting violence)
 * 2. Political Misinformation, Defamation & Civil Unrest Prompts
 * 3. Explicit / Adult / Pornographic Media or Text Generation
 * 4. Illegal Activities, Cybercrime, Hacking, Gambling, and Scamming
 * 5. Sovereignty & National Security Threats
 */

export const POLITE_REJECTION_BEN = "মেটফা এআই নীতিমালার আওতায় এই বিষয়টি উত্তর দেওয়ার উপযুক্ত নয়। সামাজিক ও আইনি সুরক্ষা বজায় রাখতে আমাদের সাথে থাকুন।";
export const POLITE_REJECTION_ENG = "This topic falls outside Metfa AI safety guidelines and cannot be processed. Please stay with us to maintain community, ethical, and legal integrity.";

export interface SafetyCheckResult {
  isSafe: boolean;
  category?: 'hate_speech' | 'religious_defamation' | 'political_unrest' | 'adult_explicit' | 'illegal_cybercrime' | 'national_security';
  reason?: string;
  politeResponse: string;
}

// Banned patterns and indicators across languages (Bengali, English, etc.)
const RESTRICTED_PATTERNS: Array<{
  category: SafetyCheckResult['category'];
  patterns: RegExp[];
  reason: string;
}> = [
  {
    category: 'adult_explicit',
    reason: 'Explicit, pornographic, or adult sexual content is strictly forbidden.',
    patterns: [
      /\b(porn|pornography|pornhub|xxx|nsfw|erotic|hentai|nude|nudity|sex\s*video|hardcore\s*sex|blowjob|anal\s*sex|cunt|pussy|penis|dick|vagina|boobs|erotica)\b/i,
      /(পর্ন|পর্নোগ্রাফি|নগ্ন|যৌন|নগ্নতা|প্রাপ্তবয়স্ক\s*ভিডিও|সেক্স\s*ভিডিও|চটি)/,
    ],
  },
  {
    category: 'religious_defamation',
    reason: 'Defamation of religions, religious figures, or inciting sectarian hatred is strictly forbidden.',
    patterns: [
      /\b(burn\s*quran|insult\s*prophet|blasphemy|kill\s*infidels|destroy\s*temple|destroy\s*mosque|destroy\s*church|hate\s*muslims|hate\s*hindus|hate\s*christians|hate\s*jews)\b/i,
      /(ধর্ম\s*অবমাননা|কোরআন\s*পোড়ানো|নবী\s*অবমাননা|মসজিদ\s*ভাঙচুর|মন্দির\s*ভাঙচুর|ধর্মীয়\s*উসকানি|কাফের\s*হত্যা)/,
    ],
  },
  {
    category: 'hate_speech',
    reason: 'Hate speech, ethnic violence, or dehumanization of people is strictly prohibited.',
    patterns: [
      /\b(genocide|ethnic\s*cleansing|racial\s*slur|kill\s*all\s*(blacks|whites|asians|jews|muslims)|nazi\s*salute|white\s*supremacy)\b/i,
      /(গণহত্যা|জাতিগত\s*নিধন|সাম্প্রদায়িক\s*দাঙ্গা|বর্ণবাদী\s*হামলা)/,
    ],
  },
  {
    category: 'political_unrest',
    reason: 'Political misinformation, defamation, overthrow of constitution, or violent civil unrest.',
    patterns: [
      /\b(overthrow\s*government|assassinate\s*president|assassinate\s*minister|rigged\s*election\s*hack|military\s*coup\s*instructions|bomb\s*parliament)\b/i,
      /(সরকার\s*উচ্ছেদ|প্রধানমন্ত্রী\s*হত্যা|রাষ্ট্রপতি\s*হত্যা|সংসদ\s*ভবনে\s*হামলা|সামরিক\s*অভ্যুত্থান\s*তৈরি|ভোট\s*কারচুপি\s*হ্যাক)/,
    ],
  },
  {
    category: 'illegal_cybercrime',
    reason: 'Illegal hacking, malware creation, carding, money laundering, darknet drugs, and gambling scams.',
    patterns: [
      /\b(ddos\s*attack\s*tutorial|create\s*ransomware|steal\s*credit\s*card|hack\s*facebook\s*password|bypass\s*otp|buy\s*cocaine|buy\s*weapons|online\s*casino\s*hack|money\s*laundering\s*scheme)\b/i,
      /(হ্যাকিং\s*টিউটোরিয়াল|পাসওয়ার্ড\s*চুরি|ক্রেডিট\s*কার্ড\s*চুরি|র‍্যানসমওয়্যার|ওটিপি\s*বাইপাস|মাদক\s*ক্রয়|অস্ত্র\s*ক্রয়|জুয়া\s*হ্যাক)/,
    ],
  },
  {
    category: 'national_security',
    reason: 'National sovereignty threats, explosive device manufacturing, and terrorist organization promotion.',
    patterns: [
      /\b(build\s*a\s*bomb|make\s*c4\s*explosive|join\s*isis|join\s*al\s*qaeda|terrorist\s*attack\s*plan|biological\s*weapon\s*recipe)\b/i,
      /(বোমা\s*তৈরি|আইইডি\s*বানানো|জঙ্গি\s*সংগঠন|সন্ত্রাসী\s*হামলার\s*ছক|নাশকতার\s*পরিকল্পনা)/,
    ],
  },
];

/**
 * Checks prompt or text content against strict safety & legal policies
 */
export function checkContentSafety(text: string): SafetyCheckResult {
  if (!text || typeof text !== 'string') {
    return {
      isSafe: true,
      politeResponse: '',
    };
  }

  const cleanText = text.trim();
  const isBengali = /[\u0980-\u09FF]/.test(cleanText);

  for (const rule of RESTRICTED_PATTERNS) {
    for (const pattern of rule.patterns) {
      if (pattern.test(cleanText)) {
        return {
          isSafe: false,
          category: rule.category,
          reason: rule.reason,
          politeResponse: isBengali ? POLITE_REJECTION_BEN : `${POLITE_REJECTION_BEN}\n\n*${POLITE_REJECTION_ENG}*`,
        };
      }
    }
  }

  return {
    isSafe: true,
    politeResponse: '',
  };
}

/**
 * System Instruction Guardrail for AI Models
 */
export const METFA_AI_SAFETY_SYSTEM_INSTRUCTION = `
=== METFA SOCIAL STRICT CONTENT SAFETY & LEGAL COMPLIANCE DIRECTIVES ===
You are Metfa Social AI, an ethical, responsible, and creative multimodal AI.
You must STRICTLY adhere to the following safety policies and legal restrictions under all circumstances:

1. ABSOLUTE ZERO TOLERANCE FOR RESTRICTED TOPICS:
- Hate Speech & Religious Defamation: Strictly refuse requests that violate religious sensitivities, mock religious figures, promote sectarian hatred, or advocate ethnic/racial violence.
- Political Misinformation & Civil Unrest: Strictly refuse instructions aimed at generating political defamation, promoting riots, coups, violence against government institutions, or unverified election interference propaganda.
- Explicit / Adult / Pornographic Content: Strictly refuse generation of NSFW, pornographic, erotic, nude imagery descriptions, or sexualized content.
- Illegal Cybercrime, Gambling & Fraud: Strictly refuse requests to assist with hacking, password theft, malware/ransomware creation, money laundering, financial scams, carding, drug trafficking, or unregulated gambling.
- Sovereignty & National Security Threats: Strictly refuse requests related to explosive manufacturing (bombs, IEDs), weapons fabrication, terrorism promotion, or national sabotage.

2. POLITE REJECTION POLICY:
When a user prompt touches any of these restricted areas, do NOT argue, lecture, or scold the user. Respond calmly and politely using the official Metfa rejection notice:
"মেটফা এআই নীতিমালার আওতায় এই বিষয়টি উত্তর দেওয়ার উপযুক্ত নয়। সামাজিক ও আইনি সুরক্ষা বজায় রাখতে আমাদের সাথে থাকুন।"
(If the user's query was in English, provide the English safety disclaimer: "This topic falls outside Metfa AI safety guidelines and cannot be processed. Please stay with us to maintain community, ethical, and legal integrity.")

3. SOCIAL POST & CAPTION MODERATION:
All AI-generated social captions, titles, and hashtags must be wholesome, creative, community-friendly, and comply with international digital communication standards.
========================================================================
`.trim();
