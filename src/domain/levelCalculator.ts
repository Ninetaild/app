import { LevelInfo } from '../types';

/**
 * LevelCalculator
 * 
 * 저축액을 기반으로 경험치(XP)와 레벨, 캐릭터 피드백 메시지를 계산하는 도메인 로직.
 * 비즈니스 규칙:
 *  - 1,000원 저축 = 1 XP (10,000원 = 10 XP)
 *  - 레벨은 누적 경험치에 따라 단계별로 상승
 */

// 레벨별 누적 필요 XP 기준점
const LEVEL_THRESHOLDS = [
  { level: 1, requiredXp: 0, title: '새싹 저축러 🌱' },
  { level: 2, requiredXp: 100, title: '동전 모으기 입문 🪙' },
  { level: 3, requiredXp: 300, title: '티끌모아 태산 🪨' },
  { level: 4, requiredXp: 600, title: '슬기로운 저축러 💡' },
  { level: 5, requiredXp: 1000, title: '백만원 저축왕 🏆' },
  { level: 6, requiredXp: 1500, title: '통장 지킴이 🛡️' },
  { level: 7, requiredXp: 2200, title: '황금알 수집가 🥚' },
  { level: 8, requiredXp: 3000, title: '알뜰살뜰 마스터 🎖️' },
  { level: 9, requiredXp: 4000, title: '부자 습관 우등생 🌟' },
  { level: 10, requiredXp: 5500, title: '오백만 저축 영웅 👑' },
  { level: 11, requiredXp: 7500, title: '단단한 자산가 💎' },
  { level: 12, requiredXp: 10000, title: '천만 돌파 마스터 🚀' },
  { level: 13, requiredXp: 13000, title: '슈퍼 세이버 ⭐' },
  { level: 14, requiredXp: 17000, title: '저축 신선 🧘' },
  { level: 15, requiredXp: 22000, title: '전설의 자산 메이커 🏰' },
];

export class LevelCalculator {
  /**
   * 저축 금액(원)을 경험치(XP)로 변환 (1,000원 = 1 XP)
   */
  static savingsToXp(amount: number): number {
    if (amount <= 0) return 0;
    return Math.floor(amount / 1000);
  }

  /**
   * 누적 저축 금액을 기반으로 전체 레벨 정보 계산
   */
  static calculateLevelInfo(totalAccumulatedSavings: number): LevelInfo {
    const totalXp = this.savingsToXp(totalAccumulatedSavings);

    let currentLevel = 1;
    let title = LEVEL_THRESHOLDS[0].title;
    let startXpForCurrentLevel = 0;
    let requiredXpForNextLevel = LEVEL_THRESHOLDS[1].requiredXp;

    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
      const current = LEVEL_THRESHOLDS[i];
      const next = LEVEL_THRESHOLDS[i + 1];

      if (totalXp >= current.requiredXp) {
        currentLevel = current.level;
        title = current.title;
        startXpForCurrentLevel = current.requiredXp;

        if (next) {
          requiredXpForNextLevel = next.requiredXp;
        } else {
          // 최고 단계 이상인 경우: 단계당 5,000 XP씩 증가
          requiredXpForNextLevel = current.requiredXp + (currentLevel - LEVEL_THRESHOLDS.length + 1) * 5000;
        }
      } else {
        break;
      }
    }

    const xpGainedInCurrentLevel = Math.max(0, totalXp - startXpForCurrentLevel);
    const xpSpan = Math.max(1, requiredXpForNextLevel - startXpForCurrentLevel);
    const levelProgressRatio = Math.min(1.0, xpGainedInCurrentLevel / xpSpan);

    return {
      level: currentLevel,
      totalXp,
      currentLevelXp: xpGainedInCurrentLevel,
      xpForNextLevel: xpSpan,
      levelProgressRatio,
      title,
      totalAccumulatedSavings,
    };
  }

  /**
   * 저축 진행률(0.0 ~ 1.0+)에 따른 토순이 캐릭터의 응원 메시지 반환
   */
  static getCharacterMessage(progressRatio: number): { message: string; mood: 'calm' | 'happy' | 'excited' | 'cheering' | 'celebrating' } {
    const percent = Math.round(progressRatio * 100);

    if (percent < 30) {
      return {
        message: '천천히 시작해 봐요. 첫 걸음이 가장 중요해요! 🥕',
        mood: 'calm',
      };
    } else if (percent < 60) {
      return {
        message: '잘 모으고 있어요. 차곡차곡 쌓이고 있네요! 🪙',
        mood: 'happy',
      };
    } else if (percent < 90) {
      return {
        message: '거의 다 왔어요! 조금만 더 힘내볼까요? ✨',
        mood: 'cheering',
      };
    } else if (percent < 100) {
      return {
        message: '조금만 더! 목표가 바로 눈앞이에요! 🏃💨',
        mood: 'excited',
      };
    } else {
      return {
        message: '이번 달 목표 달성! 정말 대단해요! 🎉🎈',
        mood: 'celebrating',
      };
    }
  }

  /**
   * 다음 달 저축 목표 제안 금액 계산 (기존 달성 목표 + 50,000원 단위 제안)
   */
  static suggestNextMonthGoal(previousAchievedTarget: number): number {
    // 150만원 달성 시 155만원 제안 (+50,000원)
    const increment = 50000;
    return previousAchievedTarget + increment;
  }
}
