/**
 * User-based рекомендации (задание 4).
 *
 *   Pr_a,i = r̄_a + Σ_u∈K (r_u,i − r̄_u) · cos(a,u) / Σ_u∈K |cos(a,u)|
 *
 * r̄ — среднее ненулевых оценок пользователя.
 * K — соседи с cos(a,u) ≥ R, оценившие товар i.
 * Товар рекомендуют только если Pr ≥ порога рекомендации.
 * Оценка 0 считается «не оценён» (кандидат на рекомендацию).
 */

import { allColumnVectors, cosineSimilarity } from './math';

export interface RecommendOptions {
  /** Порог сходства: сосед входит в K при cos ≥ R */
  R?: number;
  /** Минимальный Pr (или средний рейтинг при cold start), чтобы рекомендовать */
  recommendThreshold?: number;
}

/** Один сосед u в формуле Pr для пары (a, i) */
export interface PrNeighborTerm {
  user: string;
  userIndex: number;
  rating: number;
  mean: number;
  similarity: number;
  /** (r_u,i − r̄_u) · cos(a,u) */
  weightedDeviation: number;
}

/** Полный разбор расчёта Pr_a,i */
export interface PrBreakdown {
  user: string;
  userIndex: number;
  product: string;
  productIndex: number;
  meanA: number;
  R: number;
  neighbors: PrNeighborTerm[];
  numerator: number;
  denominator: number;
  /** r̄_a, если нет соседей в K */
  usedFallbackMean: boolean;
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
  mean: number;
  /** Новый пользователь: все оценки == 0 */
  coldStart: boolean;
  /** Товар с наибольшим предсказанием (или со средним при cold start) */
  product: string | null;
  productIndex: number | null;
  predicted: number | null;
  /** Разбор Pr для рекомендованного (или лучшего) товара */
  breakdown: PrBreakdown | null;
  /** Все предсказания для неоценённых товаров (включая ниже порога) */
  candidates: CandidatePrediction[];
  reason: string;
}

export interface UserBasedResult {
  users: string[];
  products: string[];
  /** Матрица косинусного сходства пользователей (диагональ 0) */
  similarity: number[][];
  means: number[];
  maxI: number;
  maxJ: number;
  maxSimilarity: number;
  R: number;
  recommendThreshold: number;
  recommendations: UserRecommendation[];
}

const EPS = 1e-12;

/** Среднее ненулевых оценок; 0 если оценок нет. */
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

export function isNewUser(ratings: number[]): boolean {
  return ratings.every((value) => value === 0);
}

/** Средний рейтинг товара по всем ненулевым оценкам. */
export function productMeanNonZero(matrix: number[][], productIndex: number): number {
  return meanNonZero(matrix[productIndex] ?? []);
}

export function userSimilarityMatrix(userVectors: number[][]): number[][] {
  const n = userVectors.length;
  const matrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      matrix[i][j] =
        i === j ? 0 : cosineSimilarity(userVectors[i], userVectors[j]);
    }
  }
  return matrix;
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

/**
 * Предсказание рейтинга пользователя a для товара i с разбором формулы.
 * В K входят пользователи с cos(a,u) ≥ R, у которых оценка товара ≠ 0.
 */
export function predictUserBasedRatingDetailed(
  userIndex: number,
  productIndex: number,
  products: string[],
  users: string[],
  matrix: number[][],
  means: number[],
  similarity: number[][],
  R: number,
): PrBreakdown {
  const meanA = means[userIndex];
  const neighbors: PrNeighborTerm[] = [];
  let numerator = 0;
  let denominator = 0;

  for (let u = 0; u < users.length; u++) {
    if (u === userIndex) {
      continue;
    }
    const rating = matrix[productIndex][u];
    if (rating === 0) {
      continue;
    }
    const sim = similarity[userIndex][u];
    if (sim + EPS < R) {
      continue;
    }
    const weightedDeviation = (rating - means[u]) * sim;
    neighbors.push({
      user: users[u],
      userIndex: u,
      rating,
      mean: means[u],
      similarity: sim,
      weightedDeviation,
    });
    numerator += weightedDeviation;
    denominator += Math.abs(sim);
  }

  const usedFallbackMean = denominator === 0;
  const predicted = usedFallbackMean ? meanA : meanA + numerator / denominator;

  return {
    user: users[userIndex],
    userIndex,
    product: products[productIndex],
    productIndex,
    meanA,
    R,
    neighbors,
    numerator,
    denominator,
    usedFallbackMean,
    predicted,
  };
}

