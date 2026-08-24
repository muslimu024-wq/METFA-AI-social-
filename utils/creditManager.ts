export interface DailyCreditsData {
  date: string; // YYYY-MM-DD
  remainingCredits: number;
  totalEarnedToday: number;
  adsWatchedToday: number;
}

export interface UseCreditResult {
  success: boolean;
  creditsData: DailyCreditsData;
}

const STORAGE_KEY = 'ai_scene_transformer_daily_credits';
const DEFAULT_DAILY_FREE_PROMPTS = 10;

export const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getDailyCreditsData = (): DailyCreditsData => {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.date === today && typeof data.remainingCredits === 'number') {
        return {
          date: data.date,
          remainingCredits: Math.max(0, data.remainingCredits),
          totalEarnedToday: data.totalEarnedToday ?? DEFAULT_DAILY_FREE_PROMPTS,
          adsWatchedToday: data.adsWatchedToday ?? 0,
        };
      }
    }
  } catch (err) {
    console.error('Failed to parse credits data from localStorage:', err);
  }

  const initialData: DailyCreditsData = {
    date: today,
    remainingCredits: DEFAULT_DAILY_FREE_PROMPTS,
    totalEarnedToday: DEFAULT_DAILY_FREE_PROMPTS,
    adsWatchedToday: 0,
  };
  saveDailyCreditsData(initialData);
  return initialData;
};

export const getDailyCredits = getDailyCreditsData;

export const saveDailyCreditsData = (data: DailyCreditsData): void => {
  try {
    const safeData: DailyCreditsData = {
      date: data.date || getTodayDateString(),
      remainingCredits: typeof data.remainingCredits === 'number' ? Math.max(0, data.remainingCredits) : DEFAULT_DAILY_FREE_PROMPTS,
      totalEarnedToday: typeof data.totalEarnedToday === 'number' ? data.totalEarnedToday : DEFAULT_DAILY_FREE_PROMPTS,
      adsWatchedToday: typeof data.adsWatchedToday === 'number' ? data.adsWatchedToday : 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeData));
    window.dispatchEvent(new CustomEvent('metfa_credits_updated', { detail: safeData }));
    window.dispatchEvent(new CustomEvent('ai_credits_updated', { detail: safeData }));
  } catch (err) {
    console.error('Failed to save credits data to localStorage:', err);
  }
};

export const useCredit = (): UseCreditResult => {
  const current = getDailyCreditsData();
  if (current.remainingCredits <= 0) {
    return {
      success: false,
      creditsData: current,
    };
  }
  const updated: DailyCreditsData = {
    ...current,
    remainingCredits: Math.max(0, current.remainingCredits - 1),
  };
  saveDailyCreditsData(updated);
  return {
    success: true,
    creditsData: updated,
  };
};

export const consumeCredit = (): DailyCreditsData => {
  const res = useCredit();
  return res.creditsData;
};

export const addCredits = (amount: number): DailyCreditsData => {
  const current = getDailyCreditsData();
  const updated: DailyCreditsData = {
    ...current,
    remainingCredits: current.remainingCredits + amount,
    totalEarnedToday: current.totalEarnedToday + amount,
    adsWatchedToday: current.adsWatchedToday + 1,
  };
  saveDailyCreditsData(updated);
  return updated;
};

export const addRewardCredits = addCredits;

export const resetTodayCreditsForTesting = (customCredits = DEFAULT_DAILY_FREE_PROMPTS): DailyCreditsData => {
  const today = getTodayDateString();
  const resetData: DailyCreditsData = {
    date: today,
    remainingCredits: customCredits,
    totalEarnedToday: customCredits,
    adsWatchedToday: 0,
  };
  saveDailyCreditsData(resetData);
  return resetData;
};
