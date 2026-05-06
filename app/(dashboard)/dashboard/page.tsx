import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getEurRate } from "@/lib/exchange-rates";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 29);

  const [
    accounts,
    incomeAgg,
    expensesAgg,
    recentTxs,
    thisMonthSpending,
    lastMonthSpending,
    sparklineTxs,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.aggregate({
      where: {
        account: { userId: session.user.id },
        type: "INCOME",
        date: { gte: startOfMonth },
        NOT: { category: { name: "Transfer" } },
      },
      _sum: { amountEur: true },
    }),
    prisma.transaction.aggregate({
      where: {
        account: { userId: session.user.id },
        type: "EXPENSE",
        date: { gte: startOfMonth },
        NOT: { category: { name: "Transfer" } },
      },
      _sum: { amountEur: true },
    }),
    prisma.transaction.findMany({
      where: { account: { userId: session.user.id } },
      include: { account: true, category: true },
      orderBy: { date: "desc" },
      take: 10,
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
    prisma.transaction.findMany({
      where: {
        account: { userId: session.user.id, isActive: true },
        type: { in: ["INCOME", "EXPENSE"] },
        date: { gte: thirtyDaysAgo },
      },
      select: {
        accountId: true,
        amount: true,
        amountEur: true,
        type: true,
        date: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const currencies = [...new Set(accounts.map((a) => a.currency))];
  const rates = Object.fromEntries(
    await Promise.all(currencies.map(async (c) => [c, await getEurRate(c)])),
  );
  const netWorth = accounts.reduce(
    (s, a) => s + Number(a.balance) * rates[a.currency],
    0,
  );
  const income = Number(incomeAgg._sum.amountEur ?? 0);
  const expenses = Number(expensesAgg._sum.amountEur ?? 0);

  const lastMonthMap = Object.fromEntries(
    lastMonthSpending.map((s) => [s.categoryId, Number(s._sum.amountEur ?? 0)]),
  );
  const categoryIds = [
    ...new Set([
      ...thisMonthSpending.map((s) => s.categoryId!),
      ...lastMonthSpending.map((s) => s.categoryId!),
    ]),
  ];
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const insights = thisMonthSpending
    .map((s) => {
      const catId = s.categoryId!;
      const thisMonth = Number(s._sum.amountEur ?? 0);
      const lastMonth = lastMonthMap[catId] ?? 0;
      if (lastMonth === 0 || thisMonth === 0) return null;
      const pct = Math.round(((thisMonth - lastMonth) / lastMonth) * 100);
      if (Math.abs(pct) < 10) return null;
      return {
        catId,
        name: catMap[catId]?.name ?? "Unknown",
        pct,
        thisMonth,
        lastMonth,
      };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.pct) - Math.abs(a!.pct))
    .slice(0, 3) as {
    catId: string;
    name: string;
    pct: number;
    thisMonth: number;
    lastMonth: number;
  }[];

  // Build 30-day sparklines per account (cumulative net change from 30 days ago)
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(thirtyDaysAgo);
    d.setDate(thirtyDaysAgo.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  const sparklines = accounts.map((account) => {
    const accTxs = sparklineTxs.filter((tx) => tx.accountId === account.id);
    const useNative = account.currency !== "EUR";
    const dayMap: Record<string, number> = {};
    for (const tx of accTxs) {
      const key = new Date(tx.date).toISOString().slice(0, 10);
      const amt = useNative ? Number(tx.amount) : Number(tx.amountEur);
      dayMap[key] = (dayMap[key] ?? 0) + (tx.type === "INCOME" ? amt : -amt);
    }
    let cum = 0;
    return days.map((d) => {
      cum += dayMap[d] ?? 0;
      return cum;
    });
  });

  return (
    <DashboardView
      netWorth={netWorth}
      income={income}
      expenses={expenses}
      currentMonthLabel={now.toLocaleDateString("en-IE", {
        month: "long",
        year: "numeric",
      })}
      insights={insights}
      accounts={accounts.map((a, i) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        balance: Number(a.balance),
        currency: a.currency,
        sparkline: sparklines[i],
      }))}
      recentTxs={recentTxs.map((tx) => ({
        id: tx.id,
        description: tx.description,
        type: tx.type,
        amountEur: Number(tx.amountEur),
        date: tx.date.toISOString(),
        account: { name: tx.account.name },
        category: tx.category
          ? { name: tx.category.name, color: tx.category.color }
          : null,
      }))}
    />
  );
}
