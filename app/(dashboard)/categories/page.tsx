"use client";
import { useEffect, useState } from "react";

type Category = {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
};

const inputCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100";
const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formType, setFormType] = useState<"EXPENSE" | "INCOME">("EXPENSE");

  async function load() {
    const res = await fetch("/api/categories");
    if (res.ok) setCategories(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        color: form.get("color"),
      }),
    });
    setLoading(false);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this category? Transactions using it will lose their category.")) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    load();
  }

  const expenses = categories.filter((c) => c.type === "EXPENSE");
  const incomes = categories.filter((c) => c.type === "INCOME");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300"
        >
          Add category
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4"
        >
          <h2 className="font-medium">New category</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Name</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Color</label>
              <input
                name="color"
                type="color"
                defaultValue="#6366f1"
                className="h-9 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 px-1 py-1 cursor-pointer bg-transparent"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <div className="flex gap-3">
              {(["EXPENSE", "INCOME"] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={formType === t}
                    onChange={() => setFormType(t)}
                    className="accent-zinc-900 dark:accent-zinc-100"
                  />
                  <span className="text-sm">{t === "EXPENSE" ? "Expense" : "Income"}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
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

      {[{ label: "Expense categories", items: expenses }, { label: "Income categories", items: incomes }].map(
        ({ label, items }) => (
          <div key={label}>
            <h2 className="font-medium text-zinc-500 dark:text-zinc-400 text-sm uppercase tracking-wide mb-2">
              {label}
            </h2>
            {items.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-2">None</p>
            ) : (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
                {items.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="text-sm font-medium">{c.name}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-zinc-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
