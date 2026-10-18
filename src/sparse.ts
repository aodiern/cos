export interface CooStorage {
  value: number[];
  row: number[];
  col: number[];
}

export interface CsrStorage {
  value: number[];
  col: number[];
  rowIndex: number[];
}

export interface EllpackStorage {
  value: number[][];
  column: number[][];
  maxNonZeros: number;
}

export interface FilterOptions {
  lowRatingThreshold?: number;
}

export interface FilterResult {
  products: string[];
  users: string[];
  matrix: number[][];
  removedProducts: string[];
  removedUsers: string[];
  productMeans: number[];
}

export function meanNonZero(ratings: number[]): number {
  let sum = 0;
  let count = 0;
  for (const v of ratings) {
    if (v !== 0) {
      sum += v;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

export function isZeroRatingProduct(row: number[]): boolean {
  return row.every((v) => v === 0);
}

export function isInactiveUser(column: number[]): boolean {
  return column.every((v) => v === 0);
}

/**
 * Исключает:
 * — товары с «нулевым» рейтингом (все оценки == 0);
 * — товары с низким рейтингом (среднее ненулевых < threshold, по умолчанию 4);
 * — «неактивных» пользователей (все оценки == 0).
 */
export function filterPreferenceMatrix(
  products: string[],
  users: string[],
  matrix: number[][],
  options: FilterOptions = {},
): FilterResult {
  const threshold = options.lowRatingThreshold ?? 4;
  const productMeans = matrix.map((row) => meanNonZero(row));

  const keepProductIdx: number[] = [];
  const removedProducts: string[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    const mean = productMeans[i];
    if (isZeroRatingProduct(row) || mean < threshold) {
      removedProducts.push(products[i]);
    } else {
      keepProductIdx.push(i);
    }
  }

  const reducedRows = keepProductIdx.map((i) => matrix[i]);
  const keepUserIdx: number[] = [];
  const removedUsers: string[] = [];

  for (let j = 0; j < users.length; j++) {
    const column = reducedRows.map((row) => row[j]);
    if (column.length === 0 || isInactiveUser(column)) {
      removedUsers.push(users[j]);
    } else {
      keepUserIdx.push(j);
    }
  }

  return {
    products: keepProductIdx.map((i) => products[i]),
    users: keepUserIdx.map((j) => users[j]),
    matrix: reducedRows.map((row) => keepUserIdx.map((j) => row[j])),
    removedProducts,
    removedUsers,
    productMeans,
  };
}

export function toCoo(matrix: number[][]): CooStorage {
  const value: number[] = [];
  const row: number[] = [];
  const col: number[] = [];

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const v = matrix[i][j];
      if (v !== 0) {
        value.push(v);
        row.push(i);
        col.push(j);
      }
    }
  }

  return { value, row, col };
}

export function toCsr(matrix: number[][]): CsrStorage {
  const value: number[] = [];
  const col: number[] = [];
  const rowIndex: number[] = [0];

  for (let i = 0; i < matrix.length; i++) {
    for (let j = 0; j < matrix[i].length; j++) {
      const v = matrix[i][j];
      if (v !== 0) {
        value.push(v);
        col.push(j);
      }
    }
    rowIndex.push(value.length);
  }

  return { value, col, rowIndex };
}

/** ELLPACK: две матрицы value и column шириной max(nnz в строке) */
export function toEllpack(matrix: number[][]): EllpackStorage {
  const rows = matrix.length;
  let maxNonZeros = 0;

  const rowEntries: { value: number; col: number }[][] = matrix.map((row) => {
    const entries: { value: number; col: number }[] = [];
    for (let j = 0; j < row.length; j++) {
      if (row[j] !== 0) {
        entries.push({ value: row[j], col: j });
      }
    }
    if (entries.length > maxNonZeros) {
      maxNonZeros = entries.length;
    }
    return entries;
  });

  if (maxNonZeros === 0) {
    maxNonZeros = 1;
  }

  const value: number[][] = [];
  const column: number[][] = [];

  for (let i = 0; i < rows; i++) {
    const vals = new Array(maxNonZeros).fill(0);
    const cols = new Array(maxNonZeros).fill(0);
    const entries = rowEntries[i];
    for (let k = 0; k < entries.length; k++) {
      vals[k] = entries[k].value;
      cols[k] = entries[k].col;
    }
    value.push(vals);
    column.push(cols);
  }

  return { value, column, maxNonZeros };
}

export function formatVector(values: number[]): string {
  return `[${values.join(', ')}]`;
}
