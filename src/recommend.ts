import { cosineSimilarity } from './math';

export interface RecommendOptions {
  R?: number;
  recommendThreshold?: number;
}

export interface PrNeighborTerm {
  product: string;
  productIndex: number;
  rating: number;
  similarity: number;
  /** r_a,j · cos(i,j) */
  weightedRating: number;
}

/** Полный разбор расчёта Pr_a,i */
export interface PrBreakdown {
  user: string;
  userIndex: number;
  product: string;
  productIndex: number;
  R: number;
  neighbors: PrNeighborTerm[];
  numerator: number;
  denominator: number;
  /** нет соседей в K */
  usedFallback: boolean;
  predicted: number;
}

export interface CandidatePrediction {
  product: string;
  productIndex: number;
  predicted: number;
  aboveThreshold: boolean;
  breakdown: PrBreakdown;
}

export interface UserRecommendation {
  user: string;
  userIndex: number;
  coldStart: boolean;
  product: string | null;
  productIndex: number | null;
  predicted: number | null;
  breakdown: PrBreakdown | null;
  candidates: CandidatePrediction[];
  reason: string;
}

export interface ItemBasedResult {
  users: string[];
  products: string[];
  /** Матрица косинусного сходства товаров (диагональ 0) */
  similarity: number[][];
  productMeans: number[];
  maxI: number;
  maxJ: number;
  maxSimilarity: number;
  R: number;
  recommendThreshold: number;
  recommendations: UserRecommendation[];
}

const EPS = 1e-12;

export function meanNonZero(ratings: number[]): number {
  let sum = 0;
  let count = 0;
  for (const value of ratings) {
    if (value !== 0) {
      sum += value;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function isNewUser(column: number[]): boolean {
  return column.every((value) => value === 0);
}

export function itemSimilarityMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const similarity: number[][] = [];
  for (let i = 0; i < n; i++) {
    similarity[i] = [];
    for (let j = 0; j < n; j++) {
      similarity[i][j] =
        i === j ? 0 : cosineSimilarity(matrix[i], matrix[j]);
    }
  }
  return similarity;
}

export function findMaxSimilarityPair(similarity: number[][]): {
  i: number;
  j: number;
  value: number;
} {
  const n = similarity.length;
  let maxI = 0;
  let maxJ = 1;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = similarity[i][j];
      if (value > maxValue) {
        maxValue = value;
        maxI = i;
        maxJ = j;
      }
    }
  }

  return { i: maxI, j: maxJ, value: maxValue };
}

export function predictItemBasedRatingDetailed(
  userIndex: number,
  productIndex: number,
  products: string[],
  users: string[],
  matrix: number[][],
  similarity: number[][],
  R: number,
): PrBreakdown {
  const neighbors: PrNeighborTerm[] = [];
  let numerator = 0;
  let denominator = 0;

  for (let j = 0; j < products.length; j++) {
    if (j === productIndex) {
      continue;
    }
    const rating = matrix[j][userIndex];
    if (rating === 0) {
      continue;
    }
    const sim = similarity[productIndex][j];
    if (sim + EPS < R) {
      continue;
    }
    const weightedRating = rating * sim;
    neighbors.push({
      product: products[j],
      productIndex: j,
      rating,
      similarity: sim,
      weightedRating,
    });
    numerator += weightedRating;
    denominator += Math.abs(sim);
  }

  const usedFallback = denominator === 0;
  const predicted = usedFallback ? 0 : numerator / denominator;

  return {
    user: users[userIndex],
    userIndex,
    product: products[productIndex],
    productIndex,
    R,
    neighbors,
    numerator,
    denominator,
    usedFallback,
    predicted,
  };
}

function userColumn(matrix: number[][], userIndex: number): number[] {
  return matrix.map((row) => row[userIndex]);
}

