import React, { useMemo, useRef, useState } from 'react';
import { copyMatrix } from './math';
import { parsePreferenceText } from './parseMatrix';
import {
  filterPreferenceMatrix,
  formatVector,
  meanNonZero,
  toCoo,
  toCsr,
  toEllpack,
} from './sparse';

const defaultUsers = ['U1', 'U2', 'U3', 'U4', 'U5'];
const defaultProducts = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

/** Матрица предпочтений 0 из задания 3 */
const exampleCsv = `,U1,U2,U3,U4,U5
P1,5,4,5,0,5
P2,5,5,5,0,5
P3,5,4,4,0,5
P4,4,3,4,0,3
P5,0,0,0,0,0
P6,4,5,5,0,1
`;

const defaultMatrix = [
  [5, 4, 5, 0, 5],
  [5, 5, 5, 0, 5],
  [5, 4, 4, 0, 5],
  [4, 3, 4, 0, 3],
  [0, 0, 0, 0, 0],
  [4, 5, 5, 0, 1],
];

function App() {
  const [users, setUsers] = useState<string[]>(defaultUsers);
  const [products, setProducts] = useState<string[]>(defaultProducts);
  const [matrix, setMatrix] = useState<number[][]>(defaultMatrix);
  const [error, setError] = useState('');
  const [lowRatingInput, setLowRatingInput] = useState('4');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lowRatingThreshold = Number(lowRatingInput.replace(',', '.'));
  const lowRatingValid = !Number.isNaN(lowRatingThreshold);

  const coo = useMemo(() => toCoo(matrix), [matrix]);
  const csr = useMemo(() => toCsr(matrix), [matrix]);
  const ell = useMemo(() => toEllpack(matrix), [matrix]);
  const productMeans = useMemo(
    () => matrix.map((row) => meanNonZero(row)),
    [matrix],
  );
  const filtered = useMemo(() => {
    if (!lowRatingValid) return null;
    return filterPreferenceMatrix(products, users, matrix, {
      lowRatingThreshold,
    });
  }, [products, users, matrix, lowRatingThreshold, lowRatingValid]);

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

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          Хранение разреженных матриц
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
            onClick={resetExample}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            Сбросить пример
          </button>
          <label className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-700">
            Низкий рейтинг &lt;
            <input
              type="number"
              step="0.1"
              value={lowRatingInput}
              onChange={(e) => setLowRatingInput(e.target.value)}
              className="w-16 text-center border-b border-slate-300 focus:border-indigo-400 focus:outline-none"
            />
          </label>
        </div>

        {error && (
          <div className="mb-4 text-red-600 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm text-slate-600">
              Матрица предпочтений 0 (задание 3). MID — среднее ненулевых оценок.
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
                <th className="px-3 py-2 text-sm text-slate-500">MID</th>
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
                  <td className="px-3 py-2 text-center font-mono text-sm text-slate-600">
                    {productMeans[i].toFixed(1).replace('.', ',')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold text-slate-800">Структуры хранения</h2>

          <SparseBlock
            title="1. value, row, col"
            description="Каждый ненулевой элемент хранится тройкой (значение, строка, столбец)."
          >
            <ArrayLine label="Value" values={coo.value} />
            <ArrayLine label="Row" values={coo.row} />
            <ArrayLine label="Col" values={coo.col} />
          </SparseBlock>

          <SparseBlock
            title="2. value, col, rowIndex"
            description="Ненулевые по строкам; rowIndex[i] — начало строки i в массивах value/col."
          >
            <ArrayLine label="Value" values={csr.value} />
            <ArrayLine label="Col" values={csr.col} />
            <ArrayLine label="RowIndex" values={csr.rowIndex} />
          </SparseBlock>

          <SparseBlock
            title="3. ELLPACK"
            description={`Две матрицы размера ${ell.value.length}×${ell.maxNonZeros}: значения и индексы столбцов (паддинг нулями).`}
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <EllTable title="Value" data={ell.value} rowLabels={products} />
              <EllTable title="Column" data={ell.column} rowLabels={products} />
            </div>
          </SparseBlock>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="font-semibold text-slate-800 mb-1">
              4. Исключение товаров и пользователей
            </h3>
            <p className="text-sm text-slate-500 mb-3">
              Автоматически: нулевой рейтинг, низкий рейтинг (MID &lt;{' '}
              {lowRatingValid ? lowRatingThreshold : '…'}) и неактивные пользователи.
            </p>
            {!filtered ? (
              <p className="text-sm text-red-600">Порог низкого рейтинга должен быть числом</p>
            ) : (
              <>
                <div className="text-sm text-slate-600 mb-3 space-y-1">
                  <p>
                    Удалены товары:{' '}
                    {filtered.removedProducts.length
                      ? filtered.removedProducts.join(', ')
                      : '—'}
                  </p>
                  <p>
                    Удалены пользователи:{' '}
                    {filtered.removedUsers.length
                      ? filtered.removedUsers.join(', ')
                      : '—'}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Матрица предпочтений 1
                </p>
                {filtered.matrix.length === 0 || filtered.users.length === 0 ? (
                  <p className="text-sm text-slate-500">После фильтрации матрица пуста</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border border-slate-200 px-2 py-1 bg-slate-50" />
                          {filtered.users.map((user) => (
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
                        {filtered.matrix.map((row, i) => (
                          <tr key={filtered.products[i]}>
                            <th className="border border-slate-200 px-2 py-1 bg-slate-50 text-left font-medium">
                              {filtered.products[i]}
                            </th>
                            {row.map((value, j) => (
                              <td
                                key={`${i}-${j}`}
                                className="border border-slate-200 px-2 py-1 text-center font-mono"
                              >
                                {value}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function SparseBlock({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-800 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 mb-3">{description}</p>
      <div className="space-y-2 font-mono text-sm overflow-x-auto">{children}</div>
    </div>
  );
}

function ArrayLine({ label, values }: { label: string; values: number[] }) {
  return (
    <p>
      <span className="text-slate-500 mr-2">{label}:</span>
      <span className="text-slate-800">{formatVector(values)}</span>
    </p>
  );
}

function EllTable({
  title,
  data,
  rowLabels,
}: {
  title: string;
  data: number[][];
  rowLabels: string[];
}) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500">{title}: пусто</p>;
  }
  const cols = data[0]?.length ?? 0;
  return (
    <div>
      <p className="text-sm font-sans text-slate-600 mb-2">{title}</p>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 px-2 py-1 bg-slate-50" />
            {Array.from({ length: cols }, (_, k) => (
              <th key={k} className="border border-slate-200 px-2 py-1 bg-slate-50">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              <th className="border border-slate-200 px-2 py-1 bg-slate-50 text-left font-sans font-medium">
                {rowLabels[i] ?? i}
              </th>
              {row.map((v, j) => (
                <td key={j} className="border border-slate-200 px-2 py-1 text-center">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
