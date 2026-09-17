/**
 * Косинусное сходство
 *
 *   cos(θ) = (A · B) / (‖A‖ · ‖B‖)
 *
 * Строка матрицы — вектор продукта Pi.
 * Столбец матрицы — вектор пользователя Uj.
 */

export interface PairSimilarity {
  name1: string;
  name2: string;
  similarity: number;
  dot: number;
  normA: number;
  normB: number;
}

/** A · B = A1*B1 + A2*B2 + ... + An*Bn */
function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/** ‖A‖ = √(A1² + A2² + ... + An²) */
function vectorNorm(a: number[]): number {
  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    sumSquares += a[i] * a[i];
  }
  return Math.sqrt(sumSquares);
}

function pairSimilarity(
  a: number[],
  b: number[],
  name1: string,
  name2: string,
): PairSimilarity {
  const dot = dotProduct(a, b);
  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  const denominator = normA * normB;
  const similarity = denominator === 0 ? 0 : dot / denominator;

  return { name1, name2, similarity, dot, normA, normB };
}

export function allPairSimilarities(
  vectors: number[][],
  names: string[],
): PairSimilarity[] {
  const pairs: PairSimilarity[] = [];

  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      pairs.push(pairSimilarity(vectors[i], vectors[j], names[i], names[j]));
    }
  }

  return pairs.sort((left, right) => right.similarity - left.similarity);
}

export function takeFirst<T>(items: T[], count: number): T[] {
  return items.slice(0, count);
}

export function allColumnVectors(matrix: number[][]): number[][] {
  if (matrix.length === 0) {
    return [];
  }

  const cols = matrix[0].length;
  const vectors: number[][] = [];
  for (let j = 0; j < cols; j++) {
    const vector: number[] = [];
    for (let i = 0; i < matrix.length; i++) {
      vector[i] = matrix[i][j];
    }
    vectors[j] = vector;
  }
  return vectors;
}

export function copyMatrix(matrix: number[][]): number[][] {
  const copy: number[][] = [];
  for (let i = 0; i < matrix.length; i++) {
    copy[i] = [];
    for (let j = 0; j < matrix[i].length; j++) {
      copy[i][j] = matrix[i][j];
    }
  }
  return copy;
}
