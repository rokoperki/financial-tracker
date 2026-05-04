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
  AreaChart,
  Area,
} from "recharts";

type Account = { id: string; name: string };
type ChartData = {
  spendingByCategory: { id: string; name: string; value: number; color: string }[];
  incomeVsExpenses: { month: string; monthKey: string; income: number; expenses: number }[];
  netWorthTrend: { month: string; monthKey: string; value: number }[];
  dailyBreakdown: { day: number; income: number; expenses: number }[];
};
type TxItem = {
  id: string;
  description: string | null;
  amount: string;
  amountEur: string;
  currency: string;
  type: string;
  date: string;
  account: { name: string };
  category: { name: string; color: string } | null;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

export default function ReportsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [txsLoading, setTxsLoading] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ month });
    if (accountId) params.set("accountId", accountId);
    fetch(`/api/reports/charts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, [month, accountId]);

  useEffect(() => {
    setSelectedCategoryId(null);
    setSelectedCategoryName(null);
    setSelectedDay(null);
  }, [month]);

  useEffect(() => {
    setTxsLoading(true);
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
    if (selectedDay) {
      const dayStr = String(selectedDay).padStart(2, "0");
      params.set("dateFrom", `${month}-${dayStr}`);
      params.set("dateTo", `${month}-${dayStr}`);
    } else {
      params.set("dateFrom", `${month}-01`);
      params.set("dateTo", `${month}-31`);
    }
    fetch(`/api/transactions?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setTxs(d.transactions ?? []);
        setTxsLoading(false);
      });
  }, [month, accountId, selectedCategoryId, selectedDay]);

  function downloadCSV() {
    const params = new URLSearchParams({
      dateFrom: `${month}-01`,
      dateTo: `${month}-31`,
    });
    if (accountId) params.set("accountId", accountId);
    window.location.href = `/api/reports/export?${params}`;
  }

  function toggleCategory(id: string, name: string) {
    if (selectedCategoryId === id) {
      setSelectedCategoryId(null);
      setSelectedCategoryName(null);
    } else {
      setSelectedCategoryId(id);
      setSelectedCategoryName(name);
    }
  }

  function toggleDay(day: number) {
    setSelectedDay(selectedDay === day ? null : day);
  }

  const hasDailyData =
    data && data.dailyBreakdown.some((d) => d.income > 0 || d.expenses > 0);

  const activeFilters = [
    selectedCategoryName
      ? {
          label: selectedCategoryName,
          clear: () => {
            setSelectedCategoryId(null);
            setSelectedCategoryName(null);
          },
        }
      : null,
    selectedDay ? { label: `Day ${selectedDay}`, clear: () => setSelectedDay(null) } : null,
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm dark:text-zinc-100"
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
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
          {/* Row 1: spending by category + net worth */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-1">Spending by category</h2>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
                Click a category to filter transactions
              </p>
              {data.spendingByCategory.length === 0 ? (
                <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
                  No expense data
                </p>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: isMobile ? "column" : "row",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{ width: isMobile ? "100%" : "60%", flexShrink: 0 }}
                  >
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={data.spendingByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          onClick={(entry: any) => toggleCategory(entry.id, entry.name)}
                          style={{ cursor: "pointer" }}
                        >
                          {data.spendingByCategory.map((entry, i) => (
                            <Cell
                              key={i}
                              fill={entry.color}
                              opacity={
                                selectedCategoryId && selectedCategoryId !== entry.id
                                  ? 0.3
                                  : 1
                              }
                              stroke={selectedCategoryId === entry.id ? "#fff" : "none"}
                              strokeWidth={selectedCategoryId === entry.id ? 2 : 0}
                            />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => fmtFull(Number(v))} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div
                    style={{ flex: 1, minWidth: 0, width: "100%" }}
                    className="space-y-1.5"
                  >
                    {data.spendingByCategory.map((e, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-xs cursor-pointer rounded px-1 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                        style={{
                          opacity:
                            selectedCategoryId && selectedCategoryId !== e.id ? 0.35 : 1,
                        }}
                        onClick={() => toggleCategory(e.id, e.name)}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="h-2 w-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: e.color }}
                          />
                          <span className="truncate text-zinc-600 dark:text-zinc-400">
                            {e.name}
                          </span>
                        </div>
                        <span className="font-medium tabular-nums flex-shrink-0">
                          {fmtFull(e.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
              <h2 className="font-semibold mb-4">
                {accountId ? "Account balance trend" : "Net worth trend"} — 12
                months
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data.netWorthTrend}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                  style={{ cursor: "pointer" }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={(chartData: any) => {
                    const entry = data.netWorthTrend.find(
                      (d) => d.month === chartData?.activeLabel,
                    );
                    if (entry?.monthKey) setMonth(entry.monthKey);
                  }}
                >
                  <defs>
                    <linearGradient
                      id="netWorthGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => fmt(v)}
                    width={70}
                  />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#netWorthGrad)"
                    name={accountId ? "Balance" : "Net worth"}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: daily breakdown */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="font-semibold mb-1">
              Daily breakdown —{" "}
              {new Date(
                year(month),
                month.split("-").map(Number)[1] - 1,
                1,
              ).toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
            </h2>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4">
              Click a day to filter transactions
            </p>
            {!hasDailyData ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-8 text-center">
                No transactions this month
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={data.dailyBreakdown}
                  margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                  barCategoryGap="20%"
                  style={{ cursor: "pointer" }}
                  onClick={(chartData) => {
                    if (chartData?.activeLabel != null) {
                      toggleDay(Number(chartData.activeLabel));
                    }
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border)"
                    vertical={isMobile}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => fmt(v)}
                    width={70}
                  />
                  <Tooltip
                    formatter={(v, name) => [fmt(Number(v)), name]}
                    labelFormatter={(d) => `Day ${d}`}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#22c55e" name="Income" radius={[2, 2, 0, 0]}>
                    {data.dailyBreakdown.map((entry, index) => (
                      <Cell
                        key={index}
                        fill="#22c55e"
                        opacity={selectedDay && selectedDay !== entry.day ? 0.25 : 1}
                      />
                    ))}
                  </Bar>
                  <Bar dataKey="expenses" fill="#f87171" name="Expenses" radius={[2, 2, 0, 0]}>
                    {data.dailyBreakdown.map((entry, index) => (
                      <Cell
                        key={index}
                        fill="#f87171"
                        opacity={selectedDay && selectedDay !== entry.day ? 0.25 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Row 3: income vs expenses */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <h2 className="font-semibold mb-4">
              Income vs expenses — last 6 months
            </h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data.incomeVsExpenses}
                margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => fmt(v)}
                  width={70}
                />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Legend />
                <Bar
                  dataKey="income"
                  fill="#22c55e"
                  name="Income"
                  radius={[3, 3, 0, 0]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={(d: any) => d.monthKey && setMonth(d.monthKey)}
                />
                <Bar
                  dataKey="expenses"
                  fill="#f87171"
                  name="Expenses"
                  radius={[3, 3, 0, 0]}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={(d: any) => d.monthKey && setMonth(d.monthKey)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Transactions */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold">Transactions</h2>
                {activeFilters.map((f) => (
                  <span
                    key={f.label}
                    className="inline-flex items-center gap-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 text-xs font-medium"
                  >
                    {f.label}
                    <button
                      onClick={f.clear}
                      className="hover:text-indigo-900 dark:hover:text-indigo-100 leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {activeFilters.length > 1 && (
                <button
                  onClick={() => {
                    setSelectedCategoryId(null);
                    setSelectedCategoryName(null);
                    setSelectedDay(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                >
                  Clear all
                </button>
              )}
            </div>
            {txsLoading ? (
              <p className="text-sm text-zinc-400 py-6 text-center">Loading…</p>
            ) : txs.length === 0 ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-6 text-center">
                No transactions
              </p>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-2.5 gap-4"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {tx.description ?? tx.category?.name ?? "—"}
                      </p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{tx.account.name}</span>
                        <span>·</span>
                        <span>{new Date(tx.date).toLocaleDateString("en-IE")}</span>
                        {tx.category && (
                          <>
                            <span>·</span>
                            <span
                              className="h-1.5 w-1.5 rounded-full inline-block flex-shrink-0"
                              style={{ backgroundColor: tx.category.color }}
                            />
                            <span>{tx.category.name}</span>
                          </>
                        )}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-semibold tabular-nums flex-shrink-0 ${
                        tx.type === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : tx.type === "EXPENSE"
                            ? "text-red-500 dark:text-red-400"
                            : "text-zinc-500"
                      }`}
                    >
                      {tx.type === "EXPENSE" ? "−" : tx.type === "INCOME" ? "+" : ""}
                      {fmtFull(Number(tx.amountEur))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function year(month: string) {
  return Number(month.split("-")[0]);
}
