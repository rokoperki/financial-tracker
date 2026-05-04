"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; type: string; color: string };

const inputCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100";
const selectCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm dark:text-zinc-100";
const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txType, setTxType] = useState("EXPENSE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([a, c]) => { setAccounts(a); setCategories(c); });
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: form.get("accountId"),
        categoryId: form.get("categoryId") || null,
        amount: form.get("amount"),
        currency: form.get("currency"),
        type: form.get("type"),
        description: form.get("description"),
        date: form.get("date"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/transactions");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const filteredCategories = categories.filter((c) => c.type === txType);

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">New transaction</h1>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4"
      >
        <div>
          <label className={labelCls}>Type</label>
          <select
            name="type"
            required
            value={txType}
            onChange={(e) => setTxType(e.target.value)}
            className={selectCls}
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Account</label>
          <select name="accountId" required className={selectCls}>
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Amount</label>
            <input name="amount" type="number" step="0.01" min="0.01" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <input name="currency" defaultValue="EUR" className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>Category</label>
          <select name="categoryId" className={selectCls}>
            <option value="">None</option>
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Date</label>
          <input name="date" type="date" defaultValue={today} required className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <input name="description" placeholder="Optional" className={inputCls} />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
