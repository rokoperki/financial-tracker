"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Transaction = {
  id: string;
  amountEur: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  description: string | null;
  date: string;
  account: { name: string };
  category: { name: string; color: string } | null;
};

function fmt(amount: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(amount);
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  async function load(p: number) {
    const res = await fetch(`/api/transactions?page=${p}`);
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    }
  }

  useEffect(() => { load(page); }, [page]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    load(page);
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Link
          href="/transactions/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Add transaction
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <p className="text-zinc-500">No transactions yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  {tx.category && (
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tx.category.color }}
                    />
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
                    className={`text-sm font-semibold ${
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
                    onClick={() => handleDelete(tx.id)}
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
              <span className="text-sm text-zinc-500">
                {page} / {totalPages}
              </span>
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
