"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseRevolutCSV, type ParsedTransaction } from "@/lib/csv-parsers";

type Account = { id: string; name: string; currency: string };

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
}

const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const selectCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm dark:text-zinc-100";

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [source, setSource] = useState("revolut");
  const [preview, setPreview] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data);
        if (data.length > 0) setAccountId(data[0].id);
      });
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const rows = source === "revolut" ? parseRevolutCSV(text) : [];
        if (rows.length === 0) {
          setError("No valid transactions found. Check the file format.");
        }
        setPreview(rows);
      } catch {
        setError("Failed to parse file.");
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!accountId || preview.length === 0) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/transactions/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        transactions: preview.map((t) => ({
          ...t,
          date: t.date.toISOString(),
        })),
      }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/transactions?imported=${data.imported}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Import failed");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Import transactions</h1>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={selectCls}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Source</label>
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value); setPreview([]); }}
              className={selectCls}
            >
              <option value="revolut">Revolut CSV</option>
              <option value="bank" disabled>Bank CSV (coming soon)</option>
            </select>
          </div>
        </div>

        <div>
          <label className={labelCls}>CSV file</label>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="block w-full text-sm text-zinc-500 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 dark:file:bg-zinc-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 dark:file:text-zinc-300 hover:file:bg-zinc-200 dark:hover:file:bg-zinc-600"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>

      {preview.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {preview.length} transactions parsed
            </p>
            <button
              onClick={handleImport}
              disabled={loading}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
            >
              {loading ? "Importing…" : `Import ${preview.length} transactions`}
            </button>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)] max-h-96 overflow-y-auto">
            {preview.map((t, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">{t.description || "—"}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {t.date.toLocaleDateString("en-IE")} · {t.currency}
                  </p>
                </div>
                <p
                  className={`text-sm font-semibold ${
                    t.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {t.type === "EXPENSE" ? "−" : "+"}
                  {fmt(t.amount, t.currency)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
