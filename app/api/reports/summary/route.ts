import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [accounts, monthlyIncome, monthlyExpenses, recentTransactions] = await Promise.all([
    prisma.account.findMany({
      where: { userId: session.user.id, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.aggregate({
      where: {
        account: { userId: session.user.id },
        type: "INCOME",
        date: { gte: startOfMonth },
      },
      _sum: { amountEur: true },
    }),
    prisma.transaction.aggregate({
      where: {
        account: { userId: session.user.id },
        type: "EXPENSE",
        date: { gte: startOfMonth },
      },
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

  return NextResponse.json(
    JSON.parse(
      JSON.stringify({
        netWorth,
        monthlyIncome: Number(monthlyIncome._sum.amountEur ?? 0),
        monthlyExpenses: Number(monthlyExpenses._sum.amountEur ?? 0),
        accounts,
        recentTransactions,
      })
    )
  );
}
