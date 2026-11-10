import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { parseRulesText } from './parseRules';
import {
  CombinedEval,
  EvidenceEval,
  FuzzyOp,
  combineEvaluations,
  evaluateEvidence,
} from './shortliffe';

const defaultRules = [
  'X проживает в Y',
  'X является членом партии Z',
  'X имеет возраст T',
  'X является ИП',
  'X будет голосовать за кандидата B',
];

type PremiseState = {
  id: string;
  ruleIndex: number;
  md: string;
  mnd: string;
  negated: boolean;
};

type EvidenceState = {
  enabled: boolean;
  conclusionIndex: number;
  premises: PremiseState[];
  ops: FuzzyOp[];
};

let premiseSeq = 1;
const newPremiseId = () => `p${++premiseSeq}`;

function defaultE1(): EvidenceState {
  return {
    enabled: true,
    conclusionIndex: 4,
    premises: [
      { id: 'e1a', ruleIndex: 0, md: '0.8', mnd: '0.3', negated: false },
      { id: 'e1b', ruleIndex: 1, md: '0.75', mnd: '0.25', negated: false },
    ],
    ops: ['and'],
  };
}

function defaultE2(): EvidenceState {
  return {
    enabled: true,
    conclusionIndex: 4,
    premises: [
      { id: 'e2a', ruleIndex: 2, md: '0.4', mnd: '0.5', negated: false },
      { id: 'e2b', ruleIndex: 3, md: '0.85', mnd: '0.2', negated: false },
    ],
    ops: ['or'],
  };
}

function parseMeasure(rawNum: string) {
  return Number(rawNum.replace(',', '.').trim());
}

function fmt(n: number, digits = 4) {
  return Number(n.toFixed(digits)).toString().replace('.', ',');
}

function fmtOp(op: FuzzyOp) {
  return op === 'and' ? 'AND' : 'OR';
}

function fmtFuzzy(op: FuzzyOp) {
  return op === 'and' ? 'MIN' : 'MAX';
}

function clampEvidence(ev: EvidenceState, ruleCount: number): EvidenceState {
  const last = Math.max(0, ruleCount - 1);
  return {
    ...ev,
    conclusionIndex: Math.min(ev.conclusionIndex, last),
    premises: ev.premises.map((p) => ({ ...p, ruleIndex: Math.min(p.ruleIndex, last) })),
  };
}

