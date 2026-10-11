import { cosineSimilarity } from './math';

export interface ClusterStep {
  labels: string[];
  matrix: number[][];
  maxValue: number;
  maxI: number;
  maxJ: number;
  merged: boolean;
  description: string;
}

const EPS = 1e-12;

/** Матрица косинусного сходства: диагональ 0, ищем максимум среди пар */
export function cosineDistanceMatrix(vectors: number[][]): number[][] {
  const n = vectors.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      matrix[i][j] = i === j ? 0 : cosineSimilarity(vectors[i], vectors[j]);
    }
  }

  return matrix;
}

/** Максимум в верхней треугольной части (диагональ не участвует) */
export function findMaxPair(matrix: number[][]): { i: number; j: number; value: number } {
  const n = matrix.length;
  let maxI = 0;
  let maxJ = 1;
  let maxValue = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const value = matrix[i][j];
      if (value > maxValue) {
        maxValue = value;
        maxI = i;
        maxJ = j;
      }
    }
  }

  return { i: maxI, j: maxJ, value: maxValue };
}

function maxPairwise(a: number[], b: number[], base: number[][]): number {
  let max = Number.NEGATIVE_INFINITY;
  for (const i of a) {
    for (const j of b) {
      const value = base[i][j];
      if (value > max) {
        max = value;
      }
    }
  }
  return max;
}

function clusterMatrix(clusters: number[][], base: number[][]): number[][] {
  const n = clusters.length;
  const matrix: number[][] = [];

  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      matrix[i][j] = i === j ? 0 : maxPairwise(clusters[i], clusters[j], base);
    }
  }

  return matrix;
}

function compareToR(value: number, R: number): string {
  if (Math.abs(value - R) <= EPS) {
    return '==';
  }
  return value > R ? '>' : '<';
}

export interface ClusterRun {
  steps: ClusterStep[];
  clusters: string[];
}

/**
 * Иерархическая кластеризация по косинусному сходству.
 * На каждом шаге ищется максимум в матрице; пары с сходством ≥ R объединяются.
 * Сходство кластеров — максимум попарных сходств (как в учебной таблице).
 */
export function clusterByThreshold(
  names: string[],
  vectors: number[][],
  R: number,
): ClusterRun {
  if (names.length < 2) {
    return { steps: [], clusters: [...names] };
  }
  return clusterFromSimilarity(names, cosineDistanceMatrix(vectors), R);
}

export function clusterFromSimilarity(
  names: string[],
  base: number[][],
  R: number,
): ClusterRun {
  let clusters: number[][] = names.map((_, index) => [index]);
  let labels = [...names];
  const steps: ClusterStep[] = [];

  while (clusters.length > 1) {
    const matrix = clusterMatrix(clusters, base);
    const found = findMaxPair(matrix);
    const canMerge = Number.isFinite(found.value) && found.value + EPS >= R;

    steps.push({
      labels: [...labels],
      matrix,
      maxValue: found.value,
      maxI: found.i,
      maxJ: found.j,
      merged: canMerge,
      description: canMerge
        ? `${labels[found.i]} и ${labels[found.j]} объединены по расст. ${found.value.toFixed(4)} ${compareToR(found.value, R)} R`
        : `Максимум ${found.value.toFixed(4)} ${compareToR(found.value, R)} R = ${R}, объединение остановлено`,
    });

    if (!canMerge) {
      break;
    }

    const a = Math.min(found.i, found.j);
    const b = Math.max(found.i, found.j);
    const merged = [...clusters[a], ...clusters[b]].sort((left, right) => left - right);
    clusters = clusters.filter((_, index) => index !== b);
    clusters[a] = merged;
    labels = labels.filter((_, index) => index !== b);
    labels[a] = merged.map((index) => names[index]).join(', ');
  }

  return { steps, clusters: labels };
}
