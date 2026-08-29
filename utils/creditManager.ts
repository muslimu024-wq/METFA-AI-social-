export interface DailyCreditsData {
  userId?: string;
  date: string; // YYYY-MM-DD
  remainingCredits: number;
  totalEarnedToday: number;
  adsWatchedToday: number;
  usedToday?: number;
}

export interface UseCreditResult {
  success: boolean;
  creditsData: DailyCreditsData;
}

const DEFAULT_DAILY_FREE_PROMPTS = 10;

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getStorageKey = (userId?: string): string => {
  if (userId && userId.trim()) {
    return `metfa_credits_${userId.trim()}`;
  }
  return 'ai_scene_transformer_daily_credits';
};

export const getDailyCreditsData = (userId?: string): DailyCreditsData => {
  const today = getTodayDateString();
  const key = getStorageKey(userId);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.date === today && typeof data.remainingCredits === 'number') {
        return {
          userId: userId || data.userId || 'user_default',
          date: data.date,
          remainingCredits: Math.max(0, data.remainingCredits),
          totalEarnedToday: data.totalEarnedToday ?? DEFAULT_DAILY_FREE_PROMPTS,
          adsWatchedToday: data.adsWatchedToday ?? 0,
          usedToday: data.usedToday ?? Math.max(0, (data.totalEarnedToday ?? DEFAULT_DAILY_FREE_PROMPTS) - data.remainingCredits),
        };
      }
    }
  } catch (err) {
    console.error('Failed to parse credits data from localStorage:', err);
  }

  const initialData: DailyCreditsData = {
    userId: userId || 'user_default',
    date: today,
    remainingCredits: DEFAULT_DAILY_FREE_PROMPTS,
    totalEarnedToday: DEFAULT_DAILY_FREE_PROMPTS,
    adsWatchedToday: 0,
    usedToday: 0,
  };
  saveDailyCreditsData(initialData, userId);
  return initialData;
};

export const getDailyCredits = getDailyCreditsData;

export const saveDailyCreditsData = (data: DailyCreditsData, userId?: string): void => {
  try {
    const targetUserId = userId || data.userId;
    const key = getStorageKey(targetUserId);
    const safeData: DailyCreditsData = {
      userId: targetUserId || 'user_default',
      date: data.date || getTodayDateString(),
      remainingCredits: typeof data.remainingCredits === 'number' ? Math.max(0, data.remainingCredits) : DEFAULT_DAILY_FREE_PROMPTS,
      totalEarnedToday: typeof data.totalEarnedToday === 'number' ? data.totalEarnedToday : DEFAULT_DAILY_FREE_PROMPTS,
      adsWatchedToday: typeof data.adsWatchedToday === 'number' ? data.adsWatchedToday : 0,
      usedToday: typeof data.usedToday === 'number' ? data.usedToday : 0,
    };
    localStorage.setItem(key, JSON.stringify(safeData));
    localStorage.setItem('ai_scene_transformer_daily_credits', JSON.stringify(safeData)); // sync global key
    window.dispatchEvent(new CustomEvent('metfa_credits_updated', { detail: safeData }));
    window.dispatchEvent(new CustomEvent('ai_credits_updated', { detail: safeData }));
  } catch (err) {
    console.error('Failed to save credits data to localStorage:', err);
  }
};

export const useCredit = (userId?: string): UseCreditResult => {
  const current = getDailyCreditsData(userId);
  if (current.remainingCredits <= 0) {
    return {
      success: false,
      creditsData: current,
    };
  }
  const updated: DailyCreditsData = {
    ...current,
    remainingCredits: Math.max(0, current.remainingCredits - 1),
    usedToday: (current.usedToday || 0) + 1,
  };
  saveDailyCreditsData(updated, userId);
  return {
    success: true,
    creditsData: updated,
  };
};

export const consumeCredit = (userId?: string): DailyCreditsData => {
  const res = useCredit(userId);
  return res.creditsData;
};

export const addCredits = (amount: number, userId?: string): DailyCreditsData => {
  const current = getDailyCreditsData(userId);
  const updated: DailyCreditsData = {
    ...current,
    remainingCredits: current.remainingCredits + amount,
    totalEarnedToday: current.totalEarnedToday + amount,
    adsWatchedToday: current.adsWatchedToday + 1,
  };
  saveDailyCreditsData(updated, userId);
  return updated;
};

export const addRewardCredits = addCredits;

export const resetTodayCreditsForTesting = (customCredits = DEFAULT_DAILY_FREE_PROMPTS, userId?: string): DailyCreditsData => {
  const today = getTodayDateString();
  const resetData: DailyCreditsData = {
    userId: userId || 'user_default',
    date: today,
    remainingCredits: customCredits,
    totalEarnedToday: customCredits,
    adsWatchedToday: 0,
    usedToday: 0,
  };
  saveDailyCreditsData(resetData, userId);
  return resetData;
};
