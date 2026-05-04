"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  BANK: "Bank", REVOLUT: "Revolut", CASH: "Cash", SOLFLARE: "Solflare", KAST: "Kast",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
}

function Money({ n, currency = "EUR", hidden }: { n: number; currency?: string; hidden: boolean }) {
  if (hidden) return <span className="tracking-widest select-none">••••••</span>;
  return <>{fmt(n, currency)}</>;
}

export type DashboardData = {
  netWorth: number;
  income: number;
  expenses: number;
  currentMonthLabel: string;
  insights: {
    catId: string;
    name: string;
    pct: number;
    thisMonth: number;
    lastMonth: number;
  }[];
  accounts: {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
  }[];
  recentTxs: {
    id: string;
    description: string | null;
    type: string;
    amountEur: number;
    date: string;
    account: { name: string };
    category: { name: string; color: string } | null;
  }[];
};

export function DashboardView(props: DashboardData) {
  const { netWorth, income, expenses, currentMonthLabel, insights, accounts, recentTxs } = props;
  const [hidden, setHidden] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-amounts-hidden");
    if (stored !== null) setHidden(stored === "true");
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem("dashboard-amounts-hidden", String(next));
  }

  async function recalculate() {
    setRecalculating(true);
    await fetch("/api/accounts/recalculate", { method: "POST" });
    setRecalculating(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-sm">{currentMonthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
        <button
          onClick={recalculate}
          disabled={recalculating}
          className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          {recalculating ? "Recalculating…" : "Recalculate"}
        </button>
        <button
          onClick={toggle}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {hidden ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          )}
          {hidden ? "Show" : "Hide"}
        </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Net worth", value: netWorth, color: "" },
          { label: "Income this month", value: income, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Expenses this month", value: expenses, color: "text-red-500 dark:text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className={`text-3xl font-semibold mt-1 ${color}`}>
              <Money n={value} hidden={hidden} />
            </p>
          </div>
        ))}
      </div>

      {/* Spending insights */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Insights
          </h2>
          <div className="space-y-2">
            {insights.map((ins) => (
              <div key={ins.catId} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">{ins.name}</span>
                  {ins.pct > 0
                    ? ` up ${ins.pct}% vs last month`
                    : ` down ${Math.abs(ins.pct)}% vs last month`}
                </span>
                <span className={`tabular-nums font-medium ${ins.pct > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  <Money n={ins.thisMonth} hidden={false} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Accounts</h2>
          <Link href="/accounts" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Manage →
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-zinc-500 mb-3">No accounts yet</p>
            <Link href="/accounts" className="text-sm font-medium underline">Add your first account</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                  {TYPE_LABELS[a.type] ?? a.type}
                </p>
                <p className="font-medium mt-1 truncate text-sm">{a.name}</p>
                <p className="text-xl font-semibold mt-2">
                  <Money n={a.balance} currency={a.currency} hidden={hidden} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link href="/transactions" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            View all →
          </Link>
        </div>
        {recentTxs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-zinc-500 mb-3">No transactions yet</p>
            <Link href="/transactions/new" className="text-sm font-medium underline">Add a transaction</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{tx.description ?? tx.category?.name ?? "—"}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {tx.account.name} · {new Date(tx.date).toLocaleDateString("en-IE")}
                  </p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${
                  tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400"
                  : tx.type === "EXPENSE" ? "text-red-500 dark:text-red-400"
                  : "text-zinc-500"
                }`}>
                  {tx.type === "EXPENSE" ? "−" : tx.type === "INCOME" ? "+" : ""}
                  <Money n={tx.amountEur} hidden={false} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
