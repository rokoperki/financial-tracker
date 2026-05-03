import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  BANK: "Bank",
  REVOLUT: "Revolut",
  CASH: "Cash",
  SOLFLARE: "Solflare",
  KAST: "Kast",
};

function fmt(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [accounts, incomeAgg, expensesAgg, recentTxs] = await Promise.all([
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
  ]);

  const netWorth = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const income = Number(incomeAgg._sum.amountEur ?? 0);
  const expenses = Number(expensesAgg._sum.amountEur ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-zinc-500 mt-1">
          {now.toLocaleDateString("en-IE", { month: "long", year: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Net worth</p>
          <p className="text-3xl font-semibold mt-1">{fmt(netWorth)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Income this month</p>
          <p className="text-3xl font-semibold mt-1 text-emerald-600">{fmt(income)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-sm text-zinc-500">Expenses this month</p>
          <p className="text-3xl font-semibold mt-1 text-red-500">{fmt(expenses)}</p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Accounts</h2>
          <Link href="/accounts" className="text-sm text-zinc-500 hover:text-zinc-900">
            Manage →
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-zinc-500 mb-3">No accounts yet</p>
            <Link href="/accounts" className="text-sm font-medium text-zinc-900 underline">
              Add your first account
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  {TYPE_LABELS[a.type]}
                </p>
                <p className="font-medium mt-1 truncate">{a.name}</p>
                <p className="text-xl font-semibold mt-2">
                  {fmt(Number(a.balance), a.currency)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link href="/transactions" className="text-sm text-zinc-500 hover:text-zinc-900">
            View all →
          </Link>
        </div>
        {recentTxs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center">
            <p className="text-zinc-500 mb-3">No transactions yet</p>
            <Link href="/transactions/new" className="text-sm font-medium text-zinc-900 underline">
              Add a transaction
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {tx.description ?? tx.category?.name ?? "—"}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {tx.account.name} · {new Date(tx.date).toLocaleDateString("en-IE")}
                  </p>
                </div>
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