function App() {
  const [rules, setRules] = useState<string[]>(defaultRules);
  const [e1, setE1] = useState<EvidenceState>(defaultE1);
  const [e2, setE2] = useState<EvidenceState>(defaultE2);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const liveOut = useMemo(() => {
    const runEv = (ev: EvidenceState, label: string): EvidenceEval | string | null => {
      if (!ev.enabled) return null;
      const evOut = evaluateEvidence(
        ev.premises.map((p) => ({
          md: parseMeasure(p.md),
          mnd: parseMeasure(p.mnd),
          negated: p.negated,
        })),
        ev.ops,
      );
      return typeof evOut === 'string' ? `${label}: ${evOut}` : evOut;
    };

    const empty = {
      e1: null as EvidenceEval | null,
      e2: null as EvidenceEval | null,
      combined: null as CombinedEval | null,
      sameHypothesis: false,
    };
    const e1Out = runEv(e1, 'E1');
    if (typeof e1Out === 'string') return { error: e1Out, ...empty };
    const e2Out = runEv(e2, 'E2');
    if (typeof e2Out === 'string') return { error: e2Out, ...empty };
    if (!e1Out && !e2Out) {
      return { error: 'Включите хотя бы одно предположение E1 или E2', ...empty };
    }

    const sameHypothesis =
      e1.enabled && e2.enabled && e1.conclusionIndex === e2.conclusionIndex;
    const combined =
      e1Out && e2Out && sameHypothesis ? combineEvaluations(e1Out, e2Out) : null;

    return { error: '', e1: e1Out, e2: e2Out, combined, sameHypothesis };
  }, [e1, e2]);

  const applyRules = (next: string[]) => {
    setRules(next);
    setE1((prev) => clampEvidence(prev, next.length));
    setE2((prev) => clampEvidence(prev, next.length));
  };

  const resetExample = () => {
    setFileError('');
    setRules([...defaultRules]);
    setE1(defaultE1());
    setE2(defaultE2());
  };

  const addRule = () => setRules([...rules, `Правило ${rules.length + 1}`]);

  const removeRule = (index: number) => {
    if (rules.length <= 1) return;
    applyRules(rules.filter((_, i) => i !== index));
  };

  const onRulesFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const fileRules = parseRulesText(String(reader.result ?? ''));
      if (typeof fileRules === 'string') {
        setFileError(fileRules);
        return;
      }
      setFileError('');
      applyRules(fileRules);
    };
    reader.readAsText(file, 'utf-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadExample = () => {
    const blob = new Blob([defaultRules.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rules.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              Коэффициент уверенности Шортлиффа
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Предположения E1, E2 -комбинации правил БД (не более двух)
            </p>
          </div>
          <button
            onClick={resetExample}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            Сбросить пример
          </button>
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-slate-800">База правил</h2>
              <p className="text-sm text-slate-500">
                Загрузка из файла: одно правило на строку (TXT, CSV, TSV)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 text-sm cursor-pointer">
                Загрузить файл
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.csv,.tsv,.text"
                  onChange={onRulesFile}
                  className="hidden"
                />
              </label>
              <button
                onClick={downloadExample}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 text-sm"
              >
                Скачать rules.txt
              </button>
              <button
                onClick={addRule}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 text-sm"
              >
                + Правило
              </button>
            </div>
          </div>
          {fileError && <div className="mb-3 text-red-600 text-sm">{fileError}</div>}
          <ol className="space-y-2">
            {rules.map((rule, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="w-8 text-sm text-slate-400">{index + 1}.</span>
                <input
                  type="text"
                  value={rule}
                  onChange={(e) => {
                    const next = [...rules];
                    next[index] = e.target.value;
                    setRules(next);
                  }}
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg focus:border-indigo-400 focus:outline-none"
                />
                <button
                  onClick={() => removeRule(index)}
                  className="text-slate-400 hover:text-red-500 px-2"
                  title="Удалить правило"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        </section>

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <EvidenceCard
            title="E1"
            evidence={e1}
            rules={rules}
            onChange={setE1}
            canDisable={e2.enabled}
          />
          <EvidenceCard
            title="E2"
            evidence={e2}
            rules={rules}
            onChange={setE2}
            canDisable={e1.enabled}
          />
        </div>

        <section className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <h2 className="font-semibold text-slate-800 mb-3">Формулы</h2>
          <div className="grid xl:grid-cols-2 gap-4 text-xs sm:text-sm font-mono text-slate-700">
            <pre className="bg-slate-50 rounded-lg p-3 whitespace-pre-wrap break-words">{`MD1 AND MD2 = MIN(MD1, MD2)
MD1 OR MD2  = MAX(MD1, MD2)
NOT MD1     = 1 − MD1`}</pre>
            <pre className="bg-slate-50 rounded-lg p-3 whitespace-pre-wrap break-words">{`MD[H:E1,E2]  = MD[H:E1] + MD[H:E2](1 − MD[H:E1])
MND[H:E1,E2] = MND[H:E1] + MND[H:E2](1 − MND[H:E1])
KU[H:E]      = MD[H:E] − MND[H:E]`}</pre>
          </div>
        </section>

        {liveOut.error ? (
          <div className="mb-4 text-red-600 text-sm">{liveOut.error}</div>
        ) : (
          <Results
            rules={rules}
            e1={e1}
            e2={e2}
            e1Eval={liveOut.e1}
            e2Eval={liveOut.e2}
            combined={liveOut.combined}
            sameHypothesis={liveOut.sameHypothesis}
          />
        )}
      </main>
    </div>
  );
}

function EvidenceCard({
  title,
  evidence,
  rules,
  onChange,
  canDisable,
}: {
  title: string;
  evidence: EvidenceState;
  rules: string[];
  onChange: (next: EvidenceState) => void;
  canDisable: boolean;
}) {
  const patchPremise = (id: string, patch: Partial<PremiseState>) => {
    onChange({
      ...evidence,
      premises: evidence.premises.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  };

  const addPremise = () => {
    const unused = rules.findIndex((_, i) => !evidence.premises.some((p) => p.ruleIndex === i));
    onChange({
      ...evidence,
      premises: [
        ...evidence.premises,
        {
          id: newPremiseId(),
          ruleIndex: unused >= 0 ? unused : 0,
          md: '0.5',
          mnd: '0',
          negated: false,
        },
      ],
      ops: [...evidence.ops, 'and'],
    });
  };

  const removePremise = (id: string) => {
    if (evidence.premises.length <= 1) return;
    const idx = evidence.premises.findIndex((p) => p.id === id);
    const premises = evidence.premises.filter((_, i) => i !== idx);
    const ops = evidence.ops.filter((_, i) => i !== (idx === 0 ? 0 : idx - 1));
    onChange({ ...evidence, premises, ops });
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={evidence.enabled}
            disabled={evidence.enabled && !canDisable}
            onChange={(e) => onChange({ ...evidence, enabled: e.target.checked })}
          />
          использовать
        </label>
      </div>

      <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Если</p>
      <div className="space-y-3">
        {evidence.premises.map((p, index) => (
          <div key={p.id}>
            {index > 0 && (
              <div className="flex justify-center my-2">
                <select
                  value={evidence.ops[index - 1]}
                  onChange={(e) => {
                    const ops = [...evidence.ops];
                    ops[index - 1] = e.target.value as FuzzyOp;
                    onChange({ ...evidence, ops });
                  }}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-indigo-50 text-indigo-800"
                >
                  <option value="and">и (AND = MIN)</option>
                  <option value="or">или (OR = MAX)</option>
                </select>
              </div>
            )}
            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={p.negated}
                    onChange={(e) => patchPremise(p.id, { negated: e.target.checked })}
                  />
                  NOT
                </label>
                <select
                  value={p.ruleIndex}
                  onChange={(e) => patchPremise(p.id, { ruleIndex: Number(e.target.value) })}
                  className="flex-1 min-w-[12rem] px-2 py-1.5 border border-slate-200 rounded-lg"
                >
                  {rules.map((rule, ruleIndex) => (
                    <option key={ruleIndex} value={ruleIndex}>
                      {rule}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removePremise(p.id)}
                  className="text-slate-400 hover:text-red-500 px-1"
                >
                  ×
                </button>
              </div>
              <div className="flex flex-wrap gap-3">
                <MeasureInput
                  label="MD"
                  value={p.md}
                  onChange={(md) => patchPremise(p.id, { md })}
                />
                <MeasureInput
                  label="MND"
                  value={p.mnd}
                  onChange={(mnd) => patchPremise(p.id, { mnd })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={addPremise}
        className="mt-3 text-sm text-indigo-600 hover:text-indigo-800"
      >
        + условие
      </button>

      <p className="text-xs uppercase tracking-wide text-slate-400 mt-4 mb-2">То</p>
      <select
        value={evidence.conclusionIndex}
        onChange={(e) => onChange({ ...evidence, conclusionIndex: Number(e.target.value) })}
        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg"
      >
        {rules.map((rule, ruleIndex) => (
          <option key={ruleIndex} value={ruleIndex}>
            {rule}
          </option>
        ))}
      </select>
    </section>
  );
}

function MeasureInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      {label}
      <input
        type="number"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 px-2 py-1 text-center border border-slate-200 rounded focus:border-indigo-400 focus:outline-none"
      />
    </label>
  );
}

function Results({
  rules,
  e1,
  e2,
  e1Eval,
  e2Eval,
  combined,
  sameHypothesis,
}: {
  rules: string[];
  e1: EvidenceState;
  e2: EvidenceState;
  e1Eval: EvidenceEval | null;
  e2Eval: EvidenceEval | null;
  combined: CombinedEval | null;
  sameHypothesis: boolean;
}) {
  const hypothesis = e1.enabled ? rules[e1.conclusionIndex] : rules[e2.conclusionIndex];
  const finalKu = combined?.ku ?? e1Eval?.ku ?? e2Eval?.ku ?? 0;

  return (
    <section className="space-y-6">
      {e1Eval && e1.enabled && (
        <EvidenceResult title="E1" evidence={e1} rules={rules} evaluation={e1Eval} />
      )}
      {e2Eval && e2.enabled && (
        <EvidenceResult title="E2" evidence={e2} rules={rules} evaluation={e2Eval} />
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Итог</h2>
        <p className="text-sm text-slate-500 mb-4">Гипотеза H: {hypothesis}</p>

        {e1.enabled && e2.enabled && !sameHypothesis && (
          <p className="text-sm text-amber-700 mb-3">
            Заключения E1 и E2 различаются -объединение Шортлиффа считается только для одной
            гипотезы. Показаны KU каждого предположения отдельно.
          </p>
        )}

        {combined && e1Eval && e2Eval && (
          <div className="font-mono text-sm text-slate-700 space-y-1 mb-4">
            <p>
              MD[H:E1,E2] = {fmt(e1Eval.md)} + {fmt(e2Eval.md)} · (1 − {fmt(e1Eval.md)}) ={' '}
              <strong>{fmt(combined.md)}</strong>
            </p>
            <p>
              MND[H:E1,E2] = {fmt(e1Eval.mnd)} + {fmt(e2Eval.mnd)} · (1 − {fmt(e1Eval.mnd)}) ={' '}
              <strong>{fmt(combined.mnd)}</strong>
            </p>
            <p>
              KU[H:E] = {fmt(combined.md)} − {fmt(combined.mnd)} ={' '}
              <strong>{fmt(combined.ku)}</strong>
            </p>
          </div>
        )}

        {!combined && (
          <p className="font-mono text-sm text-slate-700 mb-4">
            KU[H:E] = <strong>{fmt(finalKu)}</strong>
          </p>
        )}

        <CertaintyBar ku={finalKu} />
      </div>
    </section>
  );
}

function EvidenceResult({
  title,
  evidence,
  rules,
  evaluation,
}: {
  title: string;
  evidence: EvidenceState;
  rules: string[];
  evaluation: EvidenceEval;
}) {
  const ifThen = evidence.premises
    .map((p, i) => {
      const name = `${p.negated ? '¬ ' : ''}${rules[p.ruleIndex]}`;
      return (i === 0 ? '' : ` ${fmtOp(evidence.ops[i - 1])} `) + name;
    })
    .join('');

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">{title}</h2>
      <p className="text-sm text-slate-600 mb-3">
        ЕСЛИ {ifThen} ТО {rules[evidence.conclusionIndex]}
      </p>
      <div className="font-mono text-sm text-slate-700 space-y-1">
        {evaluation.mdFold.steps.length === 0 ? (
          <p>
            MD[{title}] = {fmt(evaluation.md)}, MND[{title}] = {fmt(evaluation.mnd)}
          </p>
        ) : (
          evaluation.mdFold.steps.map((step, index) => {
            const mndStep = evaluation.mndFold.steps[index];
            return (
              <p key={`${title}-md-${index}`}>
                MD {fmtOp(step.op)} = {fmtFuzzy(step.op)}({fmt(step.left)}, {fmt(step.right)}) ={' '}
                {fmt(step.out)}
                {'; '}
                MND {fmtOp(step.op)} = {fmtFuzzy(step.op)}({fmt(mndStep.left)}, {fmt(mndStep.right)})
                = {fmt(mndStep.out)}
              </p>
            );
          })
        )}
        <p>
          MD[H:{title}] = {fmt(evaluation.md)}, MND[H:{title}] = {fmt(evaluation.mnd)}
        </p>
        <p>
          KU[H:{title}] = {fmt(evaluation.md)} − {fmt(evaluation.mnd)} ={' '}
          <strong>{fmt(evaluation.ku)}</strong>
        </p>
      </div>
    </div>
  );
}

function CertaintyBar({ ku }: { ku: number }) {
  const clamped = Math.max(-1, Math.min(1, ku));
  const pct = ((clamped + 1) / 2) * 100;
  const tone =
    clamped > 0.02 ? 'text-emerald-700' : clamped < -0.02 ? 'text-red-700' : 'text-slate-600';

  return (
    <div>
      <div className="relative h-3 rounded-full bg-gradient-to-r from-red-200 via-slate-100 to-emerald-200">
        <div
          className="absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded bg-slate-800"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>
      <p className={`mt-2 text-sm font-medium ${tone}`}>
        KU[H:E] = {fmt(ku)}
        {clamped > 0.02
          ? ' -гипотеза скорее подтверждается'
          : clamped < -0.02
            ? ' -гипотеза скорее опровергается'
            : ' -недостаточно сведений'}
      </p>
    </div>
  );
}

export default App;