function recommendColdStart(
  user: string,
  userIndex: number,
  products: string[],
  productMeans: number[],
): UserRecommendation {
  let bestIndex = 0;
  let bestMean = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < productMeans.length; i++) {
    if (productMeans[i] > bestMean) {
      bestMean = productMeans[i];
      bestIndex = i;
    }
  }

  if (products.length === 0 || !Number.isFinite(bestMean) || bestMean <= 0) {
    return {
      user,
      userIndex,
      coldStart: true,
      product: null,
      productIndex: null,
      predicted: null,
      breakdown: null,
      candidates: [],
      reason: 'Новый пользователь, но нет товаров со средним рейтингом',
    };
  }

  const candidates: CandidatePrediction[] = products.map((product, i) => ({
    product,
    productIndex: i,
    predicted: productMeans[i],
    aboveThreshold: i === bestIndex,
    breakdown: {
      user,
      userIndex,
      product,
      productIndex: i,
      R: 0,
      neighbors: [],
      numerator: 0,
      denominator: 0,
      usedFallback: true,
      predicted: productMeans[i],
    },
  }));
  candidates.sort((left, right) => right.predicted - left.predicted);

  return {
    user,
    userIndex,
    coldStart: true,
    product: products[bestIndex],
    productIndex: bestIndex,
    predicted: bestMean,
    breakdown: candidates.find((c) => c.productIndex === bestIndex)?.breakdown ?? null,
    candidates,
    reason: `Новый пользователь (все рейтинги = 0) → товар с наибольшим средним рейтингом: ${products[bestIndex]} (MID = ${bestMean.toFixed(4)})`,
  };
}

export function recommendItemBased(
  products: string[],
  users: string[],
  matrix: number[][],
  options: RecommendOptions = {},
): ItemBasedResult {
  const R = options.R ?? 0;
  const recommendThreshold = options.recommendThreshold ?? 0;

  const similarity = itemSimilarityMatrix(matrix);
  const productMeans = matrix.map((row) => meanNonZero(row));
  const maxPair =
    products.length >= 2
      ? findMaxSimilarityPair(similarity)
      : { i: 0, j: 0, value: 0 };

  const recommendations: UserRecommendation[] = users.map((user, userIndex) => {
    const column = userColumn(matrix, userIndex);

    if (isNewUser(column)) {
      return recommendColdStart(user, userIndex, products, productMeans);
    }

    const candidates: CandidatePrediction[] = [];
    for (let productIndex = 0; productIndex < products.length; productIndex++) {
      if (matrix[productIndex][userIndex] !== 0) {
        continue;
      }
      const breakdown = predictItemBasedRatingDetailed(
        userIndex,
        productIndex,
        products,
        users,
        matrix,
        similarity,
        R,
      );
      candidates.push({
        product: products[productIndex],
        productIndex,
        predicted: breakdown.predicted,
        aboveThreshold:
          !breakdown.usedFallback &&
          breakdown.predicted + EPS >= recommendThreshold,
        breakdown,
      });
    }

    candidates.sort((left, right) => right.predicted - left.predicted);

    if (candidates.length === 0) {
      return {
        user,
        userIndex,
        coldStart: false,
        product: null,
        productIndex: null,
        predicted: null,
        breakdown: null,
        candidates,
        reason: 'Нет неоценённых товаров для рекомендации',
      };
    }

    const eligible = candidates.filter((c) => c.aboveThreshold);
    if (eligible.length === 0) {
      const best = candidates[0];
      return {
        user,
        userIndex,
        coldStart: false,
        product: null,
        productIndex: null,
        predicted: best.predicted,
        breakdown: best.breakdown,
        candidates,
        reason: best.breakdown.usedFallback
          ? `Нет похожих оценённых товаров (cos ≥ R) для предсказания`
          : `Лучший кандидат ${best.product} (Pr ≈ ${best.predicted.toFixed(4)}) ниже порога ${recommendThreshold}`,
      };
    }

    const best = eligible[0];
    return {
      user,
      userIndex,
      coldStart: false,
      product: best.product,
      productIndex: best.productIndex,
      predicted: best.predicted,
      breakdown: best.breakdown,
      candidates,
      reason: `рекомендовать ${best.product} (Pr ≈ ${best.predicted.toFixed(4)} ≥ ${recommendThreshold})`,
    };
  });

  return {
    users,
    products,
    similarity,
    productMeans,
    maxI: maxPair.i,
    maxJ: maxPair.j,
    maxSimilarity: maxPair.value,
    R,
    recommendThreshold,
    recommendations,
  };
}
