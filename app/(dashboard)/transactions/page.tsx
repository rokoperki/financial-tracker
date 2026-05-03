"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type Account = { id: string; name: string };
type Category = { id: string; name: string; color: string };
type Transaction = {
  id: string;
  amountEur: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  description: string | null;
  date: string;
  account: Account;
  category: Category | null;
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

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

  const totalPages = Math.ceil(total / 20);
  const hasFilters = search || accountId || categoryId || type || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex gap-2">
          <Link
            href="/transactions/import"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Import CSV
          </Link>
          <Link
            href="/transactions/new"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Add transaction
          </Link>
        </div>
      </div>

      {importedCount && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Successfully imported {importedCount} transactions.
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <input
            placeholder="Search description…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm col-span-2 sm:col-span-1 lg:col-span-2"
          />
          <select
            value={accountId}
            onChange={(e) => { setAccountId(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm bg-white"
          >
            <option value="">All types</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="TRANSFER">Transfer</option>
          </select>
          <div className="flex gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        {hasFilters && (
          <button onClick={resetFilters} className="text-xs text-zinc-400 hover:text-zinc-700">
            Clear filters
          </button>
        )}
      </div>

      <p className="text-sm text-zinc-400">{total} transaction{total !== 1 ? "s" : ""}</p>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <p className="text-zinc-500">No transactions found.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {tx.category ? (
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tx.category.color }}
                    />
                  ) : (
                    <div className="h-2 w-2 rounded-full flex-shrink-0 bg-zinc-200" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {tx.description ?? tx.category?.name ?? "—"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {tx.account.name} · {new Date(tx.date).toLocaleDateString("en-IE")}
                      {tx.category && ` · ${tx.category.name}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p
                    className={`text-sm font-semibold tabular-nums ${
                      tx.type === "INCOME"
                        ? "text-emerald-600"
                        : tx.type === "EXPENSE"
                        ? "text-red-500"
                        : "text-zinc-500"
                    }`}
                  >
                    {tx.type === "EXPENSE" ? "−" : tx.type === "INCOME" ? "+" : ""}
                    {fmt(Number(tx.amountEur))}
                  </p>
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
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 disabled:opacity-40 hover:bg-zinc-50"
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
