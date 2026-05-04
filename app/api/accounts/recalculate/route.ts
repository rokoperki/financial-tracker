import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id, isActive: true },
  });

  await Promise.all(
    accounts.map(async (account) => {
      const isEur = account.currency === "EUR";

      const [incAgg, expAgg] = await Promise.all([
        prisma.transaction.aggregate({
          where: { accountId: account.id, type: "INCOME" },
          _sum: { amountEur: true, amount: true },
        }),
        prisma.transaction.aggregate({
          where: { accountId: account.id, type: "EXPENSE" },
          _sum: { amountEur: true, amount: true },
        }),
      ]);

      const income = isEur
        ? Number(incAgg._sum.amountEur ?? 0)
        : Number(incAgg._sum.amount ?? 0);
      const expense = isEur
        ? Number(expAgg._sum.amountEur ?? 0)
        : Number(expAgg._sum.amount ?? 0);

      await prisma.account.update({
        where: { id: account.id },
        data: { balance: Math.round((income - expense) * 100) / 100 },
      });
    })
  );

  return NextResponse.json({ ok: true });
}
