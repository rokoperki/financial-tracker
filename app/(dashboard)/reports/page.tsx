"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";

type ChartData = {
  spendingByCategory: { name: string; value: number; color: string }[];
  incomeVsExpenses: { month: string; income: number; expenses: number }[];
  netWorthTrend: { month: string; value: number }[];
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/reports/charts?month=${month}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [month]);

  function downloadCSV() {
    const params = new URLSearchParams({ dateFrom: `${month}-01`, dateTo: `${month}-31` });
    window.location.href = `/api/reports/export?${params}`;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100"
          />
          <button
            onClick={downloadCSV}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-zinc-400 text-sm">
          Loading…
        </div>
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Spending by category */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-4">Spending by category</h2>
              {data.spendingByCategory.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">No expense data</p>
              ) : (
                <div className="flex gap-4 items-center">
                  <ResponsiveContainer width="60%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.spendingByCategory}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {data.spendingByCategory.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {data.spendingByCategory.map((e, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: e.color }} />
                          <span className="truncate text-zinc-600 dark:text-zinc-400">{e.name}</span>
                        </div>
                        <span className="font-medium tabular-nums flex-shrink-0">{fmt(e.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Net worth trend */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-4">Net worth trend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.netWorthTrend} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={70} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} name="Net worth" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Income vs expenses */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="font-semibold mb-4">Income vs expenses — last 6 months</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.incomeVsExpenses} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmt(v)} width={70} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
                <Bar dataKey="income" fill="#22c55e" name="Income" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" fill="#f87171" name="Expenses" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
