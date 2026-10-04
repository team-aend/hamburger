export interface ProductReview {
  id: number;
  productId: number;
  userId: number | null;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface ReviewSummaryItem {
  averageRating: number;
  totalCount: number;
}

export type ReviewsSummaryMap = Record<number, ReviewSummaryItem>;
