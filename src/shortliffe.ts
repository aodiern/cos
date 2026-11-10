export type FuzzyOp = 'and' | 'or';

export function isMeasure(n: number) {
  return Number.isFinite(n) && n >= 0 && n <= 1;
}

export function combineEvidence(a: number, b: number) {
  return a + b * (1 - a);
}

export interface FoldStep {
  op: FuzzyOp;
  left: number;
  right: number;
  out: number;
}

export interface FoldResult {
  folded: number;
  steps: FoldStep[];
}

export function foldFuzzy(vals: number[], ops: FuzzyOp[]): FoldResult {
  if (!vals.length) return { folded: 0, steps: [] };
  let acc = vals[0];
  const steps: FoldStep[] = [];
  for (let i = 0; i < ops.length; i++) {
    const right = vals[i + 1];
    const out = ops[i] === 'and' ? Math.min(acc, right) : Math.max(acc, right);
    steps.push({ op: ops[i], left: acc, right, out });
    acc = out;
  }
  return { folded: acc, steps };
}

export interface PremiseMeasures {
  md: number;
  mnd: number;
  negated: boolean;
}

export interface EvidenceEval {
  md: number;
  mnd: number;
  ku: number;
  mdFold: FoldResult;
  mndFold: FoldResult;
  premiseMd: number[];
  premiseMnd: number[];
}

export function evaluateEvidence(
  premises: PremiseMeasures[],
  ops: FuzzyOp[],
): EvidenceEval | string {
  if (!premises.length) return 'Нужно хотя бы одно условие';
  if (ops.length !== Math.max(0, premises.length - 1)) {
    return 'Несогласованные связки AND/OR';
  }

  const premiseMd: number[] = [];
  const premiseMnd: number[] = [];
  for (const p of premises) {
    if (!isMeasure(p.md) || !isMeasure(p.mnd)) {
      return 'MD и MND должны быть числами от 0 до 1';
    }
    premiseMd.push(p.negated ? 1 - p.md : p.md);
    premiseMnd.push(p.negated ? 1 - p.mnd : p.mnd);
  }

  const mdFold = foldFuzzy(premiseMd, ops);
  const mndFold = foldFuzzy(premiseMnd, ops);
  return {
    md: mdFold.folded,
    mnd: mndFold.folded,
    ku: mdFold.folded - mndFold.folded,
    mdFold,
    mndFold,
    premiseMd,
    premiseMnd,
  };
}

export interface CombineStep {
  labels: string[];
  added: string;
  prevMd: number;
  addedMd: number;
  md: number;
  prevMnd: number;
  addedMnd: number;
  mnd: number;
  ku: number;
}

export interface CombinedEval {
  md: number;
  mnd: number;
  ku: number;
  steps: CombineStep[];
}

export function combineEvaluations(
  first: EvidenceEval,
  second: EvidenceEval,
  firstLabel = 'E1',
  secondLabel = 'E2',
): CombinedEval {
  return combineMany([
    { label: firstLabel, evaluation: first },
    { label: secondLabel, evaluation: second },
  ]);
}

export function combineMany(
  evList: { label: string; evaluation: EvidenceEval }[],
): CombinedEval {
  if (!evList.length) return { md: 0, mnd: 0, ku: 0, steps: [] };

  let md = evList[0].evaluation.md;
  let mnd = evList[0].evaluation.mnd;
  const steps: CombineStep[] = [];
  const labels = [evList[0].label];

  for (let i = 1; i < evList.length; i++) {
    const addedMd = evList[i].evaluation.md;
    const addedMnd = evList[i].evaluation.mnd;
    const nextMd = combineEvidence(md, addedMd);
    const nextMnd = combineEvidence(mnd, addedMnd);
    labels.push(evList[i].label);
    steps.push({
      labels: [...labels],
      added: evList[i].label,
      prevMd: md,
      addedMd,
      md: nextMd,
      prevMnd: mnd,
      addedMnd,
      mnd: nextMnd,
      ku: nextMd - nextMnd,
    });
    md = nextMd;
    mnd = nextMnd;
  }

  return { md, mnd, ku: md - mnd, steps };
}
