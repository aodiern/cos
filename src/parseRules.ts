const HEADER_ALIASES = new Set([
  'правило',
  'правила',
  'rule',
  'rules',
  'факт',
  'факты',
  'название',
  'текст',
]);

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let buf = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        buf += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      cells.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  cells.push(buf.trim());
  return cells;
}

function detectDelimiter(lines: string[]): ',' | ';' | '\t' | '' {
  const sample = lines.slice(0, 8);
  let tabs = 0;
  let semis = 0;
  let commas = 0;
  for (const line of sample) {
    if (line.includes('\t')) tabs++;
    if (splitCsvLine(line, ';').length >= 2) semis++;
    if (splitCsvLine(line, ',').length >= 2) commas++;
  }
  const n = sample.length;
  if (tabs >= n) return '\t';
  if (semis >= Math.ceil(n / 2)) return ';';
  if (commas >= Math.ceil(n / 2)) return ',';
  return '';
}

function isHeader(cell: string) {
  return HEADER_ALIASES.has(cell.trim().toLowerCase());
}

export function parseRulesText(text: string): string[] | string {
  const rawPayload = text.replace(/^\uFEFF/, ''); // Excel/Windows often prepends BOM
  const lines = rawPayload
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter((ln) => ln && !ln.startsWith('#'));

  if (!lines.length) return 'Файл пустой';

  const delim = detectDelimiter(lines);
  const firstCell = (ln: string) => (delim ? splitCsvLine(ln, delim) : [ln])[0] ?? '';

  let i = 0;
  const head = firstCell(lines[0]).replace(/^["']|["']$/g, '');
  if (isHeader(head)) i = 1;

  const dbRows: string[] = [];
  for (; i < lines.length; i++) {
    const rule = firstCell(lines[i]).replace(/^["']|["']$/g, '').trim();
    if (rule) dbRows.push(rule);
  }

  return dbRows.length ? dbRows : 'В файле нет правил';
}
