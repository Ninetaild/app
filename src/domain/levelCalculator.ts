import { LevelInfo } from '../types';

/**
 * 저축 게임 랭크 계산.
 * 매년 1월 1일 기준으로 해당 연도의 저축액만 XP에 반영하므로 랭크가 연 단위로 초기화된다.
 * 1,000원 저축 = 1 XP.
 */
const RANKS = [
  { level: 1, requiredXp: 0, title: '언랭크' },
  { level: 2, requiredXp: 100, title: '브론즈' },
  { level: 3, requiredXp: 300, title: '실버' },
  { level: 4, requiredXp: 600, title: '골드' },
  { level: 5, requiredXp: 1000, title: '플래티넘' },
  { level: 6, requiredXp: 2000, title: '다이아몬드' },
  { level: 7, requiredXp: 5000, title: '마스터' },
];

export class LevelCalculator {
  static savingsToXp(amount: number): number {
    if (amount <= 0) return 0;
    return Math.floor(amount / 1000);
  }

  /** 해당 연도 저축액만 전달하면 매년 1월 1일부터 다시 언랭크에서 시작한다. */
  static calculateLevelInfo(annualSavings: number): LevelInfo {
    const totalXp = this.savingsToXp(annualSavings);
    let current = RANKS[0];
    let next = RANKS[1];

    for (let i = 0; i < RANKS.length; i += 1) {
      if (totalXp >= RANKS[i].requiredXp) {
        current = RANKS[i];
        next = RANKS[i + 1] ?? RANKS[i];
      } else {
        break;
      }
    }

    const startXp = current.requiredXp;
    const nextXp = next === current ? current.requiredXp + 5000 : next.requiredXp;
    const xpGained = Math.max(0, totalXp - startXp);
    const xpSpan = Math.max(1, nextXp - startXp);

    return {
      level: current.level,
      totalXp,
      currentLevelXp: xpGained,
      xpForNextLevel: xpSpan,
      levelProgressRatio: Math.min(1, xpGained / xpSpan),
      title: current.title,
      totalAccumulatedSavings: annualSavings,
    };
  }

  static getCharacterMessage(progressRatio: number): { message: string; mood: 'calm' | 'happy' | 'excited' | 'cheering' | 'celebrating' } {
    const percent = Math.round(progressRatio * 100);
    if (percent < 30) return { message: '천천히 시작해 봐요. 첫 걸음이 가장 중요해요! 🥕', mood: 'calm' };
    if (percent < 60) return { message: '잘 모으고 있어요. 차곡차곡 쌓이고 있네요! 🪙', mood: 'happy' };
    if (percent < 90) return { message: '거의 다 왔어요! 조금만 더 힘내볼까요? ✨', mood: 'cheering' };
    if (percent < 100) return { message: '조금만 더! 다음 랭크가 바로 눈앞이에요! 🏃💨', mood: 'excited' };
    return { message: '이번 랭크 달성! 정말 대단해요! 🎉🎈', mood: 'celebrating' };
  }

  static suggestNextMonthGoal(previousAchievedTarget: number): number {
    return previousAchievedTarget + 50000;
  }
}
