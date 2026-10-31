import { buildTasteReport, type TasteProduct, type TasteReport, type TasteSignals } from '../domain/tasteReport.js';

export interface TasteRepository {
  /** 회원의 좋아요 / 완료한 월드컵 우승 / 별점 4점 이상 한 줄 평 */
  signals(userId: number): Promise<TasteSignals>;
  /** 추천 후보: 판매 중인 버거 */
  candidates(): Promise<TasteProduct[]>;
}

export const createGetTasteReport = (repository: TasteRepository) =>
  async (userId: number): Promise<TasteReport> => {
    const [signals, candidates] = await Promise.all([repository.signals(userId), repository.candidates()]);
    return buildTasteReport(signals, candidates);
  };
