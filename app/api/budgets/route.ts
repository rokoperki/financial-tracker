import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? currentMonth();

  const [year, m] = month.split("-").map(Number);
  const startOfMonth = new Date(year, m - 1, 1);
  const endOfMonth = new Date(year, m, 1);

  const [budgets, spending] = await Promise.all([
    prisma.budget.findMany({
      where: { userId: session.user.id, month },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        account: { userId: session.user.id },
        type: "EXPENSE",
        date: { gte: startOfMonth, lt: endOfMonth },
        categoryId: { not: null },
      },
      _sum: { amountEur: true },
    }),
  ]);

  const spendingMap = Object.fromEntries(
    spending.map((s) => [s.categoryId, Number(s._sum.amountEur ?? 0)])
  );

  const result = budgets.map((b) => ({
    ...b,
    amount: Number(b.amount),
    spent: spendingMap[b.categoryId] ?? 0,
  }));

  return NextResponse.json(JSON.parse(JSON.stringify(result)));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { categoryId, amount, month, alertThreshold } = await req.json();
  if (!categoryId || !amount || !month) {
    return NextResponse.json({ error: "categoryId, amount, and month required" }, { status: 400 });
  }

  const existing = await prisma.budget.findFirst({
    where: { userId: session.user.id, categoryId, month },
  });

  const data = {
    amount,
    alertThreshold: alertThreshold ?? 80,
  };

  const budget = existing
    ? await prisma.budget.update({ where: { id: existing.id }, data })
    : await prisma.budget.create({
        data: { userId: session.user.id, categoryId, month, ...data },
      });

  return NextResponse.json(JSON.parse(JSON.stringify(budget)), { status: 201 });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
