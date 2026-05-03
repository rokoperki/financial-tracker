import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";

type ImportRow = {
  amount: number;
  currency: string;
  type: "INCOME" | "EXPENSE";
  description: string;
  date: string;
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, transactions } = await req.json() as {
    accountId: string;
    transactions: ImportRow[];
  };

  if (!accountId || !Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: "accountId and transactions required" }, { status: 400 });
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: session.user.id, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const created = await prisma.$transaction(async (tx) => {
    const rows = await tx.transaction.createManyAndReturn({
      data: transactions.map((t) => ({
        accountId,
        amount: t.amount,
        amountEur: t.amount,
        currency: t.currency || account.currency,
        type: t.type as TransactionType,
        description: t.description || null,
        date: new Date(t.date),
      })),
    });

    const balanceDelta = transactions.reduce((sum, t) => {
      return sum + (t.type === "INCOME" ? t.amount : -t.amount);
    }, 0);

    await tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: balanceDelta } },
    });

    return rows;
  });

  return NextResponse.json({ imported: created.length }, { status: 201 });
}
