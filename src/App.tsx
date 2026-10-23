import React, { useMemo, useRef, useState } from 'react';
import { copyMatrix } from './math';
import { parsePreferenceText } from './parseMatrix';
import { PrBreakdown, recommendUserBased } from './recommend';

function fmt(value: number, digits = 4): string {
  return value.toFixed(digits).replace('.', ',');
}

const defaultUsers = ['U1', 'U2', 'U3', 'U4'];
const defaultProducts = ['P1', 'P2', 'P3', 'P4', 'P5'];

/** Матрица из задания 4 (USER-BASED) */
const exampleCsv = `,U1,U2,U3,U4
P1,5,5,4,5
P2,5,5,3,0
P3,5,5,5,5
P4,5,0,2,0
P5,0,5,1,0
`;

const defaultMatrix = [
  [5, 5, 4, 5],
  [5, 5, 3, 0],
  [5, 5, 5, 5],
  [5, 0, 2, 0],
  [0, 5, 1, 0],
];

const EPS = 1e-12;

function App() {
  const [users, setUsers] = useState<string[]>(defaultUsers);
  const [products, setProducts] = useState<string[]>(defaultProducts);
  const [matrix, setMatrix] = useState<number[][]>(defaultMatrix);
  const [rInput, setRInput] = useState('0.6');
  const [thresholdInput, setThresholdInput] = useState('4');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const R = Number(rInput.replace(',', '.'));
  const recommendThreshold = Number(thresholdInput.replace(',', '.'));
  const paramsValid = !Number.isNaN(R) && !Number.isNaN(recommendThreshold);

  const result = useMemo(() => {
    if (!paramsValid) return null;
    return recommendUserBased(products, users, matrix, {
      R,
      recommendThreshold,
    });
  }, [products, users, matrix, R, recommendThreshold, paramsValid]);

  const updateCell = (row: number, col: number, value: string) => {
    const next = copyMatrix(matrix);
    const parsed = Number(value);
    next[row][col] = Number.isNaN(parsed) ? 0 : parsed;
    setMatrix(next);
  };

  const updateUserName = (index: number, name: string) => {
    const next = [...users];
    next[index] = name;
    setUsers(next);
  };

  const updateProductName = (index: number, name: string) => {
    const next = [...products];
    next[index] = name;
    setProducts(next);
  };

  const addUser = () => {
    setUsers([...users, `U${users.length + 1}`]);
    setMatrix(matrix.map((row) => [...row, 0]));
  };

  const addProduct = () => {
    setProducts([...products, `P${products.length + 1}`]);
    setMatrix([...matrix, users.map(() => 0)]);
  };

  const removeUser = (index: number) => {
    if (users.length <= 1) {
      setError('Нужен минимум 1 пользователь');
      return;
    }
    setError('');
    setUsers(users.filter((_, i) => i !== index));
    setMatrix(matrix.map((row) => row.filter((_, j) => j !== index)));
  };

  const removeProduct = (index: number) => {
    if (products.length <= 1) {
      setError('Нужен минимум 1 продукт');
      return;
    }
    setError('');
    setProducts(products.filter((_, i) => i !== index));
    setMatrix(matrix.filter((_, i) => i !== index));
  };

  const resetExample = () => {
    setProducts([...defaultProducts]);
    setUsers([...defaultUsers]);
    setMatrix(copyMatrix(defaultMatrix));
    setRInput('0.6');
    setThresholdInput('4');
    setError('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parsePreferenceText(String(reader.result ?? ''));
      if (typeof parsed === 'string') {
        setError(parsed);
        return;
      }
      setError('');
      setProducts(parsed.products);
      setUsers(parsed.users);
      setMatrix(parsed.matrix);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadExample = () => {
    const blob = new Blob([exampleCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'example.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatSim = (value: number) =>
    Number.isFinite(value) ? value.toFixed(4).replace('.', ',') : '—';

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-1">
          User-based рекомендации
        </h1>
        <p className="text-sm text-slate-500 mb-6">
          Рекомендации продуктов по похожим предпочтениям пользователей
        </p>

        <div className="flex flex-wrap gap-3 mb-4">
          <button
            onClick={addProduct}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            + Продукт
          </button>
          <button
            onClick={addUser}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            + Пользователь
          </button>
          <label className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer">
            Загрузить файл
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700">
            R
            <input
              type="number"
              step="0.05"
              min="-1"
              max="1"
              value={rInput}
              onChange={(e) => setRInput(e.target.value)}
              className="w-20 text-center border-b border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700">
            Порог Pr ≥
            <input
              type="number"
              step="0.1"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              className="w-16 text-center border-b border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </label>
          <button
            onClick={resetExample}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            Сбросить пример
          </button>
        </div>

        {(error || !paramsValid) && (
          <div className="mb-4 text-red-600 text-sm">
            {error || 'R и порог рекомендации должны быть числами'}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <button
              onClick={downloadExample}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Скачать example.csv
            </button>
          </div>
          <pre className="text-sm font-mono bg-slate-50 rounded-lg p-3 overflow-x-auto text-slate-700">
            {exampleCsv.trim()}
          </pre>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left text-sm text-slate-500">
                  Продукт
                </th>
                {users.map((user, j) => (
                  <th key={j} className="px-2 py-2 min-w-[96px]">
                    <input
                      type="text"
                      value={user}
                      onChange={(e) => updateUserName(j, e.target.value)}
                      className="w-full text-center text-sm border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none"
                    />
                    <button
                      onClick={() => removeUser(j)}
                      className="text-xs text-slate-400 hover:text-red-500"
                    >
                      ×
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={products[i]}
                        onChange={(e) => updateProductName(i, e.target.value)}
                        className="w-16 text-sm border-b border-transparent hover:border-slate-300 focus:border-indigo-400 focus:outline-none"
                      />
                      <button
                        onClick={() => removeProduct(i)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  </td>
                  {row.map((value, j) => (
                    <td key={j} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => updateCell(i, j, e.target.value)}
                        className="w-14 px-1 py-1 text-center border border-slate-200 rounded focus:border-indigo-400 focus:outline-none"
                      />
                    </td>
                  ))}
                </tr>
              ))}
              {result && (
                <tr className="bg-slate-50">
                  <td className="px-3 py-2 text-sm text-slate-500">
                    r̄ (ненулевых)
                  </td>
                  {result.means.map((mean, j) => (
                    <td
                      key={j}
                      className="px-2 py-2 text-center font-mono text-sm text-slate-700"
                    >
                      {mean.toFixed(2).replace('.', ',')}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {result && (
          <section className="space-y-6 mb-10">
            <div className="bg-white rounded-xl border border-slate-200 p-4 overflow-x-auto">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                Матрица сходства пользователей
              </h2>
              <p className="text-sm text-slate-500 mb-3">
                cos(Ui, Uj). Жёлтым — максимум. Зелёным - пары с cos ≥ R = {formatSim(result.R)}.
              </p>
              {users.length < 2 ? (
                <p className="text-sm text-slate-500">
                  Нужно минимум 2 пользователя
                </p>
              ) : (
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border border-slate-200 px-2 py-1 bg-slate-50" />
                      {users.map((user) => (
                        <th
                          key={user}
                          className="border border-slate-200 px-2 py-1 bg-slate-50 font-medium"
                        >
                          {user}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.similarity.map((row, i) => (
                      <tr key={users[i]}>
                        <th className="border border-slate-200 px-2 py-1 bg-slate-50 text-left font-medium">
                          {users[i]}
                        </th>
                        {row.map((value, j) => {
                          const isMax =
                            i !== j &&
                            ((i === result.maxI && j === result.maxJ) ||
                              (i === result.maxJ && j === result.maxI));
                          const aboveR = i !== j && value + EPS >= result.R;
                          return (
                            <td
                              key={`${i}-${j}`}
                              className={`border border-slate-200 px-2 py-1 text-center font-mono ${
                                isMax
                                  ? 'bg-amber-200 font-semibold'
                                  : aboveR
                                    ? 'bg-emerald-100'
                                    : ''
                              }`}
                            >
                              {i === j ? '0' : formatSim(value)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 className="text-lg font-semibold text-slate-800 mb-1">
                Рекомендации и расчёт Pr
              </h2>
              <p className="text-sm text-slate-500 mb-3">
                разбор формулы для каждого кандидата.
              </p>
              <ul className="space-y-4">
                {result.recommendations.map((rec) => (
                  <li
                    key={rec.user}
                    className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                  >
                    <div className="flex flex-wrap items-baseline gap-2 mb-2">
                      <span className="font-semibold text-slate-800">
                        {rec.user}
                      </span>
                      <span className="text-sm text-slate-500">
                        r̄ = {fmt(rec.mean, 2)}
                      </span>
                      {rec.product ? (
                        <span className="text-indigo-700">
                          → рекомендовать <strong>{rec.product}</strong>
                          {rec.predicted != null && (
                            <span className="text-slate-500 font-normal">
                              {' '}
                              (Pr ≈ {fmt(rec.predicted)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-500">{rec.reason}</span>
                      )}
                    </div>

                    {rec.coldStart && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-600">{rec.reason}</p>
                        <div className="overflow-x-auto">
                          <table className="border-collapse text-sm font-mono">
                            <thead>
                              <tr className="bg-white">
                                <th className="border border-slate-200 px-2 py-1">
                                  Товар
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  MID
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rec.candidates.map((c) => (
                                <tr
                                  key={c.product}
                                  className={
                                    c.product === rec.product
                                      ? 'bg-indigo-100 font-semibold'
                                      : 'bg-white'
                                  }
                                >
                                  <td className="border border-slate-200 px-2 py-1">
                                    {c.product}
                                    {c.product === rec.product ? ' ← рекомендовать' : ''}
                                  </td>
                                  <td className="border border-slate-200 px-2 py-1 text-center">
                                    {fmt(c.predicted, 4)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {!rec.coldStart &&
                      rec.candidates.map((c) => (
                        <PrBreakdownCard
                          key={c.product}
                          breakdown={c.breakdown}
                          aboveThreshold={c.aboveThreshold}
                          recommended={c.product === rec.product}
                        />
                      ))}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PrBreakdownCard({
  breakdown,
  aboveThreshold,
  recommended,
}: {
  breakdown: PrBreakdown;
  aboveThreshold: boolean;
  recommended: boolean;
}) {
  const numParts = breakdown.neighbors.map(
    (n) =>
      `(${fmt(n.rating, 0)} − ${fmt(n.mean, 2)}) · ${fmt(n.similarity)}`,
  );
  const denParts = breakdown.neighbors.map((n) => `|${fmt(n.similarity)}|`);

  return (
    <div
      className={`mb-3 last:mb-0 rounded-lg border p-3 ${
        recommended
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="font-medium text-slate-800">
          Pr({breakdown.user}, {breakdown.product})
        </span>
        <span className="font-mono text-slate-700">= {fmt(breakdown.predicted)}</span>
        {recommended && (
          <span className="text-xs px-2 py-0.5 rounded bg-indigo-200 text-indigo-900">
            рекомендация
          </span>
        )}
        {!aboveThreshold && (
          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-600">
            ниже порога
          </span>
        )}
      </div>

      {breakdown.usedFallbackMean ? (
        <p className="text-sm text-slate-600">
          Нет соседей с cos ≥ R = {fmt(breakdown.R, 2)}, у которых оценён{' '}
          {breakdown.product}. Берём r̄<sub>a</sub> = {fmt(breakdown.meanA, 2)}.
        </p>
      ) : (
        <div className="text-sm text-slate-700 space-y-2 font-mono overflow-x-auto">
          <p>
            r̄<sub>a</sub> = {fmt(breakdown.meanA, 2)}, K ={' '}
            {breakdown.neighbors.map((n) => n.user).join(', ')} (cos ≥{' '}
            {fmt(breakdown.R, 2)})
          </p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-xs mb-2">
              <thead>
                <tr className="bg-slate-50">
                  <th className="border border-slate-200 px-2 py-1">u</th>
                  <th className="border border-slate-200 px-2 py-1">r<sub>u,i</sub></th>
                  <th className="border border-slate-200 px-2 py-1">r̄<sub>u</sub></th>
                  <th className="border border-slate-200 px-2 py-1">cos(a,u)</th>
                  <th className="border border-slate-200 px-2 py-1">
                    (r<sub>u,i</sub> − r̄<sub>u</sub>)·cos
                  </th>
                </tr>
              </thead>
              <tbody>
                {breakdown.neighbors.map((n) => (
                  <tr key={n.user}>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {n.user}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {fmt(n.rating, 0)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {fmt(n.mean, 2)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {fmt(n.similarity)}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {fmt(n.weightedDeviation)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="whitespace-pre-wrap break-all">
            числитель = {numParts.join(' + ')} = {fmt(breakdown.numerator)}
          </p>
          <p className="whitespace-pre-wrap break-all">
            знаменатель = {denParts.join(' + ')} = {fmt(breakdown.denominator)}
          </p>
          <p className="whitespace-pre-wrap break-all font-semibold text-slate-800">
            Pr = {fmt(breakdown.meanA, 2)} + {fmt(breakdown.numerator)} /{' '}
            {fmt(breakdown.denominator)} = {fmt(breakdown.predicted)}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
