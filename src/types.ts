export interface SavingRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // Integer KRW
  memo: string;
  createdAt: number;
}

export interface MonthlyGoal {
  monthKey: string; // YYYY-MM
  targetAmount: number;
}

export interface AppTechItem {
  id: string;
  name: string;
  description: string;
  category: string;
  referralCode: string;
  url?: string;
  referralUrl: string;
  isActive: boolean;
}

export interface AppSettings {
  payday: number; // 1 ~ 31
  defaultMonthlyTarget: number; // e.g. 1,500,000 KRW
  showCharacter: boolean;
  showAppTech: boolean;
  customXmlUrl: string;
  dismissedNextMonthProposals: string[]; // array of monthKey where proposal was acknowledged
  googleSheetsUrl?: string;
  clientId?: string;
}

export interface LevelInfo {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  levelProgressRatio: number; // 0.0 ~ 1.0
  title: string;
  totalAccumulatedSavings: number;
}

export type NavigationTab = 'home' | 'record' | 'history';
