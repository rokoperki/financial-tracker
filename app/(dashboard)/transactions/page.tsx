"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Account = { id: string; name: string };
type Category = { id: string; name: string; color: string; type: string };
type Transaction = {
  id: string;
  amount: string;
  amountEur: string;
  currency: string;
  type: "INCOME" | "EXPENSE" | string;
  description: string | null;
  date: string;
  account: Account;
  category: Category | null;
};

type EditForm = {
  type: string;
  description: string;
  categoryId: string;
  date: string;
  amount: string;
  currency: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

const inputCls = "rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100";
const selectCls = "rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm dark:text-zinc-100";

function TransactionsInner() {
  const searchParams = useSearchParams();
  const importedCount = searchParams.get("imported");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [search, setSearch] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ type: "EXPENSE", description: "", categoryId: "", date: "", amount: "", currency: "EUR" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]).then(([a, c]) => { setAccounts(a); setCategories(c); });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (type) params.set("type", type);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((data) => { setTransactions(data.transactions); setTotal(data.total); });
  }, [page, search, accountId, categoryId, type, dateFrom, dateTo]);

  function resetFilters() {
    setSearch(""); setAccountId(""); setCategoryId("");
    setType(""); setDateFrom(""); setDateTo(""); setPage(1);
  }

  function startEdit(tx: Transaction) {
    setEditingId(tx.id);
    setEditForm({
      type: tx.type,
      description: tx.description ?? "",
      categoryId: tx.category?.id ?? "",
      date: new Date(tx.date).toISOString().split("T")[0],
      amount: tx.amount,
      currency: tx.currency,
    });
  }

  async function saveEdit(tx: Transaction) {
    setSaving(true);
    const res = await fetch(`/api/transactions/${tx.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: editForm.type,
        description: editForm.description || null,
        categoryId: editForm.categoryId || null,
        date: editForm.date,
        amount: editForm.amount,
        currency: editForm.currency,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setTransactions((prev) => prev.map((t) => (t.id === tx.id ? { ...t, ...updated } : t)));
      setEditingId(null);
    }
  }

  const totalPages = Math.ceil(total / 20);
  const hasFilters = search || accountId || categoryId || type || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex gap-2">
          <Link
            href="/transactions/import"
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Import CSV
          </Link>
          <Link
            href="/transactions/new"
            className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300"
          >
            Add transaction
          </Link>
        </div>
      </div>

      {importedCount && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          Successfully imported {importedCount} transactions.
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
        <input
          placeholder="Search by description…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className={`${inputCls} w-full`}
        />
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Account</span>
            <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All accounts</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[130px]">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Category</span>
            <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[110px]">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Type</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={selectCls}>
              <option value="">All types</option>
              <option value="INCOME">Income</option>
              <option value="EXPENSE">Expense</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">From</span>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">To</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className={inputCls} />
          </div>
          {hasFilters && (
            <button onClick={resetFilters} className="self-end pb-0.5 text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-zinc-400 dark:text-zinc-500">{total} transaction{total !== 1 ? "s" : ""}</p>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No transactions found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {transactions.map((tx) => {
              const isEditing = editingId === tx.id;
              const filteredCats = categories.filter((c) => c.type === editForm.type);

              return (
                <div key={tx.id}>
                  {/* Display row */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {tx.category ? (
                        <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: tx.category.color }} />
                      ) : (
                        <div className="h-2 w-2 rounded-full flex-shrink-0 bg-zinc-200 dark:bg-zinc-700" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{tx.description ?? tx.category?.name ?? "—"}</p>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          {tx.account.name} · {new Date(tx.date).toLocaleDateString("en-IE")}
                          {tx.category && ` · ${tx.category.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`text-sm font-semibold tabular-nums ${
                        tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400"
                        : tx.type === "EXPENSE" ? "text-red-500 dark:text-red-400"
                        : "text-zinc-500"
                      }`}>
                        {tx.type === "EXPENSE" ? "−" : tx.type === "INCOME" ? "+" : ""}
                        {fmt(Number(tx.amountEur))}
                      </p>
                      <button
                        onClick={() => isEditing ? setEditingId(null) : startEdit(tx)}
                        className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Delete this transaction?")) return;
                          await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
                          setTransactions((prev) => prev.filter((t) => t.id !== tx.id));
                          setTotal((n) => n - 1);
                        }}
                        className="text-xs text-zinc-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline edit form */}
                  {isEditing && (
                    <div className="px-4 pb-4 pt-1 bg-zinc-50 dark:bg-zinc-800/50 border-t border-[var(--border)]">
                      <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Type</span>
                          <select
                            value={editForm.type}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, type: e.target.value, categoryId: "" }))
                            }
                            className={selectCls}
                          >
                            <option value="INCOME">Income</option>
                            <option value="EXPENSE">Expense</option>
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Description</span>
                          <input
                            value={editForm.description}
                            onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                            placeholder="Optional"
                            className={`${inputCls} min-w-[160px]`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Amount</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={editForm.amount}
                            onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                            className={`${inputCls} w-28`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Currency</span>
                          <input
                            value={editForm.currency}
                            onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                            className={`${inputCls} w-20`}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Category</span>
                          <select
                            value={editForm.categoryId}
                            onChange={(e) => setEditForm((f) => ({ ...f, categoryId: e.target.value }))}
                            className={`${selectCls} min-w-[130px]`}
                          >
                            <option value="">None</option>
                            {filteredCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Date</span>
                          <input
                            type="date"
                            value={editForm.date}
                            onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))}
                            className={inputCls}
                          />
                        </div>
                        <button
                          onClick={() => saveEdit(tx)}
                          disabled={saving}
                          className="self-end rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 dark:text-zinc-300 disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsInner />
    </Suspense>
  );
}
