export interface ParsedPreferenceMatrix {
  products: string[];
  users: string[];
  matrix: number[][];
}

function splitCells(line: string): string[] {
  const cells: string[] = [];
  let current = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === ',' || ch === ';' || ch === '\t') {
      cells.push(current);
      current = '';
    } else if (ch === ' ') {
      if (current !== '') {
        cells.push(current);
        current = '';
      }
    } else if (ch !== '\r') {
      current += ch;
    }
  }

  if (current !== '') {
    cells.push(current);
  }

  return cells;
}

function isNumberToken(token: string): boolean {
  if (token === '') {
    return false;
  }
  const n = Number(token);
  return n === n;
}

function parseNumber(token: string): number {
  const n = Number(token);
  return n === n ? n : 0;
}

/** CSV */
export function parsePreferenceText(text: string): ParsedPreferenceMatrix | string {
  const rows = text
    .split(/\r?\n/)
    .map(splitCells)
    .filter((row) => row.length > 0);

  if (rows.length === 0) {
    return 'Файл пустой';
  }

  const first = rows[0];
  let numericInFirst = 0;
  let labeledInFirst = 0;
  for (const cell of first) {
    if (isNumberToken(cell)) {
      numericInFirst += 1;
    } else if (cell !== '') {
      labeledInFirst += 1;
    }
  }

  let dataStartRow = 0;
  let dataStartCol = 0;
  let hasColLabels = false;
  let hasRowLabels = false;

  if (labeledInFirst > 0 && numericInFirst === 0) {
    hasColLabels = true;
    dataStartRow = 1;
    const second = rows[1] ?? [];
    const secondHasLabel = second.length > 0 && !isNumberToken(second[0]);
    if (first[0] === '' || secondHasLabel) {
      hasRowLabels = true;
      dataStartCol = 1;
    }
  } else if (!isNumberToken(first[0]) && numericInFirst > 0) {
    hasRowLabels = true;
    dataStartCol = 1;
  }

  const products: string[] = [];
  const users: string[] = [];
  const matrix: number[][] = [];

  if (hasColLabels) {
    for (let j = dataStartCol; j < first.length; j++) {
      users.push(first[j] === '' ? `U${users.length + 1}` : first[j]);
    }
  }

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    products.push(hasRowLabels && row[0] ? row[0] : `P${products.length + 1}`);
    const values: number[] = [];
    for (let j = dataStartCol; j < row.length; j++) {
      values.push(parseNumber(row[j]));
    }
    matrix.push(values);
  }

  if (matrix.length === 0) {
    return 'Нужно минимум 2 строки и 2 столбца';
  }

  let colCount = 0;
  for (const row of matrix) {
    if (row.length > colCount) {
      colCount = row.length;
    }
  }

  if (!hasColLabels) {
    for (let j = 0; j < colCount; j++) {
      users.push(`U${j + 1}`);
    }
  } else if (users.length > colCount) {
    colCount = users.length;
  }

  for (const row of matrix) {
    while (row.length < colCount) {
      row.push(0);
    }
  }

  if (matrix.length < 2 || colCount < 2) {
    return 'Нужно минимум 2 строки и 2 столбца';
  }

  return { products, users, matrix };
}
