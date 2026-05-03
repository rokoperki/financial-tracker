import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  BANK: "Bank", REVOLUT: "Revolut", CASH: "Cash", SOLFLARE: "Solflare", KAST: "Kast",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [accounts, incomeAgg, expensesAgg, recentTxs, budgets, thisMonthSpending, lastMonthSpending] =
    await Promise.all([
      prisma.account.findMany({
        where: { userId: session.user.id, isActive: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.transaction.aggregate({
        where: { account: { userId: session.user.id }, type: "INCOME", date: { gte: startOfMonth } },
        _sum: { amountEur: true },
      }),
      prisma.transaction.aggregate({
        where: { account: { userId: session.user.id }, type: "EXPENSE", date: { gte: startOfMonth } },
        _sum: { amountEur: true },
      }),
      prisma.transaction.findMany({
        where: { account: { userId: session.user.id } },
        include: { account: true, category: true },
        orderBy: { date: "desc" },
        take: 10,
      }),
      prisma.budget.findMany({
        where: { userId: session.user.id, month: currentMonthStr },
        include: { category: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          account: { userId: session.user.id },
          type: "EXPENSE",
          date: { gte: startOfMonth },
          categoryId: { not: null },
        },
        _sum: { amountEur: true },
      }),
      prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          account: { userId: session.user.id },
          type: "EXPENSE",
          date: { gte: startOfLastMonth, lte: endOfLastMonth },
          categoryId: { not: null },
        },
        _sum: { amountEur: true },
      }),
    ]);

  const netWorth = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const income = Number(incomeAgg._sum.amountEur ?? 0);
  const expenses = Number(expensesAgg._sum.amountEur ?? 0);

  // Budget alerts
  const spendingMap = Object.fromEntries(
    thisMonthSpending.map((s) => [s.categoryId, Number(s._sum.amountEur ?? 0)])
  );
  const alertBudgets = budgets
    .map((b) => ({ ...b, spent: spendingMap[b.categoryId] ?? 0, amount: Number(b.amount) }))
    .filter((b) => b.amount > 0 && (b.spent / b.amount) * 100 >= b.alertThreshold)
    .sort((a, b) => b.spent / b.amount - a.spent / a.amount);

  // Spending insights
  const lastMonthMap = Object.fromEntries(
    lastMonthSpending.map((s) => [s.categoryId, Number(s._sum.amountEur ?? 0)])
  );
  const categoryIds = [...new Set([...thisMonthSpending.map((s) => s.categoryId!), ...lastMonthSpending.map((s) => s.categoryId!)])];
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } } });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const insights = thisMonthSpending
    .map((s) => {
      const catId = s.categoryId!;
      const thisMonth = Number(s._sum.amountEur ?? 0);
      const lastMonth = lastMonthMap[catId] ?? 0;
      if (lastMonth === 0 || thisMonth === 0) return null;
      const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      if (Math.abs(pct) < 10) return null;
      return { catId, name: catMap[catId]?.name ?? "Unknown", pct, thisMonth, lastMonth };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.pct) - Math.abs(a!.pct))
    .slice(0, 3) as { catId: string; name: string; pct: number; thisMonth: number; lastMonth: number }[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-sm">
          {now.toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* Budget alerts */}
      {alertBudgets.length > 0 && (
        <div className="space-y-2">
          {alertBudgets.map((b) => {
            const pct = Math.round((b.spent / b.amount) * 100);
            const exceeded = pct >= 100;
            return (
              <div
                key={b.id}
                className={`flex items-center justify-between rounded-lg px-4 py-2.5 text-sm ${
                  exceeded
                    ? "bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
                    : "bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-400"
                }`}
              >
                <span>
                  <span className="font-medium">{b.category.name}</span>
                  {exceeded ? " budget exceeded" : ` at ${pct}% of budget`}
                </span>
                <span className="font-medium tabular-nums">
                  {fmt(b.spent)} / {fmt(b.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Net worth", value: fmt(netWorth), color: "" },
          { label: "Income this month", value: fmt(income), color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Expenses this month", value: fmt(expenses), color: "text-red-500 dark:text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className={`text-3xl font-semibold mt-1 ${color}`}>{value}</p>
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
                  {fmt(ins.thisMonth)}
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
                <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{TYPE_LABELS[a.type]}</p>
                <p className="font-medium mt-1 truncate text-sm">{a.name}</p>
                <p className="text-xl font-semibold mt-2">{fmt(Number(a.balance), a.currency)}</p>
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
                  {fmt(Number(tx.amountEur))}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
