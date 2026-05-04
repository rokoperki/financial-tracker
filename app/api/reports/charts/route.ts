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

  const months = getMonths(6);

  // Base where clause — scoped to user, optionally to a single account
  const base = accountId
    ? { accountId, account: { userId: session.user.id } }
    : { account: { userId: session.user.id } };

  const [spendingRaw, monthlyData, netWorthData] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: { ...base, type: "EXPENSE", date: { gte: startOfMonth, lte: endOfMonth }, categoryId: { not: null } },
      _sum: { amountEur: true },
      orderBy: { _sum: { amountEur: "desc" } },
    }),
    Promise.all(
      months.map(async ({ year: y, month: mo, label }) => {
        const s = new Date(y, mo - 1, 1);
        const e = new Date(y, mo, 0, 23, 59, 59);
        const [inc, exp] = await Promise.all([
          prisma.transaction.aggregate({
            where: { ...base, type: "INCOME", date: { gte: s, lte: e } },
            _sum: { amountEur: true },
          }),
          prisma.transaction.aggregate({
            where: { ...base, type: "EXPENSE", date: { gte: s, lte: e } },
            _sum: { amountEur: true },
          }),
        ]);
        return { month: label, income: Number(inc._sum.amountEur ?? 0), expenses: Number(exp._sum.amountEur ?? 0) };
      })
    ),
    Promise.all(
      months.map(async ({ year: y, month: mo, label }) => {
        const e = new Date(y, mo, 0, 23, 59, 59);
        const [inc, exp] = await Promise.all([
          prisma.transaction.aggregate({
            where: { ...base, type: "INCOME", date: { lte: e } },
            _sum: { amountEur: true },
          }),
          prisma.transaction.aggregate({
            where: { ...base, type: "EXPENSE", date: { lte: e } },
            _sum: { amountEur: true },
          }),
        ]);
        return { month: label, value: Math.round((Number(inc._sum.amountEur ?? 0) - Number(exp._sum.amountEur ?? 0)) * 100) / 100 };
      })
    ),
  ]);

  const catIds = spendingRaw.map((s) => s.categoryId!).filter(Boolean);
  const categories = await prisma.category.findMany({ where: { id: { in: catIds } } });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  const spendingByCategory = spendingRaw.map((s) => ({
    name: catMap[s.categoryId!]?.name ?? "Uncategorized",
    value: Number(s._sum.amountEur ?? 0),
    color: catMap[s.categoryId!]?.color ?? "#94a3b8",
  }));

  return NextResponse.json({ spendingByCategory, incomeVsExpenses: monthlyData, netWorthTrend: netWorthData });
}
