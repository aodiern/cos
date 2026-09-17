import React, { useRef, useState } from 'react';
import {
  allColumnVectors,
  allPairSimilarities,
  copyMatrix,
  PairSimilarity,
  takeFirst,
} from './math';
import { parsePreferenceText } from './parseMatrix';

const defaultUsers = ['U1', 'U2', 'U3', 'U4', 'U5'];
const defaultProducts = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

const exampleCsv = `,U1,U2,U3,U4,U5
P1,5,4,5,3,5
P2,5,5,5,3,5
P3,5,4,4,2,5
P4,5,3,5,0,3
P5,5,0,5,0,0
P6,4,5,5,3,1
`;

const defaultMatrix = [
  [5, 4, 5, 3, 5],
  [5, 5, 5, 3, 5],
  [5, 4, 4, 2, 5],
  [5, 3, 5, 0, 3],
  [5, 0, 5, 0, 0],
  [4, 5, 5, 3, 1],
];

function App() {
  const [users, setUsers] = useState<string[]>(defaultUsers);
  const [products, setProducts] = useState<string[]>(defaultProducts);
  const [matrix, setMatrix] = useState<number[][]>(defaultMatrix);
  const [results, setResults] = useState<{
    topProducts: PairSimilarity[];
    topUsers: PairSimilarity[];
  } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setResults(null);
  };

  const addProduct = () => {
    setProducts([...products, `P${products.length + 1}`]);
    setMatrix([...matrix, users.map(() => 0)]);
    setResults(null);
  };

  const removeUser = (index: number) => {
    if (users.length <= 2) {
      setError('Нужно минимум 2 пользователя');
      return;
    }
    setError('');
    setUsers(users.filter((_, i) => i !== index));
    setMatrix(matrix.map((row) => row.filter((_, j) => j !== index)));
    setResults(null);
  };

  const removeProduct = (index: number) => {
    if (products.length <= 2) {
      setError('Нужно минимум 2 продукта');
      return;
    }
    setError('');
    setProducts(products.filter((_, i) => i !== index));
    setMatrix(matrix.filter((_, i) => i !== index));
    setResults(null);
  };

  const calculate = () => {
    setError('');
    const productPairs = allPairSimilarities(matrix, products);
    const userPairs = allPairSimilarities(allColumnVectors(matrix), users);
    setResults({
      topProducts: takeFirst(productPairs, 2),
      topUsers: takeFirst(userPairs, 2),
    });
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
      setResults(null);
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

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-6">
          Косинусное сходство
        </h1>

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
          <button
            onClick={calculate}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium ml-auto"
          >
            Рассчитать
          </button>
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm text-slate-600">
              Пример файла CSV: первая строка — пользователи, первый столбец — продукты
            </p>
            <button
              onClick={downloadExample}
              className="text-sm text-indigo-600 hover:text-indigo-800"
            >
              Скачать example.csv
            </button>
          </div>
          <pre className="text-sm font-mono bg-slate-50 rounded-lg p-3 overflow-x-auto text-slate-700">{exampleCsv.trim()}</pre>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto mb-8">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="px-3 py-2 text-left text-sm text-slate-500">Продукт</th>
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
            </tbody>
          </table>
        </div>

        {results && (
          <div className="grid sm:grid-cols-2 gap-6">
            <ResultList title="Близкие продукты" pairs={results.topProducts} />
            <ResultList title="Близкие пользователи" pairs={results.topUsers} />
          </div>
        )}
      </main>
    </div>
  );
}

function ResultList({ title, pairs }: { title: string; pairs: PairSimilarity[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="font-semibold text-slate-800 mb-3">{title}</h2>
      <ol className="space-y-2">
        {pairs.map((pair, idx) => (
          <li key={`${pair.name1}-${pair.name2}`} className="flex justify-between gap-3">
            <span>
              {idx + 1}. {pair.name1} – {pair.name2}
            </span>
            <span className="font-mono">{pair.similarity.toFixed(4)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default App;
