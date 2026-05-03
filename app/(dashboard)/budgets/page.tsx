"use client";
import { useEffect, useState } from "react";

type Category = { id: string; name: string; color: string };
type Budget = {
  id: string;
  categoryId: string;
  amount: number;
  spent: number;
  alertThreshold: number;
  category: Category;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

const inputCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100";
const selectCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm dark:text-zinc-100";
const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    const [bRes, cRes] = await Promise.all([
      fetch(`/api/budgets?month=${month}`),
      fetch("/api/categories"),
    ]);
    if (bRes.ok) setBudgets(await bRes.json());
    if (cRes.ok) setCategories(await cRes.json());
  }

  useEffect(() => { load(); }, [month]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: form.get("categoryId"),
        amount: parseFloat(form.get("amount") as string),
        month,
        alertThreshold: parseInt(form.get("alertThreshold") as string) || 80,
      }),
    });
    setLoading(false);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this budget?")) return;
    await fetch(`/api/budgets/${id}`, { method: "DELETE" });
    load();
  }

  const budgetedIds = new Set(budgets.map((b) => b.categoryId));
  const unbudgetedCategories = categories.filter(
    (c) => c.id && !budgetedIds.has(c.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Budgets</h1>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100"
          />
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            Add budget
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4"
        >
          <h2 className="font-medium">New budget for {month}</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Category</label>
              <select name="categoryId" required className={selectCls}>
                <option value="">Select…</option>
                {unbudgetedCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Limit (EUR)</label>
              <input name="amount" type="number" step="1" min="1" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Alert at (%)</label>
              <input name="alertThreshold" type="number" defaultValue={80} min={1} max={99} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No budgets set for {month}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {budgets.map((b) => {
            const pct = b.amount > 0 ? Math.min(100, (b.spent / b.amount) * 100) : 0;
            const exceeded = pct >= 100;
            const warning = !exceeded && pct >= b.alertThreshold;
            const barColor = exceeded
              ? "bg-red-500"
              : warning
              ? "bg-amber-400"
              : "bg-emerald-500";
            const textColor = exceeded
              ? "text-red-600 dark:text-red-400"
              : warning
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400";

            return (
              <div
                key={b.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-5 py-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: b.category.color }}
                    />
                    <span className="font-medium text-sm">{b.category.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold ${textColor}`}>
                      {fmt(b.spent)} / {fmt(b.amount)}
                    </span>
                    <button
                      onClick={() => handleDelete(b.id)}
                      className="text-xs text-zinc-400 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                  <span>{Math.round(pct)}% used</span>
                  <span>{fmt(Math.max(0, b.amount - b.spent))} remaining</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