export function predictUserBasedRating(
  userIndex: number,
  productIndex: number,
  matrix: number[][],
  userVectors: number[][],
  means: number[],
  similarity: number[][],
  R: number,
): number {
  const users = userVectors.map((_, i) => `U${i}`);
  const products = matrix.map((_, i) => `P${i}`);
  return predictUserBasedRatingDetailed(
    userIndex,
    productIndex,
    products,
    users,
    matrix,
    means,
    similarity,
    R,
  ).predicted;
}

function recommendColdStart(
  user: string,
  userIndex: number,
  products: string[],
  matrix: number[][],
): UserRecommendation {
  /** Средние рейтинги всех товаров (по ненулевым оценкам). */
  const productMeans = products.map((_, i) => productMeanNonZero(matrix, i));

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
      mean: 0,
      coldStart: true,
      product: null,
      productIndex: null,
      predicted: null,
      breakdown: null,
      candidates: [],
      reason: 'Новый пользователь, но нет товаров со средним рейтингом',
    };
  }

  // Для нового пользователя порог Pr не применяется:
  // всегда рекомендуем товар с наибольшим средним рейтингом.
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
      meanA: 0,
      R: 0,
      neighbors: [],
      numerator: 0,
      denominator: 0,
      usedFallbackMean: true,
      predicted: productMeans[i],
    },
  }));
  candidates.sort((left, right) => right.predicted - left.predicted);

  return {
    user,
    userIndex,
    mean: 0,
    coldStart: true,
    product: products[bestIndex],
    productIndex: bestIndex,
    predicted: bestMean,
    breakdown: candidates.find((c) => c.productIndex === bestIndex)?.breakdown ?? null,
    candidates,
    reason: `Новый пользователь (все рейтинги = 0) → товар с наибольшим средним рейтингом: ${products[bestIndex]} (MID = ${bestMean.toFixed(4)})`,
  };
}

export function recommendUserBased(
  products: string[],
  users: string[],
  matrix: number[][],
  options: RecommendOptions = {},
): UserBasedResult {
  const R = options.R ?? 0;
  const recommendThreshold = options.recommendThreshold ?? 0;

  const userVectors = allColumnVectors(matrix);
  const similarity = userSimilarityMatrix(userVectors);
  const means = userVectors.map((vector) => meanNonZero(vector));
  const maxPair =
    users.length >= 2
      ? findMaxSimilarityPair(similarity)
      : { i: 0, j: 0, value: 0 };

  const recommendations: UserRecommendation[] = users.map((user, userIndex) => {
    const vector = userVectors[userIndex];

    if (isNewUser(vector)) {
      return recommendColdStart(user, userIndex, products, matrix);
    }

    const candidates: CandidatePrediction[] = [];
    for (let productIndex = 0; productIndex < products.length; productIndex++) {
      if (matrix[productIndex][userIndex] !== 0) {
        continue;
      }
      const breakdown = predictUserBasedRatingDetailed(
        userIndex,
        productIndex,
        products,
        users,
        matrix,
        means,
        similarity,
        R,
      );
      candidates.push({
        product: products[productIndex],
        productIndex,
        predicted: breakdown.predicted,
        aboveThreshold: breakdown.predicted + EPS >= recommendThreshold,
        breakdown,
      });
    }

    candidates.sort((left, right) => right.predicted - left.predicted);

    if (candidates.length === 0) {
      return {
        user,
        userIndex,
        mean: means[userIndex],
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
        mean: means[userIndex],
        coldStart: false,
        product: null,
        productIndex: null,
        predicted: best.predicted,
        breakdown: best.breakdown,
        candidates,
        reason: `Лучший кандидат ${best.product} (Pr ≈ ${best.predicted.toFixed(4)}) ниже порога ${recommendThreshold}`,
      };
    }

    const best = eligible[0];
    return {
      user,
      userIndex,
      mean: means[userIndex],
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
    means,
    maxI: maxPair.i,
    maxJ: maxPair.j,
    maxSimilarity: maxPair.value,
    R,
    recommendThreshold,
    recommendations,
  };
}
