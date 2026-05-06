import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("en-IE", { month: "short", year: "2-digit" }),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    };
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const accountId = searchParams.get("accountId") ?? undefined;
  const type = (searchParams.get("type") ?? "EXPENSE") as "EXPENSE" | "INCOME";

  if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 });

  const base = accountId
    ? { accountId, account: { userId: session.user.id } }
    : { account: { userId: session.user.id } };

  const months = getMonths(12);

  const trend = await Promise.all(
    months.map(async ({ year, month, label, key }) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const agg = await prisma.transaction.aggregate({
        where: { ...base, categoryId, type, date: { gte: start, lte: end } },
        _sum: { amountEur: true },
      });
      return { month: label, monthKey: key, value: Number(agg._sum.amountEur ?? 0) };
    })
  );

  return NextResponse.json(trend);
}
