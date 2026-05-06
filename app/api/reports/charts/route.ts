import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("en-IE", { month: "short", year: "2-digit" }),
    };
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonth();
  const accountId = searchParams.get("accountId") ?? undefined;
  const [year, m] = month.split("-").map(Number);
  const startOfMonth = new Date(year, m - 1, 1);
  const endOfMonth = new Date(year, m, 0, 23, 59, 59);
  const daysInMonth = new Date(year, m, 0).getDate();

  const months6 = getMonths(6);
  const months12 = getMonths(12);

  const base = accountId
    ? { accountId, account: { userId: session.user.id } }
    : { account: { userId: session.user.id }, NOT: { category: { name: "Transfer" } } };

  const [spendingRaw, incomeRaw, monthlyData, netWorthData, dailyTxs] = await Promise.all([
    // Spending by category for selected month
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...base, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth }, categoryId: { not: null } },
      _sum: { amountEur: true },
      orderBy: { _sum: { amountEur: "desc" } },
    }),
    // Income by category for selected month
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...base, type: "INCOME", date: { gte: startOfMonth, lte: endOfMonth }, categoryId: { not: null } },
      _sum: { amountEur: true },
      orderBy: { _sum: { amountEur: "desc" } },
    }),
    // Income vs expenses — last 6 months
    Promise.all(
      months6.map(async ({ year: y, month: mo, label }) => {
        const s = new Date(y, mo - 1, 1);
        const e = new Date(y, mo, 0, 23, 59, 59);
        const [inc, exp] = await Promise.all([
          prisma.transaction.aggregate({ where: { ...base, type: "INCOME", date: { gte: s, lte: e } }, _sum: { amountEur: true } }),
          prisma.transaction.aggregate({ where: { ...base, type: "EXPENSE", date: { gte: s, lte: e } }, _sum: { amountEur: true } }),
        ]);
        const monthKey = `${y}-${String(mo).padStart(2, "0")}`;
        return { month: label, monthKey, income: Number(inc._sum.amountEur ?? 0), expenses: Number(exp._sum.amountEur ?? 0) };
      })
    ),
    // Net worth trend — last 12 months (cumulative)
    Promise.all(
      months12.map(async ({ year: y, month: mo, label }) => {
        const e = new Date(y, mo, 0, 23, 59, 59);
        const [inc, exp] = await Promise.all([
          prisma.transaction.aggregate({ where: { ...base, type: "INCOME", date: { lte: e } }, _sum: { amountEur: true } }),
          prisma.transaction.aggregate({ where: { ...base, type: "EXPENSE", date: { lte: e } }, _sum: { amountEur: true } }),
        ]);
        const monthKey = `${y}-${String(mo).padStart(2, "0")}`;
        return { month: label, monthKey, value: Math.round((Number(inc._sum.amountEur ?? 0) - Number(exp._sum.amountEur ?? 0)) * 100) / 100 };
      })
    ),
    // Daily transactions for selected month
    prisma.transaction.findMany({
      where: { ...base, type: { in: ["INCOME", "EXPENSE"] }, date: { gte: startOfMonth, lte: endOfMonth } },
      select: { date: true, amountEur: true, type: true },
    }),
  ]);

  // Aggregate daily data in JS
  const dayMap: Record<number, { income: number; expenses: number }> = {};
  for (const tx of dailyTxs) {
    const day = new Date(tx.date).getDate();
    if (!dayMap[day]) dayMap[day] = { income: 0, expenses: 0 };
    if (tx.type === "INCOME") dayMap[day].income += Number(tx.amountEur);
    else dayMap[day].expenses += Number(tx.amountEur);
  }
  const dailyBreakdown = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    income: Math.round((dayMap[i + 1]?.income ?? 0) * 100) / 100,
    expenses: Math.round((dayMap[i + 1]?.expenses ?? 0) * 100) / 100,
  }));

  const catIds = [...new Set([
    ...spendingRaw.map((s) => s.categoryId!),
    ...incomeRaw.map((s) => s.categoryId!),
  ].filter(Boolean))];
  const categories = await prisma.category.findMany({ where: { id: { in: catIds } } });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const spendingByCategory = spendingRaw.map((s) => ({
    id: s.categoryId!,
    name: catMap[s.categoryId!]?.name ?? "Uncategorized",
    value: Number(s._sum.amountEur ?? 0),
    color: catMap[s.categoryId!]?.color ?? "#94a3b8",
  }));

  const incomeByCategory = incomeRaw.map((s) => ({
    id: s.categoryId!,
    name: catMap[s.categoryId!]?.name ?? "Uncategorized",
    value: Number(s._sum.amountEur ?? 0),
    color: catMap[s.categoryId!]?.color ?? "#94a3b8",
  }));

  return NextResponse.json({ spendingByCategory, incomeByCategory, incomeVsExpenses: monthlyData, netWorthTrend: netWorthData, dailyBreakdown });
}
